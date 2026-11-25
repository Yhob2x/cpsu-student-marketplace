import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { showActionFeedback } from '@/components/action-feedback';
import { Icon } from '@/components/icons';
import { ListingAppreciation } from '@/components/listings/listing-appreciation';
import { ListingGallery } from '@/components/listings/listing-gallery';
import { ListingViews } from '@/components/listings/listing-views';
import { SellerAvatar } from '@/components/stores/seller-avatar';
import { ListingDetailSkeleton } from '@/components/ui/async-feedback';
import { LegacyButton } from '@/components/ui/legacy-button';
import { Field, Panel } from '@/components/ui/primitives';
import { api, explain, peso } from '@/lib/api';
import { isPublicNotFound, publicResourceLoadMessage } from '@/lib/public-resource-error';
import { useMe } from '@/providers/session-provider';
import type { Listing } from '@/types/listing';

export function ListingDetail() {
  const { id } = useParams(); const { me, ready, savedIds, pendingSavedIds, toggleSaved } = useMe();
  const navigate = useNavigate();
  const [l, setL] = useState<Listing | null>(null); const [body, setBody] = useState(''); const [note, setNote] = useState(''); const [err, setErr] = useState('');
  const [inquiryThreadId, setInquiryThreadId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const loadRequest = useRef(0);
  const [busy, setBusy] = useState(false); const [reporting, setReporting] = useState(false); const [reason, setReason] = useState('');
  const loadListing = () => {
    const request = ++loadRequest.current;
    setL(null); setLoadError(null); setInquiryThreadId(null); setNote(''); setErr('');
    api<Listing>(`/listings/${id}`).then(row => { if (request === loadRequest.current) setL(row); })
      .catch(e => { if (request === loadRequest.current) setLoadError(e); });
  };
  useEffect(() => { loadListing(); return () => { loadRequest.current++; }; }, [id]);
  useEffect(() => {
    // Wait for session restoration so a signed-in owner is never counted as a guest.
    if (!ready || !l || me?.storeId === l.seller.id || me?.roles.length) return;
    let active = true;
    // Only an actual listing-detail visit counts, not card display or preload.
    api<{ available: boolean; count: number | null }>(`/listings/${l.id}/view`, { method: 'POST' })
      .then(result => {
        if (active && result.available) {
          window.dispatchEvent(new CustomEvent('listing-view-confirmed', {
            detail: { listingId: l.id, available: true, count: result.count },
          }));
        }
      }).catch(() => { /* Viewing must remain usable if metrics are unavailable. */ });
    return () => { active = false; };
  }, [ready, l?.id, me?.storeId, me?.roles.length]);
  if (loadError && !l) return <Panel as="section" className="stack" role="alert">
    <h1>{isPublicNotFound(loadError) ? 'Listing unavailable' : 'Could not load this listing'}</h1>
    <p>{isPublicNotFound(loadError) ? 'This listing may have been removed or is no longer public.' : publicResourceLoadMessage(loadError)}</p>
    <div className="row">{!isPublicNotFound(loadError) && <LegacyButton type="button" className="" onClick={loadListing}>Retry listing</LegacyButton>}
      <Link className="btn ghost" to="/explore">Browse listings</Link></div>
  </Panel>;
  if (!l) return <ListingDetailSkeleton />;
  const loginForListing = `/login?next=${encodeURIComponent(`/listings/${l.id}`)}`;
  // Saved state comes from the shell (one fetch at sign-in), shared with the hearts on every card.
  const saved = savedIds.includes(l.id);
  const saveSyncing = pendingSavedIds.includes(l.id);
  const isOwner = me?.storeId === l.seller.id;
  const staff = me?.roles.some(role => ['campus_reviewer', 'university_admin', 'system_admin', 'establishment'].includes(role.role));
  const isAvailable = l.availability === 'available';
  const canRequest = Boolean(me && me.roles.length === 0 && me.affiliations.some(a => a.status === 'verified'));
  const send = async () => { setBusy(true); try { const r = await api<{ id: number }>('/inquiries', { body: { listingId: l.id, body } }); setBody(''); setInquiryThreadId(r.id); setNote('Message sent.'); setErr(''); showActionFeedback({ kind: 'success', title: 'Message sent', message: 'Your inquiry was sent to the seller.' }); } catch (e) { setErr(explain(e)); showActionFeedback({ kind: 'error', title: 'Message not sent', message: explain(e) }); } finally { setBusy(false); } };
  const requestTransaction = async () => {
    setBusy(true); setErr('');
    try {
      const created = await api<{ id: number }>('/transactions', { body: { listingId: l.id } });
      showActionFeedback({ kind: 'success', title: 'Request created', message: 'Your request is ready for the seller to review.', presentation: 'center' });
      navigate(`/transactions/${created.id}`);
    } catch (e) {
      setErr(explain(e));
      showActionFeedback({ kind: 'error', title: 'Request not created', message: explain(e) });
    } finally { setBusy(false); }
  };
  const save = async () => {
    if (!me) { navigate(loginForListing); return; }
    if (saveSyncing) return;
    setBusy(true);
    try {
      if (await toggleSaved(l.id, !saved)) { setInquiryThreadId(null); setNote(saved ? 'Removed from your saved list.' : 'Saved to your list.'); setErr(''); }
      else setErr('Could not update your saved list. Check you are still signed in.');
    } finally { setBusy(false); }
  };
  const report = async () => { setBusy(true); try { await api('/reports', { body: { listingId: l.id, reason } }); setReason(''); setReporting(false); setInquiryThreadId(null); setNote('Report sent to a campus reviewer.'); setErr(''); showActionFeedback({ kind: 'success', title: 'Report submitted', message: 'A campus reviewer will review your report.', presentation: 'center' }); } catch (e) { setErr(explain(e)); showActionFeedback({ kind: 'error', title: 'Report not submitted', message: explain(e) }); } finally { setBusy(false); } };
  // One button, two homes: over the first photo when there is one, in the action row when there is not.
  const heartLabel = !me ? 'Sign in to save this listing' : saved ? 'Remove from saved' : 'Save for later';
  const heart = <button className="heart-btn" aria-pressed={saved} aria-label={heartLabel}
    title={heartLabel} aria-busy={busy || saveSyncing} disabled={busy || saveSyncing} onClick={save}>
    <Icon name="heart" filled={saved} size={22} /></button>;
  const isService = l.type === 'service';
  const priceBasisLabel = /[a-z]/i.test(l.priceBasis ?? '') ? l.priceBasis : '';
  const conditionLabel = l.condition ? l.condition.replaceAll('_', ' ') : '';
  return <article className="listing-detail listing-detail-refined">
    <Link className="listing-back" to="/explore"><Icon name="chevronLeft" size={17} /> Browse all listings</Link>
    <div className="listing-detail-layout">
      <ListingGallery key={l.id} photos={l.images} title={l.title}
        saveControl={!staff && !isOwner && (isAvailable || saved) ? heart : undefined} />
      <div className="listing-detail-content">
        <header className="listing-detail-intro">
          <div className="listing-detail-overline">
            <span>{isService ? 'Service' : 'Product'}</span>
            <span className="listing-detail-overline-dot" aria-hidden="true" />
            <span>{l.category.name}</span>
          </div>
          <h1 className="listing-detail-title">{l.title}</h1>
          <div className="listing-detail-price-row">
            <strong className="listing-detail-price">{peso(l.price)}</strong>
            {priceBasisLabel && <span className="listing-detail-price-basis">{priceBasisLabel}</span>}
            <span className={`listing-detail-availability ${isAvailable ? 'is-available' : 'is-unavailable'}`}>
              {isAvailable ? 'Available' : l.availability.replaceAll('_', ' ')}
            </span>
          </div>
          {conditionLabel && <p className="listing-detail-condition">Condition: <strong>{conditionLabel}</strong></p>}
          <div className="listing-detail-stock-actions">
            {!isService && typeof l.stockQuantity === 'number' && <span className={`listing-stock-label ${l.stockQuantity === 0 ? 'is-empty' : l.stockQuantity <= 3 ? 'is-low' : ''}`}>
              <Icon name="package" size={17} /> {l.stockQuantity === 0 ? 'Out of stock' : `${l.stockQuantity} ${l.stockQuantity === 1 ? 'item' : 'items'} in stock`}
            </span>}
            <ListingAppreciation listingId={l.id} signedIn={Boolean(me)} readOnly={isOwner || Boolean(staff)} />
            <ListingViews listingId={l.id} />
          </div>
        </header>

        <section className="listing-detail-seller-card" aria-label="Seller information">
          <SellerAvatar name={l.seller.storeName} src={l.seller.avatarUrl} size="medium" />
          <div className="listing-detail-seller-details">
            <span className="listing-detail-seller-kicker">{isService ? 'Service offered by' : 'Listed by'}</span>
            <Link to={`/stores/${l.seller.id}`} className="listing-detail-seller-name">{l.seller.storeName}</Link>
            <span className="listing-detail-seller-location"><Icon name="pin" size={15}/>{l.campus.name}</span>
          </div>
          <Link className="listing-detail-view-store" to={`/stores/${l.seller.id}`}>View store <Icon name="arrow" size={15}/></Link>
        </section>

        <section className="listing-detail-about" aria-labelledby="listing-about-title">
          <h2 id="listing-about-title">About this {isService ? 'service' : 'listing'}</h2>
          <p className="listing-description">{l.description?.trim() || 'No description provided.'}</p>
          {l.handoffNote && <p className="listing-detail-handoff"><Icon name="pin" size={16}/><span><strong>Handoff details:</strong> {l.handoffNote}</span></p>}
        </section>

        {isOwner ? <section className="listing-detail-action-card listing-owner-card" aria-label="Manage your listing">
          <div className="listing-detail-owner-heading"><Icon name="check" size={18}/><strong>This is your listing</strong></div>
          <p>Buyers can view this page and contact your store. To update the details, manage it from My Store.</p>
          {l.status && <span className="listing-detail-owner-status">Status: {l.status.replaceAll('_', ' ')}</span>}
          <Link className="btn listing-detail-primary-action" to="/dashboard">Manage in My Store <Icon name="arrow" size={17}/></Link>
        </section> : staff ? <section className="listing-detail-action-card" aria-label="Staff account notice">
          <h2>Viewing as staff</h2>
          <p>Student purchase and messaging features are not available to staff accounts.</p>
        </section> : <section className="listing-detail-action-card" aria-labelledby="listing-contact-heading">
          <h2 id="listing-contact-heading">{isAvailable ? 'Interested in this listing?' : 'Listing unavailable'}</h2>
          {!isAvailable
            ? <p className="listing-detail-action-help" role="status">This listing is {l.availability.replaceAll('_', ' ')}. New inquiries and requests are currently unavailable.</p>
            : !me ? <div className="listing-detail-signin">
                <p>Sign in with your CPSU account to message the seller or request this {isService ? 'service' : 'item'}.</p>
                <Link className="btn listing-detail-primary-action" to={loginForListing}>Sign in to contact seller</Link>
              </div>
            : <>
                <div className="listing-detail-request-row">
                  <div>
                    <strong>{isService ? 'Request this service' : 'Request this item'}</strong>
                    <p>Send the seller a request to review, then discuss the arrangements in chat.</p>
                  </div>
                  <LegacyButton type="button" className="listing-detail-primary-action" disabled={busy || !canRequest}
                    onClick={() => void requestTransaction()}>{isService ? 'Request service' : 'Request item'}</LegacyButton>
                </div>
                {!canRequest && <p className="listing-detail-action-help">Requests require a verified CPSU student account.</p>}
                <div className="listing-detail-message-block">
                  <h3>Message the seller</h3>
                  <Field className="listing-detail-message-field">
                    <span>Your message</span>
                    <textarea value={body} onChange={e => setBody(e.target.value)}
                      maxLength={1000} rows={3} placeholder="Hi! Is this still available?" />
                  </Field>
                  <div className="listing-detail-message-actions">
                    <LegacyButton type="button" className="ghost" disabled={busy || !body.trim()}
                      onClick={() => void send()}>{busy ? 'Sending…' : 'Send message'}</LegacyButton>
                    {l.images.length === 0 && (isAvailable || saved) && heart}
                  </div>
                </div>
              </>}
          {me && <div className="listing-detail-report-area">
            <button type="button" className="listing-detail-report-toggle" disabled={busy}
              aria-expanded={reporting} onClick={() => { setReporting(!reporting); setErr(''); }}>
              <Icon name="flag" size={16}/> Report this listing
            </button>
            {reporting && <div className="listing-detail-report-form">
              <Field className=""><span>Reason for reporting</span>
                <textarea value={reason} onChange={e => setReason(e.target.value)}
                  maxLength={1000} placeholder="Describe the issue (at least 10 characters)" />
              </Field>
              <div className="row">
                <LegacyButton type="button" className="danger" disabled={busy || reason.trim().length < 10}
                  onClick={() => void report()}>Send report</LegacyButton>
                <LegacyButton type="button" className="ghost" disabled={busy}
                  onClick={() => setReporting(false)}>Cancel</LegacyButton>
              </div>
            </div>}
          </div>}
          {note && <p className="listing-detail-feedback" role="status">{note} {inquiryThreadId !== null &&
            <Link to={`/inquiries/${inquiryThreadId}`}>Open conversation</Link>}</p>}
          {err && <p className="err" role="alert">{err}</p>}
        </section>}
        <p className="listing-detail-safety-note"><Icon name="shield" size={17}/>
          Payment and pickup are arranged directly between students. CPSU Market does not hold payments or deliver items.
        </p>
      </div>
    </div>
  </article>;
}
