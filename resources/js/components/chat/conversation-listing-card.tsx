import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Icon } from '@/components/icons';
import { peso } from '@/lib/api';

export type ConversationListing = {
  id: number; title: string; type: 'physical_product' | 'service'; price: number;
  priceBasis: string | null; condition: string | null;
  availability: 'available' | 'reserved' | 'sold' | 'unavailable'; imageUrl: string | null;
};

type Props = {
  listing: ConversationListing;
  compact?: boolean;
  onNavigate?: () => void;
};

// A single listing-context presentation for full conversations and the floating chat.
// The thread's authorized API supplies the listing, including its unavailable state.
export function ConversationListingCard({ listing, compact = false, onNavigate }: Props) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const imageUrl = listing.imageUrl;
  const showPhoto = !!imageUrl && failedImage !== imageUrl;
  const availability = listing.availability === 'available' ? 'Available'
    : listing.availability === 'reserved' ? 'Reserved'
    : listing.availability === 'sold' ? 'Sold' : 'Listing unavailable';
  const kind = listing.type === 'service' ? 'Service' : 'Product';

  return <article className={`conversation-listing-card${compact ? ' is-compact' : ''}`}
    aria-label="Listing discussed in this conversation">
    <div className="conversation-listing-head">
      <span>{compact ? 'About this listing' : 'Listing details'}</span>
      <span className="conversation-listing-kind">{kind}</span>
    </div>
    <div className="conversation-listing-content">
      <div className="conversation-listing-photo">
        {showPhoto
          ? <img src={imageUrl} alt="" loading="lazy" decoding="async" onError={() => setFailedImage(imageUrl)} />
          : <span className="conversation-listing-photo-empty"><Icon name="tag" size={21} />
              <small>{imageUrl ? 'Photo unavailable' : 'No photo'}</small></span>}
      </div>
      <div className="conversation-listing-info">
        <strong title={listing.title}>{listing.title}</strong>
        <div className="conversation-listing-price">
          <b>{peso(listing.price)}</b>
          {listing.priceBasis && <span>{listing.priceBasis}</span>}
        </div>
        <div className="conversation-listing-meta">
          {listing.condition && <span>{listing.condition.replaceAll('_', ' ')}</span>}
          <span className={listing.availability === 'available' ? 'is-available' : ''}>{availability}</span>
        </div>
      </div>
    </div>
    <div className="conversation-listing-foot">
      {!compact && <span>Listing ID: <strong>#{listing.id}</strong></span>}
      {listing.availability !== 'unavailable'
        ? <Link to={`/listings/${listing.id}`} onClick={onNavigate}>View listing <Icon name="arrow" size={14} /></Link>
        : compact && <span>Listing cannot be opened</span>}
    </div>
  </article>;
}
