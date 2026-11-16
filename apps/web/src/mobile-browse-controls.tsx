import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import { Icon } from './icons';

type ScrollTarget = RefObject<HTMLDivElement | null>;

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

  useEffect(() => {
    const container = targetRef.current;
    if (!container || itemCount < 3) return;
    const update = () => {
      const max = Math.max(0, container.scrollWidth - container.clientWidth);
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

  if (itemCount < 3) return null;

  const move = (direction: -1 | 1) => {
    const container = targetRef.current;
    if (!container) return;
    const card = container.querySelector<HTMLElement>('.product-card');
    const gap = Number.parseFloat(getComputedStyle(container).columnGap) || 12;
    const step = (card?.getBoundingClientRect().width ?? container.clientWidth / 2) + gap;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    container.scrollBy({ left: direction * step, behavior: reducedMotion ? 'auto' : 'smooth' });
  };

  const hint = canGoBack && canGoForward ? 'Swipe left or right'
    : canGoBack ? 'Swipe right to go back' : 'Swipe left for more';

  return <div className="mobile-browse-controls" role="group" aria-label={`${label} browsing controls`}>
    <span className="mobile-browse-hint">{hint}</span>
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

export function SwipeableListingRail({ children, itemCount, label }: {
  children: ReactNode;
  itemCount: number;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return <>
    <div className="rail" ref={ref} role="region" aria-label={label} tabIndex={0}>{children}</div>
    <MobileBrowseControls targetRef={ref} itemCount={itemCount} label={label} />
  </>;
}
