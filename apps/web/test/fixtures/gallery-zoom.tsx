import React from 'react';
import { createRoot } from 'react-dom/client';
import { ListingGallery } from './src/listing-gallery';
import './src/styles.css';
import './src/listing-gallery.css';
import './src/image-zoom.css';

const svg = (label: string) => 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="#d0e1d4"/><text x="30" y="150" font-size="46">' + label + '</text></svg>'
);
const images = [svg('ONE'), svg('TWO'), svg('THREE')];
createRoot(document.getElementById('root')!).render(<ListingGallery photos={images} title="Synthetic Test Product" />);
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const checks: Record<string, boolean> = {};
  try {
    await pause(250);
    const photoGallery = document.querySelector('.product-gallery-viewport') as HTMLDivElement;
    checks.fullWidthSlides = photoGallery && photoGallery.querySelectorAll('.product-gallery-slide').length === 3 &&
      [...photoGallery.querySelectorAll<HTMLElement>('.product-gallery-slide')].every(e => Math.abs(e.clientWidth - photoGallery.clientWidth) < 3);
    const pageWidthBefore = document.documentElement.scrollWidth;
    photoGallery.scrollLeft = photoGallery.clientWidth;
    photoGallery.dispatchEvent(new Event('scroll', { bubbles: true }));
    await pause(120);
    checks.photoCounterUpdates = document.querySelector('.product-gallery-count')?.textContent?.includes('2 / 3') === true;
    checks.thumbnailUpdates = document.querySelectorAll('.product-gallery-thumb[aria-pressed="true"]').length === 1 &&
      document.querySelectorAll('.product-gallery-thumb')[1].getAttribute('aria-pressed') === 'true';
    checks.pageDoesNotSwipe = document.documentElement.scrollWidth <= Math.max(window.innerWidth, pageWidthBefore);
    (document.querySelector('.product-gallery-zoom-trigger') as HTMLButtonElement).click();
    await pause(180);
    checks.zoomOpens = Boolean(document.querySelector('.image-zoom-overlay[role="dialog"][aria-modal="true"]'));
    checks.bodyLocked = document.body.style.overflow === 'hidden';
    (document.querySelector('button[aria-label="Zoom in"]') as HTMLButtonElement).click();
    await pause(120);
    checks.zoomChangesScale = document.querySelector('.image-zoom-value')?.textContent === '150%';
    (document.querySelector('.image-zoom-reset') as HTMLButtonElement).click();
    await pause(100);
    checks.zoomResets = document.querySelector('.image-zoom-value')?.textContent === '100%';
    const surface = document.querySelector('.image-zoom-surface') as HTMLDivElement;
    // Simulated touch points to verify pointer math; real iPhone hardware QA remains separate.
    surface.setPointerCapture = () => {};
    surface.hasPointerCapture = () => false;
    const pointer = (type: string, id: number, x: number, y: number) =>
      surface.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: id, pointerType: 'touch', clientX: x, clientY: y, isPrimary: id === 1 }));
    pointer('pointerdown', 1, 90, 250);
    pointer('pointerdown', 2, 140, 250);
    pointer('pointermove', 2, 190, 250);
    await pause(90);
    checks.pinchZoomsImage = document.querySelector('.image-zoom-value')?.textContent === '200%';
    pointer('pointerup', 2, 190, 250);
    pointer('pointerup', 1, 90, 250);
    const zoomedImage = document.querySelector('.image-zoom-surface img') as HTMLImageElement;
    const startX = Number(zoomedImage?.style.transform.match(/translate3d\(([-\d.]+)px/)?.[1] ?? 0);
    pointer('pointerdown', 3, 150, 250);
    pointer('pointermove', 3, 188, 250);
    await pause(70);
    const endX = Number(zoomedImage?.style.transform.match(/translate3d\(([-\d.]+)px/)?.[1] ?? 0);
    checks.dragMovesZoomedImage = Math.abs(endX - startX) > 20;
    pointer('pointerup', 3, 188, 250);
    (document.querySelector('.image-zoom-reset') as HTMLButtonElement).click();
    await pause(60);
    pointer('pointerdown', 4, 160, 240); pointer('pointerup', 4, 160, 240);
    pointer('pointerdown', 5, 160, 240); pointer('pointerup', 5, 160, 240);
    await pause(90);
    checks.doubleTapZoomsImage = document.querySelector('.image-zoom-value')?.textContent === '200%';
    (document.querySelector('.image-zoom-reset') as HTMLButtonElement).click();
    await pause(60);
    (document.querySelector('button[aria-label="Next zoom photo"]') as HTMLButtonElement).click();
    await pause(100);
    checks.zoomViewerNextPhoto = document.querySelector('.image-zoom-heading span')?.textContent?.includes('3 / 3') === true;
    document.querySelector('.image-zoom-overlay')?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
    await pause(100);
    checks.escapeCloses = !document.querySelector('.image-zoom-overlay') && document.body.style.overflow === '';
  } catch (error) {
    (checks as any).error = String(error);
  }
  const success = Object.values(checks).every(Boolean);
  document.body.dataset.galleryQa = JSON.stringify(checks);
  document.body.dataset.galleryQaResult = success ? 'PASS' : 'FAIL';
})();
