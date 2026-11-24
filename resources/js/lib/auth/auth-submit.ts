/** Prevent a second form submission while the first request is pending. */
export async function runExclusive(lock: { current: boolean }, action: () => Promise<void>): Promise<boolean> {
  if (lock.current) return false;
  lock.current = true;
  try {
    await action();
    return true;
  } finally {
    lock.current = false;
  }
}
