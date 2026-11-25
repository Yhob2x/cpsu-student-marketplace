/**
 * A stale browser push endpoint can belong to the previous person who signed in
 * on this shared device. When the ownership API is unreachable, fail closed:
 * detach the browser endpoint locally instead of displaying another account's
 * notifications. Never auto-register it for the new account without consent.
 *
 * A second check avoids revoking an endpoint simultaneously enrolled through an
 * explicit Enable click. Ignore late results after the active account changes.
 */
export async function reconcilePushOwnership(
  checkOwned: () => Promise<boolean>,
  detach: () => Promise<boolean>,
  stillCurrent: () => boolean,
): Promise<'owned' | 'detached' | 'cancelled'> {
  if (!stillCurrent()) return 'cancelled';

  try {
    if (await checkOwned()) return stillCurrent() ? 'owned' : 'cancelled';
    if (!stillCurrent()) return 'cancelled';
    if (await checkOwned()) return stillCurrent() ? 'owned' : 'cancelled';
  } catch {
    // Unknown ownership (network/server error) is not permission to retain a
    // potentially previous account's subscription on a shared device.
  }

  if (!stillCurrent()) return 'cancelled';
  if (!await detach()) {
    // PushSubscription.unsubscribe() may resolve false without throwing.
    // Do not report a previous student's endpoint as detached in that case.
    throw new Error('This browser could not remove the previous push subscription.');
  }
  return 'detached';
}

/**
 * Explicit device opt-out: revoke the server capability first and only then
 * remove the browser subscription. A false return is not successful opt-out.
 * Failed requests remain visible to the user rather than silently succeeding.
 */
export async function revokePushOnDevice(
  revokeServer: () => Promise<unknown>,
  unsubscribeBrowser: () => Promise<boolean>,
): Promise<void> {
  await revokeServer();
  const removed = await unsubscribeBrowser();
  if (!removed) {
    throw new Error('The server disabled alerts, but this browser could not remove its subscription. Please try again.');
  }
}
