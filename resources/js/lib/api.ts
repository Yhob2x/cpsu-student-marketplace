let token: string | null = null;
export class ApiError extends Error { constructor(public status: number, public code: string, msg?: string) { super(msg || code); } }

async function raw(path: string, init: RequestInit, unversioned = false) {
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(`${unversioned ? '/api' : '/api/v1'}${path}`, { ...init, headers, credentials: 'include' });
}
async function refreshNow() {
  const r = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' });
  if (r.status === 204) { token = null; return false; }
  if (!r.ok) { token = null; return false; }
  token = (await r.json()).accessToken; return true;
}

// Exactly one refresh may be in flight: the API rotates the refresh token and revokes every session when a spent one is
// presented, so two parallel calls look like theft and log the user out. React StrictMode double-mounts effects, which
// made that race routine on a hard reload of a signed-in page.
let restoring: Promise<boolean> | null = null;
export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; form?: FormData; unversioned?: boolean } = {}): Promise<T> {
  const init: RequestInit = { method: opts.method ?? (opts.body || opts.form ? 'POST' : 'GET') };
  if (opts.form) init.body = opts.form;
  else if (opts.body !== undefined) { init.body = JSON.stringify(opts.body); init.headers = { 'Content-Type': 'application/json' }; }
  const send = () => raw(path, init, opts.unversioned);
  let res = await send();
  if (res.status === 401 && !path.startsWith('/auth/') && await tryRestoreSession()) res = await send();
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (res.status === 429) throw new ApiError(429, 'rate_limited');
  if (!res.ok) throw new ApiError(res.status, data?.error?.code ?? 'error', data?.error?.message);
  return data as T;
}
export async function apiBlob(path: string): Promise<Blob> {
  let res = await raw(path, { method: 'GET' });
  if (res.status === 401 && await tryRestoreSession()) res = await raw(path, { method: 'GET' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data?.error?.code ?? 'error', data?.error?.message);
  }
  return res.blob();
}
export const setToken = (t: string | null) => { token = t; };
export const tryRestoreSession = (): Promise<boolean> => {
  if (!restoring) restoring = refreshNow().finally(() => { restoring = null; });
  return restoring;
};
export const peso = (n: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(n);

export const timeAgo = (iso: string) => {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
};

// Plain-language messages for API error codes.
const MESSAGES: Record<string, string> = {
  invalid_credentials: 'Email or password is incorrect.', email_taken: 'That email already has an account.',
  home_page_editor_unavailable: 'Homepage editing needs its database migration before it can be used here.',
  managed_content_unavailable: 'This content editor is not enabled in this environment. An approved database migration is required. No content has been changed.',
  draft_changed: 'Another administrator changed this draft. Reload the editor before saving or publishing.',
  already_published: 'This draft is already published.',
  invalid_campus: 'Choose an active CPSU campus.',
  catalog_duplicate: 'A campus code or category with this name already exists. Choose a different one.',
  campus_in_use: 'This campus has linked records. Confirm the deactivation before proceeding.',
  invalid_id: 'This item could not be found. Refresh the page and try again.',
  student_identity_registration_unavailable: 'Private student ID collection is not enabled yet. Refresh this form or contact campus support.',
  student_account_required: 'Staff accounts cannot use student marketplace actions.',
  reviewer_scope_changed: 'This reviewer changed while you were editing. Reload and try again.',
  reviewer_affiliation_required: 'The student needs a current, verified affiliation with that campus.',
  inactive_student: 'Only active student accounts can become reviewers.',
  reviewer_assignment_conflict: 'This account changed while assigning its role. Refresh and try again.',
  staff_account_protected: 'This account already has a staff role and cannot be reassigned here.',
  affiliation_not_verified: 'Your CPSU affiliation is still being verified. You can sell once a reviewer approves it.',
  category_prohibited: 'This category is not allowed on your campus.', missing_images: 'Add at least one photo before submitting.',
  incomplete_listing: 'Add at least one photo and a price before submitting.', not_editable: 'This listing is in review or closed and cannot be edited.',
  invalid_image: 'Upload a valid JPEG, PNG or WebP photo up to 3 MB and 24 megapixels.',
  avatar_explicit_content: 'This photo appears to contain explicit content. Your current store picture is unchanged. Choose another photo.',
  avatar_uncertain_content: 'We cannot confirm this photo meets the store profile rules. Your current picture remains unchanged; choose a different photo.',
  avatar_screening_unavailable: 'Photo safety screening is temporarily unavailable. Your current picture is unchanged. Please try again later.',
  avatar_screening_busy: 'Too many photos are being checked right now. Your current picture is unchanged. Try again shortly.',
  photo_review_required: 'Inspect every listing photo and confirm the content rules before approving.',
  store_exists: 'You already have a store.', own_listing: 'This is your own listing.', validation_error: 'Please check the highlighted fields.',
  own_store_follow: 'You cannot follow your own store.',
  store_reviews_not_ready: 'Store ratings are not enabled yet. Campus moderation and database setup are still being prepared.',
  appreciations_not_ready: 'Listing appreciation needs database activation. Nothing was changed.',
  cannot_appreciate_own_listing: 'You cannot appreciate your own listing.',
  stock_not_ready: 'Stock quantities are not active yet. The inventory database and API must both be ready.',
  stock_record_missing: 'Inventory for this item needs repair. Contact campus support before accepting this request.',
  initial_stock_required: 'A new product must start with at least one item in stock.',
  out_of_stock: 'This product has no available stock. Restock it before accepting requests.',
  cannot_appreciate_own_store: 'You cannot appreciate your own store.',
  verified_student_required: 'A current verified CPSU student affiliation is required for this action.',
  completed_transaction_required: 'Only the buyer of a completed transaction can rate this store.',
  already_reviewed: 'You have already rated this completed transaction.',
  invalid_review_state: 'This review has changed since you opened it. Refresh the review queue.',
  store_follows_unavailable: 'Store following is not available yet. Please try again after it is enabled.',
  rate_limited: 'Too many attempts. Wait a few minutes and try again.',
  student_verification_required: 'Purchase requests require an active, verified student account without an administrative role.',
  listing_unavailable: 'This listing is no longer available for a new request.',
  thread_closed: 'This conversation has ended. You can read earlier messages, but neither student can send new ones here.',
  listing_under_review: 'This listing is no longer published. You can cancel the transaction or contact the campus reviewer.',
  transaction_reservation_active: 'An active purchase request has reserved this item. Resolve or cancel that transaction first.',
  invalid_transaction_state: 'This action is no longer available at the current transaction stage. Refresh the transaction.',
  already_confirmed_or_changed: 'You already confirmed this step, or the transaction changed. Refresh to see the latest status.',
  meetup_location_locked: 'Meetup details cannot be changed because the transaction closed or completion began. Refresh to view its status.',
  meetup_reconfirmation_required: 'This meetup was already confirmed. Approve resetting both confirmations, then save the new meeting point.',
  concurrent_transaction_conflict: 'Someone else updated this item at the same time. Refresh and try again.',
  reservation_changed: 'This reservation changed while you were updating it. No transaction state was changed.',
  not_found: 'That record is unavailable or you do not have permission to view it.',
};

export const explain = (e: unknown) => e instanceof ApiError ? (MESSAGES[e.code] ?? e.message) : 'Something went wrong. Check your connection and try again.';
