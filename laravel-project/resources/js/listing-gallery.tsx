import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode, UIEvent } from 'react';
import { Icon } from './icons';
import { adjacentPhotoIndex, clampPhotoIndex, photoIndexFromScroll } from './gallery-navigation';
import { useMouseDragToScroll } from './mobile-browse-controls';
import { ImageZoomDialog } from './image-zoom';

type ListingGalleryProps = {
  photos: readonly string[];
  title: string;
  saveControl?: ReactNode;
};

export function ListingGallery({ photos, title, saveControl }: ListingGalleryProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const thumbnailsViewport = useRef<HTMLDivElement>(null);
  const photoMouseDrag = useMouseDragToScroll(viewport);
  const thumbnailMouseDrag = useMouseDragToScroll(thumbnailsViewport, true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedPhotos, setFailedPhotos] = useState<number[]>([]);
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);
  const [instantZoomEntry, setInstantZoomEntry] = useState(false);
  const total = photos.length;
  const multiple = total > 1;

  useEffect(() => {
    const strip = thumbnailsViewport.current;
    const selected = strip?.children[activeIndex] as HTMLElement | undefined;
    if (!strip || !selected) return;
    const left = selected.offsetLeft - strip.offsetLeft - (strip.clientWidth - selected.clientWidth) / 2;
    strip.scrollTo({ left, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, [activeIndex]);

  function goTo(index: number) {
    const next = clampPhotoIndex(index, total);
    setActiveIndex(next);
    const element = viewport.current;
    if (!element) return;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    element.scrollTo({ left: next * element.clientWidth, behavior: reducedMotion ? 'instant' : 'smooth' });
  }

  function onScroll(event: UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const index = photoIndexFromScroll(element.scrollLeft, element.clientWidth, total);
    setActiveIndex(previous => previous === index ? previous : index);
  }

  function onGalleryKey(event: KeyboardEvent<HTMLDivElement>) {
    if (!multiple || event.target !== event.currentTarget) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); goTo(adjacentPhotoIndex(activeIndex, 1, total)); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(adjacentPhotoIndex(activeIndex, -1, total)); }
    if (event.key === 'Home') { event.preventDefault(); goTo(0); }
    if (event.key === 'End') { event.preventDefault(); goTo(total - 1); }
  }

  return <section className="product-gallery" aria-label={multiple ? `Photos of ${title}` : `Photo of ${title}`}>
    <div className="product-gallery-stage">
      {total === 0
        ? <div className="listing-photo-empty"><Icon name="tag" size={30} /><span>No listing photos yet</span></div>
        : <>
          <div
            className="product-gallery-viewport browse-drag-scroll"
            ref={viewport}
            {...photoMouseDrag}
            role={multiple ? 'region' : undefined}
            aria-roledescription={multiple ? 'carousel' : undefined}
            aria-label={multiple ? `Swipe through ${total} photos of ${title}` : undefined}
            tabIndex={multiple ? 0 : undefined}
            onScroll={onScroll}
            onKeyDown={onGalleryKey}
          >
            {photos.map((photo, index) => <div className="product-gallery-slide" key={`${photo}-${index}`}
              role={multiple ? 'group' : undefined}
              aria-roledescription={multiple ? 'slide' : undefined}
              aria-label={multiple ? `${index + 1} of ${total}` : undefined}>
              {failedPhotos.includes(index)
                ? <div className="product-gallery-failed"><Icon name="tag" size={28}/><span>Photo unavailable</span></div>
                : <button type="button" className="product-gallery-photo-button"
                    aria-label={`Enlarge photo ${index + 1} of ${total}: ${title}`} onClick={event => { setInstantZoomEntry(event.detail === 0); setZoomIndex(index); }}>
                    <img src={photo} alt={`Photo ${index + 1} of ${total}: ${title}`}
                      loading={index === 0 ? 'eager' : 'lazy'} decoding="async" draggable={false}
                      onError={() => setFailedPhotos(previous => previous.includes(index) ? previous : [...previous, index])} />
                  </button>}
            </div>)}
          </div>
          <button type="button" className="product-gallery-zoom-trigger" aria-label={`Zoom photo ${activeIndex + 1} of ${total}`}
            onClick={event => { setInstantZoomEntry(event.detail === 0); setZoomIndex(activeIndex); }}><span aria-hidden="true">+</span> Enlarge</button>
          {multiple && <>
            <span className="product-gallery-count" aria-hidden="true">{activeIndex + 1} / {total}</span>
            <button type="button" className="product-gallery-arrow product-gallery-prev"
              disabled={activeIndex <= 0} aria-label="Previous photo"
              onClick={() => goTo(adjacentPhotoIndex(activeIndex, -1, total))}>
              <Icon name="chevronLeft" size={24} />
            </button>
            <button type="button" className="product-gallery-arrow product-gallery-next"
              disabled={activeIndex >= total - 1} aria-label="Next photo"
              onClick={() => goTo(adjacentPhotoIndex(activeIndex, 1, total))}>
              <Icon name="chevronRight" size={24} />
            </button>
          </>}
        </>
      }
      {total > 0 && saveControl && <div className="product-gallery-save">{saveControl}</div>}
    </div>
    {multiple && <>
      <div className="product-gallery-meta">
        <span>Product photos</span>
        <span className="product-gallery-swipe-hint">Swipe to see more</span>
      </div>
      <div className="product-gallery-thumbnails browse-drag-scroll" ref={thumbnailsViewport}
        {...thumbnailMouseDrag} role="group" aria-label="Choose a photo">
        {photos.map((photo, index) => <button
          type="button" key={`thumb-${photo}-${index}`} className="product-gallery-thumb"
          aria-label={`Show photo ${index + 1} of ${total}`}
          aria-pressed={activeIndex === index} onClick={() => goTo(index)}>
          {failedPhotos.includes(index)
            ? <span className="product-gallery-thumb-empty"><Icon name="tag" size={18}/></span>
            : <img src={photo} alt="" loading="lazy" decoding="async" draggable={false}
                onError={() => setFailedPhotos(previous => previous.includes(index) ? previous : [...previous, index])} />}
        </button>)}
      </div>
      <span className="sr-only" role="status">Photo {activeIndex + 1} of {total}</span>
    </>}
    {zoomIndex !== null && total > 0 && <ImageZoomDialog photos={photos} title={title} initialIndex={zoomIndex} instantEntry={instantZoomEntry}
      onClose={(index) => { setZoomIndex(null); goTo(index); }} />}
  </section>;
}
