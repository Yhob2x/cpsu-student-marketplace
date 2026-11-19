import type { RequestHandler } from 'express';

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/** Internal-only readiness, distinct from public lightweight /health (liveness). */
export function makeReadinessHandler(checkDatabase: () => Promise<unknown>): RequestHandler {
  return async (req, res) => {
    // Both the physical peer and the resolved client IP must be loopback.
    // This refuses forwarded clients even when Nginx is itself on localhost.
    if (!LOOPBACK.has(req.socket.remoteAddress ?? '') || !LOOPBACK.has(req.ip ?? '')) {
      return res.status(404).end();
    }
    res.setHeader('Cache-Control', 'no-store');
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        checkDatabase(),
        new Promise<never>((_resolve, reject) => {
          watchdog = setTimeout(() => reject(new Error('readiness_timeout')), 1500);
        }),
      ]);
      return res.status(200).json({ ok: true });
    } catch {
      // Do not leak DB connection details to the caller.
      return res.status(503).json({ ok: false });
    } finally {
      if (watchdog) clearTimeout(watchdog);
    }
  };
}
