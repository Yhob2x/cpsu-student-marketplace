/** Only completed server-confirmed uploads count toward progress. */
export function uploadEstimate(completed: number, total: number, elapsedAtCompletionMs: number, sinceCompletionMs = 0): string {
  if (total <= 0 || completed <= 0 || elapsedAtCompletionMs < 1000) return 'Estimating time remaining…';
  if (completed >= total) return 'All photos uploaded';
  const remainingSeconds = Math.max(1, Math.ceil((elapsedAtCompletionMs / 1000 / completed) * (total - completed) - sinceCompletionMs / 1000));
  if (remainingSeconds < 60) return `About ${remainingSeconds}s left`;
  return `About ${Math.ceil(remainingSeconds / 60)} min left`;
}

export function uploadPercent(completed: number, total: number): number {
  return total > 0 ? Math.round(Math.max(0, Math.min(completed, total)) / total * 100) : 0;
}
