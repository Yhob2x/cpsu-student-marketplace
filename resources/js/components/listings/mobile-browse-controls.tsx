import { type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';

import { Icon } from '@/components/icons';

type ScrollTarget = RefObject<HTMLDivElement | null>;

/**
 * Drag horizontally with a DESKTOP MOUSE without hijacking touchscreen swipes.
 * Links and Save buttons remain clickable until the pointer actually moves.
 * Capturing the pointer only after an intentional horizontal drag prevents
 * accidental navigations and lets the user leave the rail during the gesture.
 */
export function useMouseDragToScroll(targetRef: ScrollTarget, allowButtonDrag = false) {
  const drag = useRef<{ id: number; startX: number; startY: number; initialLeft: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const showDraggableCursor = (container: HTMLDivElement) => {
    container.dataset.browseDraggable = String(container.scrollWidth > container.clientWidth + 2);
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || event.pointerId !== state.id) return;
    const element = event.currentTarget;
    if (state.moved) suppressClick.current = true;
    element.classList.remove('browse-is-dragging');
    if (element.hasPointerCapture(event.pointerId)) {
      element.releasePointerCapture(event.pointerId);
    }
    drag.current = null;
  };

  return {
    onPointerEnter: (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType === 'mouse') showDraggableCursor(event.currentTarget);
    },
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
      suppressClick.current = false;
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      const container = targetRef.current;
      if (!container) return;
      showDraggableCursor(container);
      if (container.scrollWidth <= container.clientWidth + 2) return;
      // Save and form actions stay independent; photo thumbnails opt in to dragging.
      if ((event.target as Element).closest(allowButtonDrag ? 'input, textarea, select' : 'button, input, textarea, select')) return;
      drag.current = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        initialLeft: container.scrollLeft,
        moved: false,
      };
    },
    onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => {
      const state = drag.current;
      if (!state || event.pointerId !== state.id || (event.buttons & 1) !== 1) return;
      const dx = event.clientX - state.startX;
      const dy = event.clientY - state.startY;
      if (!state.moved) {
        if (Math.abs(dx) < 8) return;
        if (Math.abs(dx) < Math.abs(dy) * 1.2) {
          drag.current = null; // The user intended vertical page scrolling.
          return;
        }
        state.moved = true;
        event.currentTarget.classList.add('browse-is-dragging');
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Drag within rail remains possible. */ }
      }
      event.preventDefault();
      event.currentTarget.scrollLeft = state.initialLeft - dx;
    },
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onPointerLeave: (event: ReactPointerEvent<HTMLDivElement>) => {
      if (drag.current && !drag.current.moved) drag.current = null;
      if (event.pointerType === 'mouse' && !drag.current) event.currentTarget.classList.remove('browse-is-dragging');
    },
    onClickCapture: (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!suppressClick.current) return;
      suppressClick.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
    onDragStart: (event: ReactMouseEvent<HTMLDivElement>) => {
      // Prevent the browser's native link/image drag competing with carousel drag.
      if (drag.current) event.preventDefault();
    },
  };
}

type ControlsProps = {
  targetRef: ScrollTarget;
  itemCount: number;
  label: string;
};

/**
 * Explicit bidirectional navigation alongside native touch scroll.
 * iOS can treat a rightward swipe at scrollLeft=0 as browser Back; that is
 * not a carousel navigation gesture. Previous is disabled at the beginning,
 * and Next remains an accessible way to advance without a gesture.
 */
export function MobileBrowseControls({ targetRef, itemCount, label }: ControlsProps) {
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [canScroll, setCanScroll] = useState(false);

  useEffect(() => {
    const container = targetRef.current;
    if (!container || itemCount < 3) return;
    const update = () => {
      const max = Math.max(0, container.scrollWidth - container.clientWidth);
      setCanScroll(max > 2);
      setCanGoBack(container.scrollLeft > 2);
      setCanGoForward(container.scrollLeft < max - 2);
    };
    container.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    observer?.observe(container);
    update();
    return () => {
      container.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      observer?.disconnect();
    };
  }, [targetRef, itemCount]);

  if (itemCount < 3 || !canScroll) return null;

  const move = (direction: -1 | 1) => {
    const container = targetRef.current;
    if (!container) return;
    const card = container.querySelector<HTMLElement>('.product-card');
    const gap = Number.parseFloat(getComputedStyle(container).columnGap) || 12;
    const step = (card?.getBoundingClientRect().width ?? container.clientWidth / 2) + gap;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    container.scrollBy({ left: direction * step, behavior: reducedMotion ? 'auto' : 'smooth' });
  };

  const hint = canGoBack && canGoForward ? 'left or right'
    : canGoBack ? 'right to go back' : 'left for more';

  return <div className="mobile-browse-controls" role="group" aria-label={`${label} browsing controls`}>
    <span className="mobile-browse-hint">
      <span className="browse-touch-copy">Swipe {hint}</span>
      <span className="browse-mouse-copy">Drag {hint}</span>
    </span>
    <div className="mobile-browse-buttons">
      <button type="button" className="mobile-browse-arrow mobile-browse-prev"
        aria-label={`Previous ${label.toLowerCase()}`} disabled={!canGoBack} onClick={() => move(-1)}>
        <Icon name="arrow" size={18} />
      </button>
      <button type="button" className="mobile-browse-arrow"
        aria-label={`Next ${label.toLowerCase()}`} disabled={!canGoForward} onClick={() => move(1)}>
        <Icon name="arrow" size={18} />
      </button>
    </div>
  </div>;
}

export function SwipeableListingRail({ children, itemCount, label, showControls = true }: {
  children: ReactNode;
  itemCount: number;
  label: string;
  showControls?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mouseDrag = useMouseDragToScroll(ref);
  return <>
    <div className="rail browse-drag-scroll" ref={ref} role="region" aria-label={label} tabIndex={0}
      {...mouseDrag}>{children}</div>
    {showControls && <MobileBrowseControls targetRef={ref} itemCount={itemCount} label={label} />}
  </>;
}
