// Only return to known, same-origin app routes after authentication.
const ALLOWED_RETURN = /^\/(?:inquiries\/[1-9]\d*|transactions(?:\/[1-9]\d*)?|notifications|profile|saved|listings\/[1-9]\d*)$/;

export function safeLoginReturn(requested: string | null): string {
  return requested && ALLOWED_RETURN.test(requested) ? requested : '/';
}
