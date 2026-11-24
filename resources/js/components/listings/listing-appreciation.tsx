import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { showActionFeedback } from '@/components/action-feedback';
import { Icon } from '@/components/icons';
import { api, explain } from '@/lib/api';

type Summary = { available: boolean; count: number | null; isAppreciated: boolean };
const unavailable: Summary = { available: false, count: null, isAppreciated: false };
const queue = new Map<number, Array<(summary: Summary) => void>>();
let scheduled = false;

// One batched request for all listing cards rendered in a frame, not an N+1 fetch.
// A missing database migration returns 'unavailable', never a misleading 0.
function loadSummary(id: number): Promise<Summary> {
  return new Promise(resolve => {
    const listeners = queue.get(id) ?? [];
    listeners.push(resolve);
    queue.set(id, listeners);
    if (scheduled) return;
    scheduled = true;
    setTimeout(async () => {
      scheduled = false;
      const entries = [...queue.entries()];
      queue.clear();
      for (let offset = 0; offset < entries.length; offset += 50) {
        const batch = entries.slice(offset, offset + 50);
        try {
          const response = await api<{ summaries: Record<number, Summary> }>(
            `/listing-appreciations?ids=${batch.map(([listingId]) => listingId).join(',')}`);
          batch.forEach(([key, callbacks]) => callbacks.forEach(done => done(response.summaries[key] ?? unavailable)));
        } catch {
          batch.forEach(([, callbacks]) => callbacks.forEach(done => done(unavailable)));
        }
      }
    }, 0);
  });
}

export function ListingAppreciation({ listingId, signedIn, readOnly = false, compact = false, showCount = !compact }: {
  listingId: number; signedIn: boolean; readOnly?: boolean; compact?: boolean; showCount?: boolean;
}) {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const request = useRef(0);
  const busyRef = useRef(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const version = ++request.current;
    setSummary(null); setLoadError(false);
    loadSummary(listingId).then(value => {
      if (version !== request.current) return;
      setSummary(value);
    }).catch(() => { if (version === request.current) setLoadError(true); });
    return () => { request.current++; };
  }, [listingId, signedIn]);

  useEffect(() => {
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<{ listingId: number; summary: Summary }>).detail;
      if (detail?.listingId !== listingId) return;
      request.current++;
      setSummary(detail.summary);
      setLoadError(false);
    };
    window.addEventListener('listing-appreciation-changed', sync);
    return () => window.removeEventListener('listing-appreciation-changed', sync);
  }, [listingId]);

  const publish = (value: Summary) => window.dispatchEvent(new CustomEvent('listing-appreciation-changed', {
    detail: { listingId, summary: value },
  }));
  const toggle = async () => {
    if (busyRef.current || readOnly) return;
    if (!summary?.available || loadError) return; // Disabled visually and semantically until DB activation.
    if (!signedIn) {
      navigate(`/login?next=${encodeURIComponent(`/listings/${listingId}`)}`);
      return;
    }
    busyRef.current = true; setBusy(true);
    const previous = summary;
    const removing = previous.isAppreciated;
    const optimistic: Summary = { available: true, count: Math.max(0, (previous.count ?? 0) + (removing ? -1 : 1)),
      isAppreciated: !removing };
    setSummary(optimistic); publish(optimistic);
    try {
      const result = await api<Summary>(`/listing-appreciations/${listingId}`, {
        method: removing ? 'DELETE' : 'PUT',
      });
      if (!result.available) throw new Error('Appreciation is not enabled yet.');
      setSummary(result); publish(result);
      // Re-rank the Popular homepage rail only after the server confirms the change.
      window.dispatchEvent(new Event('listing-appreciation-committed'));
      showActionFeedback({ kind: 'success', title: removing ? 'Appreciation removed' : 'Appreciation sent',
        message: removing ? 'Your appreciation was removed from this listing.' : 'You appreciated this listing.' });
    } catch (error) {
      setSummary(previous); publish(previous);
      showActionFeedback({ kind: 'error', title: 'Could not update appreciation',
        message: `${explain(error)} Your previous choice was restored.` });
    } finally { busyRef.current = false; setBusy(false); }
  };

  const available = summary?.available === true;
  const label = available
    ? !showCount
      ? summary.isAppreciated ? 'Unlike this listing' : 'Like this listing'
      : `${summary.isAppreciated ? 'Remove appreciation from' : 'Appreciate'} this listing; ${summary.count} appreciations`
    : 'Likes temporarily unavailable';
  return <span className={`listing-appreciation ${compact ? 'is-compact' : 'is-detail'} ${available ? '' : 'is-unavailable'}`}
    title={label}>
    {readOnly ? <span className="listing-appreciation-static" aria-label={label}>
      <Icon name="thumbsUp" size={18} filled={available && summary.isAppreciated} />
      {showCount && <span>{available ? summary.count : '—'}</span>}
    </span> : <button type="button" className="listing-appreciation-action" aria-label={label}
      aria-pressed={available && Boolean(summary?.isAppreciated)} aria-busy={busy}
      disabled={busy || !available} onClick={() => void toggle()}>
      <Icon name="thumbsUp" size={18} filled={available && summary.isAppreciated} />
      {showCount && <span aria-live="polite">{available ? summary.count?.toLocaleString('en-PH') : '—'}</span>}
    </button>}
  </span>;
}
