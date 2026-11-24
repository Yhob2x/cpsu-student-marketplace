// Keep the Home sections focused on distinct marketplace discovery needs.
export function selectHomeListings<T extends { id: number }>(feed: T[] | null, popular: T[] | null, services: T[] | null) {
  const fresh = feed?.slice(0, 8) ?? null;
  const shown = new Set([...(popular ?? []), ...(fresh ?? [])].map(item => item.id));
  const serviceRows = services?.filter(item => !shown.has(item.id)) ?? null;
  return { popular, fresh, services: serviceRows };
}
