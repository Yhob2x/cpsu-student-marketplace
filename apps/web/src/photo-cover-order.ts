// The seller API assigns positions by upload order, so the selected cover goes first.
export function coverFirst<T>(files: readonly T[], coverIndex: number): T[] {
  if (!Number.isInteger(coverIndex) || coverIndex < 0 || coverIndex >= files.length) return [...files];
  return [files[coverIndex], ...files.filter((_, index) => index !== coverIndex)];
}
