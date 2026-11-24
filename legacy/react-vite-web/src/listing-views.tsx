import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { Icon } from './icons';
import './listing-views.css';

export type ViewSummary = { available: boolean; count: number | null };
const unavailable: ViewSummary = { available: false, count: null };
const pending = new Map<number, Array<(value: ViewSummary) => void>>();
let scheduled = false;

// Batch the public view summaries to avoid one API request per card.
function loadViewCount(id: number): Promise<ViewSummary> {
  return new Promise(resolve => {
    pending.set(id, [...(pending.get(id) ?? []), resolve]);
    if (scheduled) return;
    scheduled = true;
    setTimeout(async () => {
      scheduled = false;
      const entries = [...pending.entries()];
      pending.clear();
      for (let offset = 0; offset < entries.length; offset += 50) {
        const batch = entries.slice(offset, offset + 50);
        try {
          const result = await api<{ views: Record<number, ViewSummary> }>(
            `/listing-views?ids=${batch.map(([key]) => key).join(',')}`);
          batch.forEach(([key, callbacks]) => callbacks.forEach(done => done(result.views[key] ?? unavailable)));
        } catch {
          batch.forEach(([, callbacks]) => callbacks.forEach(done => done(unavailable)));
        }
      }
    }, 0);
  });
}

export function ListingViews({ listingId, compact = false }: { listingId: number; compact?: boolean }) {
  const [summary, setSummary] = useState<ViewSummary | null>(null);
  const requestId = useRef(0);
  useEffect(() => {
    const version = ++requestId.current;
    setSummary(null);
    loadViewCount(listingId).then(value => {
      if (version === requestId.current) setSummary(value);
    });
    return () => { requestId.current++; };
  }, [listingId]);

  useEffect(() => {
    const update = (event: Event) => {
      const detail = (event as CustomEvent<{ listingId: number; count: number | null; available: boolean }>).detail;
      if (detail?.listingId !== listingId) return;
      requestId.current++; // ignore an older batched response after a confirmed view
      setSummary({ available: detail.available, count: detail.count });
    };
    window.addEventListener('listing-view-confirmed', update);
    return () => window.removeEventListener('listing-view-confirmed', update);
  }, [listingId]);

  const count = summary?.available && summary.count !== null ? summary.count : null;
  const label = count === null ? 'Views unavailable' : `${count.toLocaleString('en-PH')} listing views`;
  return <span className={`listing-view-count ${compact ? 'is-compact' : 'is-detail'}`}
    role="img" aria-label={label} title={label}>
    <Icon name="eye" size={compact ? 15 : 17} />
    <span aria-hidden="true">{count === null ? '—' : count.toLocaleString('en-PH')}</span>
  </span>;
}
