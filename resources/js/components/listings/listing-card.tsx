import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Icon } from '@/components/icons';
import { peso } from '@/lib/api';
import { useMe } from '@/providers/session-provider';
import type { Listing } from '@/types/listing';

import { ListingAppreciation } from './listing-appreciation';
import { ListingViews } from './listing-views';

export function ListingCard({ l, priority = false }: { l: Listing; priority?: boolean }) {
  const nav = useNavigate();
  const { me, savedIds, pendingSavedIds, toggleSaved } = useMe();
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [failedImageSrc, setFailedImageSrc] = useState<string | null>(null);
  const imageSrc = l.images[0];
  const showImage = Boolean(imageSrc && failedImageSrc !== imageSrc);
  const saved = savedIds.includes(l.id);
  const saveSyncing = pendingSavedIds.includes(l.id);
  const isOwner = me != null && me.storeId === l.seller.id;
  const staff = me?.roles.some(role => ['campus_reviewer', 'university_admin', 'system_admin', 'establishment'].includes(role.role));
  const canSave = !staff && !isOwner && (l.availability === 'available' || saved);
  const saveLabel = isOwner ? 'You cannot save your own listing'
    : !canSave ? 'This listing is not available to save'
    : !me ? 'Sign in to save this listing'
    : saved ? 'Remove from saved' : 'Save for later';
  const flip = async () => {
    if (!canSave || busy || saveSyncing) return;
    setSaveError('');
    if (!me) { nav(`/login?next=${encodeURIComponent(`/listings/${l.id}`)}`); return; }
    setBusy(true);
    try {
      if (!await toggleSaved(l.id, !saved)) setSaveError('Could not update saved listings. Try again.');
    } catch {
      setSaveError('Could not update saved listings. Try again.');
    } finally { setBusy(false); }
  };
  // Whole-card link and a separate save control. Labels and prices reflect real listing data only.
  return (
    <article className="card product-card">
      <Link to={`/listings/${l.id}`} className="card-link" aria-label={`View ${l.title}`} />
      <div className="img product-photo">
        {showImage
          ? <img src={imageSrc} alt="" loading={priority ? 'eager' : 'lazy'} decoding="async" onError={() => setFailedImageSrc(imageSrc)} />
          : <span className="photo-placeholder"><Icon name="tag" size={30} /><span>{imageSrc ? 'Photo unavailable' : 'No photo yet'}</span></span>}
        {l.images.length > 1 && <span className="product-photo-multiple">{l.images.length} photos</span>}
        {!staff && <button type="button" className="listing-save-btn" aria-pressed={saved} aria-label={saveLabel}
          title={saveLabel} aria-busy={busy || saveSyncing} disabled={busy || saveSyncing || !canSave} onClick={flip}>
          <Icon name="folder" size={16} /><span>{saved ? 'Saved' : 'Save'}</span></button>}
      </div>
      <div className="listing-card-body">
        <div className="listing-card-heading">
          <h3 title={l.title}>{l.title}</h3>
          <p className="seller seller-byline listing-seller-row">
            <Link className="seller-store-link listing-seller-name" title={l.seller.storeName} to={`/stores/${l.seller.id}`}>
              <span><span aria-hidden="true">By </span>{l.seller.storeName}</span>
            </Link>
            {l.seller.rating && l.seller.rating.count > 0 && Number.isFinite(l.seller.rating.average) &&
              <span className="listing-store-rating" role="img"
                aria-label={`Store rating ${l.seller.rating.average.toFixed(1)} out of 5 from ${l.seller.rating.count} published ${l.seller.rating.count === 1 ? 'review' : 'reviews'}`}>
                <Icon name="star" size={12} filled />
                <span>{l.seller.rating.average.toFixed(1)}</span>
              </span>}
          </p>
        </div>
        <div className="listing-card-summary">
          <div className="listing-card-price">
            <span className="price">{peso(l.price)}</span>
            {/[a-z]/i.test(l.priceBasis ?? '') && l.priceBasis.trim().toLowerCase() !== 'per item' && <span className="price-unit" title={l.priceBasis}>{l.priceBasis}</span>}
          </div>
          <div className="listing-card-meta">
            <span className="listing-kind">{l.type === 'service' ? 'Service' : 'Product'}</span>{' '}
            <span className="product-category" title={l.category.name}>{l.category.name}</span>
            {l.condition && <>{' '}<span className="listing-condition"><span aria-hidden="true">· </span>{l.condition.replace('_', ' ')}</span></>}
          </div>
          <div className="listing-card-engagement" aria-label="Listing engagement">
            <ListingAppreciation listingId={l.id} signedIn={Boolean(me)} readOnly={isOwner || Boolean(staff)} compact showCount />
            <ListingViews listingId={l.id} compact />
          </div>
        </div>
        <div className="listing-card-status">
          {l.type === 'physical_product' && typeof l.stockQuantity === 'number' &&
            <span className={`listing-stock-label ${l.stockQuantity === 0 ? 'is-empty' : l.stockQuantity <= 3 ? 'is-low' : ''}`}>
              {l.stockQuantity === 0 ? 'Out of stock' : `${l.stockQuantity} in stock`}
            </span>}
          {l.availability !== 'available' && <span className="listing-availability">{l.availability.replaceAll('_', ' ')}</span>}
        </div>
        {saveError && <p className="card-save-feedback" role="alert">{saveError}</p>}
        <p className="meta card-campus" title={l.campus.name}><Icon name="pin" size={13} /><span>{l.campus.name}</span></p>
      </div>
    </article>
  );
}
