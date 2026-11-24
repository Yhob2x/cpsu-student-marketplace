import { useEffect, useRef, useState } from 'react';
import { api, ApiError, explain } from './api';
import { Icon } from './icons';
import { showActionFeedback } from './action-feedback';
import './store-appreciation.css';

type Appreciation = { available: boolean; count: number | null; isAppreciated: boolean };
export function StoreAppreciation({ storeId, signedIn = false, onSignIn, readOnly = false }: {
  storeId: number; signedIn?: boolean; onSignIn?: () => void; readOnly?: boolean;
}) {
  const [data, setData] = useState<Appreciation | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [routeMissing, setRouteMissing] = useState(false);
  const request = useRef(0);
  const inFlight = useRef(false);

  const load = () => {
    const latest = ++request.current;
    setLoading(true); setError(''); setRouteMissing(false);
    api<Appreciation>(`/seller-profiles/${storeId}/appreciations`)
      .then(result => { if (latest === request.current) setData(result); })
      .catch(e => {
        if (latest !== request.current) return;
        if (e instanceof ApiError && e.status === 404) {
          setRouteMissing(true);
          setData({ available: false, count: null, isAppreciated: false });
        } else { setData(null); setError(explain(e)); }
      })
      .finally(() => { if (latest === request.current) setLoading(false); });
  };
  useEffect(() => {
    setData(null); load();
    return () => { request.current++; };
  }, [storeId, signedIn]);

  // Both public actions and the facts row read the same real server count.
  // Sync the displayed statistic immediately after this viewer updates it.
  useEffect(() => {
    if (!readOnly) return;
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<{ storeId: number; summary: Appreciation }>).detail;
      if (detail?.storeId !== storeId) return;
      request.current++; // Ignore an older summary request arriving after the new total.
      setData(detail.summary);
      setError('');
      setRouteMissing(false);
      setLoading(false);
    };
    window.addEventListener('store-appreciation-changed', sync);
    return () => window.removeEventListener('store-appreciation-changed', sync);
  }, [readOnly, storeId]);

  const toggle = async () => {
    if (inFlight.current || busy || loading) return;
    if (!data?.available || error) {
      showActionFeedback({ kind: 'info', title: 'Appreciation unavailable',
        message: routeMissing ? 'This server does not have the appreciation feature yet.'
          : error ? 'Could not check appreciation. Try again.'
          : 'Appreciation requires database activation before it can be saved.' });
      if (error) load();
      return;
    }
    if (!signedIn) { onSignIn?.(); return; }
    inFlight.current = true; setBusy(true); setError('');
    const previous = data;
    const removing = previous.isAppreciated;
    const optimistic: Appreciation = { ...previous,
      isAppreciated: !removing,
      count: typeof previous.count === 'number' ? Math.max(0, previous.count + (removing ? -1 : 1)) : null,
    };
    const publish = (summary: Appreciation) => window.dispatchEvent(new CustomEvent('store-appreciation-changed', {
      detail: { storeId, summary },
    }));
    // Apply locally first; publish the server's authoritative total on completion.
    setData(optimistic); publish(optimistic);
    try {
      const result = await api<Appreciation>(`/store-appreciations/${storeId}`, {
        method: removing ? 'DELETE' : 'PUT',
      });
      if (!result.available) throw new Error('Appreciations are not available right now.');
      setData(result); publish(result);
      showActionFeedback({
        kind: 'success',
        title: removing ? 'Appreciation removed' : 'Appreciation sent',
        message: removing ? 'Your appreciation was removed.' : 'Thanks for supporting a fellow CPSU student.',
      });
    } catch (e) {
      setData(previous); publish(previous);
      showActionFeedback({ kind: 'error', title: 'Appreciation not synced', message: `${explain(e)} Your previous choice was restored.` });
    } finally { inFlight.current = false; setBusy(false); }
  };

  if (readOnly) return <div className="store-appreciation-fact" title="Appreciations are thank-yous, not verified reviews">
    <span>Appreciations</span>
    <strong role="status" aria-live="polite">{data?.available && !error && typeof data.count === 'number'
      ? data.count.toLocaleString('en-PH') : '—'}</strong>
  </div>;

  // Keep the action discoverable even when the API route or approved migration is not active.
  // Never display a fabricated zero count or allow a write while unavailable.
  const available = data?.available === true && !error;
  const pending = loading && !data;
  const hint = error ? 'Could not load appreciation.'
    : routeMissing ? 'Not enabled on this server.'
    : pending ? 'Checking availability…'
    : !available ? 'Awaiting database setup.' : '';
  return <span className={`store-appreciation${available ? '' : ' is-unavailable'}`}
    title={available ? 'Appreciate this store' : hint}>
    <button type="button" className="btn ghost store-appreciation-button storefront-icon-action"
      aria-pressed={available && data!.isAppreciated}
      aria-label={available
        ? `${data!.isAppreciated ? 'Remove appreciation' : 'Appreciate this store'}; ${data!.count === null ? 'count unavailable' : `${data!.count} appreciations`}`
        : `Appreciate this store — ${hint}`}
      title={available ? 'A thank-you, not a rating or CPSU endorsement' : hint}
      disabled={busy || loading}
      onClick={() => void toggle()}>
      <Icon name={available && data!.isAppreciated ? 'heartSolid' : 'heart'} size={21} />
    </button>
    {hint && <span className="sr-only" role={error ? 'alert' : 'status'}>{hint}</span>}
  </span>;
}
