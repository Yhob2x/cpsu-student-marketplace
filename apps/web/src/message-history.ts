/** Merge a periodically polled recent window with older pages already loaded.
 * Prefer the newest API copy of each message for live delivery/read receipts.
 */
export function mergeMessageHistory<T extends { id: number }>(
  existing: T[] | undefined, incoming: T[],
): T[] {
  const byId = new Map<number, T>();
  for (const message of existing ?? []) byId.set(message.id, message);
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.id - b.id);
}
