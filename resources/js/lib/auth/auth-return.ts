// Only return to known, same-origin app routes after authentication.
const ALLOWED_RETURN = /^\/(?:dashboard|inquiries(?:\/[1-9]\d*)?|transactions(?:\/[1-9]\d*)?|notifications|profile|saved|listings\/[1-9]\d*|stores\/[1-9]\d*)$/;

function isStoreSlugReturn(requested: string): boolean {
  const match = /^\/store\/([^/?#]+)$/.exec(requested);
  if (!match) return false;
  try {
    const slug = decodeURIComponent(match[1]);
    return /^[\p{Letter}\p{Number}]+(?:-[\p{Letter}\p{Number}]+)*(?:--[1-9]\d*)?$/u.test(slug)
      && (match[1] === slug || encodeURIComponent(slug) === match[1]);
  } catch { return false; }
}

export function safeLoginReturn(requested: string | null): string {
  return requested && (ALLOWED_RETURN.test(requested) || isStoreSlugReturn(requested)) ? requested : '/';
}
