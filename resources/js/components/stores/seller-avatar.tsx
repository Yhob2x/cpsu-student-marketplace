import { useState } from 'react';

type AvatarSize = 'small' | 'medium' | 'large';

export function SellerAvatar({ name, src, size = 'medium' }: {
  name: string; src?: string | null; size?: AvatarSize;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = (words.length > 1 ? words[0][0] + words[words.length - 1][0]
    : words[0]?.slice(0, 2) || 'S').toLocaleUpperCase();
  const showPhoto = Boolean(src && failedSrc !== src);
  return <span className={`seller-avatar seller-avatar--${size}`} aria-hidden="true">
    {showPhoto ? <img src={src!} alt="" loading="lazy" decoding="async" onError={() => setFailedSrc(src!)} />
      : <span className="seller-avatar__initials">{initials}</span>}
  </span>;
}
