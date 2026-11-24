import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { createPortal } from 'react-dom';

import { Icon } from '@/components/icons';
import { adjacentPhotoIndex, clampPhotoIndex } from '@/lib/listings/gallery-navigation';

type Point = { x: number; y: number };
type Offset = Point;
const MAX_ZOOM = 4;
const MIN_ZOOM = 1;

export function clampZoom(value: number): number {
  return Number.isFinite(value) ? Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value)) : MIN_ZOOM;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Size occupied by the photo inside an object-fit: contain viewer. */
export function fittedPhotoSize(
  naturalWidth: number, naturalHeight: number,
  viewportWidth: number, viewportHeight: number,
): { width: number; height: number } {
  if (naturalWidth <= 0 || naturalHeight <= 0 || viewportWidth <= 0 || viewportHeight <= 0)
    return { width: 0, height: 0 };
  const ratio = Math.min(viewportWidth / naturalWidth, viewportHeight / naturalHeight);
  return { width: naturalWidth * ratio, height: naturalHeight * ratio };
}

/** Pan only where the zoomed, visible photo exceeds the viewer's dimensions. */
export function limitPhotoPan(
  offset: Offset, scale: number, photoWidth: number, photoHeight: number,
  viewportWidth: number, viewportHeight: number,
): Offset {
  if (scale <= 1) return { x: 0, y: 0 };
  const xLimit = Math.max(0, (photoWidth * scale - viewportWidth) / 2);
  const yLimit = Math.max(0, (photoHeight * scale - viewportHeight) / 2);
  return {
    x: Math.max(-xLimit, Math.min(xLimit, offset.x)),
    y: Math.max(-yLimit, Math.min(yLimit, offset.y)),
  };
}

/** Keep the same point under the fingers/cursor when the image scales. */
export function anchorPhotoZoom(
  oldScale: number, newScale: number, previous: Offset,
  from: Point, to: Point = from,
): Offset {
  const ratio = newScale / oldScale;
  return {
    x: to.x - (from.x - previous.x) * ratio,
    y: to.y - (from.y - previous.y) * ratio,
  };
}

export function ImageZoomDialog({ photos, title, initialIndex, onClose, instantEntry = false }: {
  photos: readonly string[];
  title: string;
  initialIndex: number;
  onClose: (index: number) => void;
  instantEntry?: boolean;
}) {
  const [index, setIndex] = useState(() => clampPhotoIndex(initialIndex, photos.length));
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [failed, setFailed] = useState<number[]>([]);
  const [motionPhase, setMotionPhase] = useState<'entering' | 'open' | 'exiting'>(() => instantEntry || (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) ? 'open' : 'entering');
  const scaleRef = useRef(1);
  const offsetRef = useRef<Offset>({ x: 0, y: 0 });
  const surfaceRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const filmstripRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const drag = useRef<{ start: Point; offset: Offset } | null>(null);
  const pinch = useRef<{ distance: number; scale: number; midpoint: Point; offset: Offset } | null>(null);
  const didPinch = useRef(false);
  const lastTap = useRef<{ at: number; point: Point } | null>(null);
  const headingId = useId();

  useEffect(() => {
    if (instantEntry || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setMotionPhase('open');
      return;
    }
    const frame = window.requestAnimationFrame(() => setMotionPhase('open'));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const requestClose = (keyboard = false) => {
    if (keyboard || motionPhase === 'entering' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onClose(index);
      return;
    }
    setMotionPhase('exiting');
  };

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    const strip = filmstripRef.current;
    const selected = strip?.children[index] as HTMLElement | undefined;
    if (!strip || !selected) return;
    const isSidePanel = window.matchMedia('(min-width: 761px)').matches;
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
    if (isSidePanel) {
      const top = selected.offsetTop - strip.offsetTop - (strip.clientHeight - selected.clientHeight) / 2;
      strip.scrollTo({ top, behavior });
    } else {
      const left = selected.offsetLeft - strip.offsetLeft - (strip.clientWidth - selected.clientWidth) / 2;
      strip.scrollTo({ left, behavior });
    }
  }, [index]);

  const updateZoom = (nextScale: number, nextOffset: Offset = offsetRef.current) => {
    const value = clampZoom(nextScale);
    const box = surfaceRef.current;
    const photo = imageRef.current;
    const viewWidth = box?.clientWidth ?? 0;
    const viewHeight = box?.clientHeight ?? 0;
    const fitted = fittedPhotoSize(photo?.naturalWidth ?? 0, photo?.naturalHeight ?? 0, viewWidth, viewHeight);
    const bounded = limitPhotoPan(nextOffset, value, fitted.width, fitted.height, viewWidth, viewHeight);
    scaleRef.current = value;
    offsetRef.current = bounded;
    setScale(value);
    setOffset(bounded);
  };

  const zoomAt = (nextScale: number, clientPoint: Point) => {
    const box = surfaceRef.current?.getBoundingClientRect();
    if (!box) { updateZoom(nextScale); return; }
    const point = {
      x: clientPoint.x - box.left - box.width / 2,
      y: clientPoint.y - box.top - box.height / 2,
    };
    const value = clampZoom(nextScale);
    updateZoom(value, anchorPhotoZoom(scaleRef.current, value, offsetRef.current, point));
  };

  // Wheel or trackpad zoom works throughout the fullscreen photo canvas.
  // The non-passive listener can prevent the page underneath from scrolling.
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const handleWheel = (event: globalThis.WheelEvent) => {
      event.preventDefault();
      const step = event.deltaY < 0 ? .25 : -.25;
      zoomAt(scaleRef.current + step, { x: event.clientX, y: event.clientY });
    };
    surface.addEventListener('wheel', handleWheel, { passive: false });
    return () => surface.removeEventListener('wheel', handleWheel);
  });

  const resetView = () => {
    pointers.current.clear();
    drag.current = null;
    pinch.current = null;
    didPinch.current = false;
    lastTap.current = null;
    updateZoom(1, { x: 0, y: 0 });
  };

  const showPhoto = (next: number, fromThumbnail = false) => {
    if (scaleRef.current > 1.01 && !fromThumbnail) return;
    setIndex(clampPhotoIndex(next, photos.length));
    resetView();
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const box = event.currentTarget;
    box.setPointerCapture(event.pointerId);
    const point = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, point);
    if (pointers.current.size === 1) {
      drag.current = { start: point, offset: offsetRef.current };
      pinch.current = null;
    } else if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      pinch.current = {
        distance: Math.max(1, distance(a, b)),
        scale: scaleRef.current,
        midpoint: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        offset: offsetRef.current,
      };
      didPinch.current = true;
    }
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    const point = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, point);
    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = Array.from(pointers.current.values());
      const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const nextScale = clampZoom(pinch.current.scale * distance(a, b) / pinch.current.distance);
      const bounds = event.currentTarget.getBoundingClientRect();
      const center = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
      updateZoom(nextScale, anchorPhotoZoom(
        pinch.current.scale, nextScale, pinch.current.offset,
        { x: pinch.current.midpoint.x - center.x, y: pinch.current.midpoint.y - center.y },
        { x: midpoint.x - center.x, y: midpoint.y - center.y },
      ));
    } else if (pointers.current.size === 1 && drag.current && scaleRef.current > 1) {
      updateZoom(scaleRef.current, {
        x: drag.current.offset.x + point.x - drag.current.start.x,
        y: drag.current.offset.y + point.y - drag.current.start.y,
      });
    }
  };

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current?.start;
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (pointers.current.size === 1) {
      const point = Array.from(pointers.current.values())[0];
      drag.current = { start: point, offset: offsetRef.current };
      pinch.current = null;
      return;
    }
    if (pointers.current.size > 0) return;
    if (didPinch.current) {
      didPinch.current = false;
      lastTap.current = null;
      drag.current = null;
      pinch.current = null;
      return;
    }
    if (!start || event.type === 'pointercancel') return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (scaleRef.current <= 1.01 && Math.abs(dx) >= 55 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      showPhoto(adjacentPhotoIndex(index, dx < 0 ? 1 : -1, photos.length));
      return;
    }
    if (event.pointerType === 'touch' && distance(start, { x: event.clientX, y: event.clientY }) < 18) {
      const now = Date.now();
      const previous = lastTap.current;
      const point = { x: event.clientX, y: event.clientY };
      if (previous && now - previous.at < 320 && distance(previous.point, point) < 36) {
        zoomAt(scaleRef.current > 1 ? 1 : 2, point);
        lastTap.current = null;
      } else lastTap.current = { at: now, point };
    }
    drag.current = null;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); requestClose(true); return; }
    if (event.key === 'Tab') {
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first && last) {
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
      return;
    }
    if (event.key === '+' || event.key === '=') { event.preventDefault(); updateZoom(scaleRef.current + .5); return; }
    if (event.key === '-') { event.preventDefault(); updateZoom(scaleRef.current - .5); return; }
    if (scaleRef.current > 1.01) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); showPhoto(index + 1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); showPhoto(index - 1); }
  };

  return createPortal(
    <div className="image-zoom-overlay" ref={dialogRef} role="dialog" aria-modal="true"
      aria-labelledby={headingId} onKeyDown={onKeyDown} data-motion-phase={motionPhase}
      onMouseDown={event => { if (event.target === event.currentTarget) requestClose(); }}
      onTransitionEnd={event => {
        if (event.target === event.currentTarget && event.propertyName === 'opacity' && motionPhase === 'exiting') onClose(index);
      }}>
      <div className="image-zoom-dialog">
      <div className="image-zoom-toolbar">
        <div className="image-zoom-heading">
          <strong id={headingId}>{title}</strong>
          <span aria-live="polite" aria-label={`Photo ${index + 1} of ${photos.length}`}>{index + 1} / {photos.length}</span>
        </div>
        <div className="image-zoom-actions">
          <button type="button" aria-label="Zoom out" title="Zoom out" disabled={scale <= 1} onClick={() => updateZoom(scaleRef.current - .5)}><Icon name="minus" size={19} /></button>
          <span className="image-zoom-value" aria-live="off">{Math.round(scale * 100)}%</span>
          <button type="button" aria-label="Zoom in" title="Zoom in" disabled={scale >= MAX_ZOOM} onClick={() => updateZoom(scaleRef.current + .5)}><Icon name="plus" size={19} /></button>
          <button type="button" className="image-zoom-reset" onClick={() => updateZoom(1, { x: 0, y: 0 })}>Reset</button>
          <button type="button" ref={closeRef} className="image-zoom-close" aria-label="Close photo zoom" title="Close photo zoom" onClick={event => requestClose(event.detail === 0)}><Icon name="close" size={21} /></button>
        </div>
      </div>
      <div className="image-zoom-view">
        {photos.length > 1 && <button type="button" className="image-zoom-prev" aria-label="Previous zoom photo" disabled={index === 0 || scale > 1} onClick={() => showPhoto(index - 1)}><Icon name="chevronLeft" size={24} /></button>}
        <div className="image-zoom-surface" ref={surfaceRef} data-zoomed={scale > 1}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onDoubleClick={event => zoomAt(scaleRef.current > 1 ? 1 : 2, { x: event.clientX, y: event.clientY })}>
          {failed.includes(index)
            ? <div className="image-zoom-unavailable"><Icon name="tag" size={32} /><span>Photo unavailable</span></div>
            : <img ref={imageRef} src={photos[index]} alt={'Zoomed photo ' + (index + 1) + ' of ' + photos.length + ': ' + title}
                draggable={false} style={{ transform: 'translate3d(' + offset.x + 'px, ' + offset.y + 'px, 0) scale(' + scale + ')' }}
                onLoad={() => updateZoom(scaleRef.current, offsetRef.current)}
                onError={() => setFailed(values => values.includes(index) ? values : [...values, index])} />}
        </div>
        {photos.length > 1 && <button type="button" className="image-zoom-next" aria-label="Next zoom photo" disabled={index === photos.length - 1 || scale > 1} onClick={() => showPhoto(index + 1)}><Icon name="chevronRight" size={24} /></button>}
      </div>
      {photos.length > 1 && <div className="image-zoom-filmstrip" ref={filmstripRef} role="group" aria-label="Choose a photo in full screen">
        {photos.map((photo, photoIndex) => <button type="button" key={`${photo}-${photoIndex}`}
          className="image-zoom-thumb" aria-label={`Show photo ${photoIndex + 1} of ${photos.length}`}
          aria-pressed={index === photoIndex} onClick={() => showPhoto(photoIndex, true)}>
          {failed.includes(photoIndex)
            ? <span className="image-zoom-thumb-failed"><Icon name="tag" size={17}/></span>
            : <img src={photo} alt="" loading="lazy" decoding="async" draggable={false}
                onError={() => setFailed(values => values.includes(photoIndex) ? values : [...values, photoIndex])} />}
        </button>)}
      </div>}
      <p className="image-zoom-help">Scroll, pinch or double-tap to zoom. Drag to explore; swipe to change photos.</p>
      </div>
    </div>, document.body
  );
}
