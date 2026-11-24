// Native horizontal scrolling powers touch swipes; these helpers keep controls in sync.
export function clampPhotoIndex(index: number, total: number): number {
  return Math.min(Math.max(0, Math.round(index)), Math.max(0, total - 1));
}

export function photoIndexFromScroll(scrollLeft: number, width: number, total: number): number {
  if (!Number.isFinite(scrollLeft) || !Number.isFinite(width) || width <= 0) return 0;
  return clampPhotoIndex(scrollLeft / width, total);
}

export function adjacentPhotoIndex(current: number, direction: -1 | 1, total: number): number {
  return clampPhotoIndex(current + direction, total);
}
