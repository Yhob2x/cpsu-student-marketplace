import { assessListingReadability } from '../src/listing-quality';
// Authorized local development API only. No authenticated request, write or media fetch.
const base = 'http://127.0.0.1:4000/api/v1/listings';
let page = 1;
let reviewed = 0;
const issues: { id: number; reasons: string[] }[] = [];
while (page <= 30) {
  const response = await fetch(base + '?pageSize=20&page=' + page, {
    method: 'GET', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw new Error('Read-only listing audit stopped: API GET HTTP ' + response.status);
  const data = await response.json() as { items?: { id: number; title: string; description: string }[]; total?: number };
  if (!Array.isArray(data.items)) throw new Error('Read-only audit requires listings.items array');
  for (const item of data.items) {
    reviewed++;
    const reasons = assessListingReadability(item.title, item.description);
    if (reasons.length > 0) issues.push({ id: item.id, reasons });
  }
  if (data.items.length === 0 || reviewed >= (data.total ?? reviewed)) break;
  page++;
}
console.log(JSON.stringify({ totalReviewed: reviewed, flagged: issues.length, examples: issues.slice(0, 15) }, null, 2));
