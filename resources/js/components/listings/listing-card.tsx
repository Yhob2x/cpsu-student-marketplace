import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Icon } from '@/components/icons';
import { SellerAvatar } from '@/components/stores/seller-avatar';
import { peso } from '@/lib/api';
import { useMe } from '@/providers/session-provider';
import type { Listing } from '@/types/listing';


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
  const lowStock = l.type === 'physical_product' && typeof l.stockQuantity === 'number' && l.stockQuantity <= 3;
  // Whole-card link and a separate save control. Labels and prices reflect real listing data only.
  return (
    <article className="card product-card market-card">
      <Link to={`/listings/${l.id}`} className="card-link" aria-label={`View ${l.title}`} />
      <div className="img product-photo market-card__photo">
        {showImage
          ? <img src={imageSrc} alt="" loading={priority ? 'eager' : 'lazy'} decoding="async" onError={() => setFailedImageSrc(imageSrc)} />
          : <span className="photo-placeholder"><Icon name="tag" size={30} /><span>{imageSrc ? 'Photo unavailable' : 'No photo yet'}</span></span>}
        <span className={`market-card__badge market-card__badge--${l.type === 'service' ? 'service' : 'sale'}`}>{l.type === 'service' ? 'Service' : 'For Sale'}</span>
        {l.availability !== 'available'
          ? <span className="market-card__status">{l.availability.replaceAll('_', ' ')}</span>
          : lowStock && <span className={'market-card__status' + (l.stockQuantity === 0 ? ' is-empty' : '')}>{l.stockQuantity === 0 ? 'Out of stock' : `Only ${l.stockQuantity} left`}</span>}
        {l.images.length > 1 && <span className="product-photo-multiple">{l.images.length} photos</span>}
        {!staff && <button type="button" className="listing-save-btn market-card__save" aria-pressed={saved} aria-label={saveLabel}
          title={saveLabel} aria-busy={busy || saveSyncing} disabled={busy || saveSyncing || !canSave} onClick={flip}>
          <Icon name={saved ? 'heartSolid' : 'heart'} size={18} /><span className="sr-only">{saved ? 'Saved' : 'Save'}</span></button>}
      </div>
      <div className="listing-card-body market-card__body">
        <h3 title={l.title}>{l.title}</h3>
        <p className="market-card__price">
          <span className="price">{peso(l.price)}</span>
          {/[a-z]/i.test(l.priceBasis ?? '') && l.priceBasis.trim().toLowerCase() !== 'per item' && <span className="price-unit" title={l.priceBasis}>{l.priceBasis}</span>}
        </p>
        <p className="seller seller-byline listing-seller-row market-card__seller">
          <SellerAvatar name={l.seller.storeName} src={l.seller.avatarUrl} size="small" />
          <Link className="seller-store-link listing-seller-name" title={l.seller.storeName} to={`/stores/${l.seller.id}`}>
            <span><span className="sr-only">By </span>{l.seller.storeName}</span>
          </Link>
          <span className="market-card__verified" role="img" aria-label="Verified CPSU student store"><Icon name="verified" size={14} /></span>
          {l.seller.rating && l.seller.rating.count > 0 && Number.isFinite(l.seller.rating.average) &&
            <span className="listing-store-rating" role="img"
              aria-label={`Store rating ${l.seller.rating.average.toFixed(1)} out of 5 from ${l.seller.rating.count} published ${l.seller.rating.count === 1 ? 'review' : 'reviews'}`}>
              <Icon name="star" size={12} filled />
              <span>{l.seller.rating.average.toFixed(1)}</span>
            </span>}
          <span className="market-card__campus" title={l.campus.name}>{l.campus.name.replace(/\s*campus$/i, '')}</span>
        </p>
        <p className="market-card__category">{l.category.name}{l.condition && <> · {l.condition.replace('_', ' ')}</>}</p>
        {saveError && <p className="card-save-feedback" role="alert">{saveError}</p>}
      </div>
    </article>
  );
}
