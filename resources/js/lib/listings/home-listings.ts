// Keep the Home sections focused on distinct marketplace discovery needs.
export function selectHomeListings<T extends { id: number }>(feed: T[] | null, popular: T[] | null, services: T[] | null) {
  const fresh = feed?.slice(0, 8) ?? null;
  const trendingLimit = 10;
  const ranked = (popular ?? []).slice(0, trendingLimit);
  const rankedIds = new Set(ranked.map(item => item.id));
  const fillers = (feed ?? []).filter(item => !rankedIds.has(item.id)).slice(0, trendingLimit - ranked.length);
  const trending = [...ranked, ...fillers];
  const shown = new Set([...trending, ...(fresh ?? [])].map(item => item.id));
  const serviceRows = services?.filter(item => !shown.has(item.id)) ?? null;
  return { popular, trending, fresh, services: serviceRows };
}
