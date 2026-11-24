import { createHash } from 'node:crypto';

/**
 * Public URL for the seller's current avatar. The version is derived from the
 * private storage reference, never exposing the Drive ID or server path.
 * A different uploaded file always gets a different URL, defeating stale
 * browser image reuse without requiring a schema change.
 */
export function sellerAvatarUrl(storeId: number, mediaPath: string | null | undefined): string | null {
  if (!mediaPath) return null;
  const version = createHash('sha256').update(mediaPath).digest('hex').slice(0, 16);
  return `/api/v1/media/seller-avatar/${storeId}?v=${version}`;
}
