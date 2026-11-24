import type { Server } from 'node:http';

/** Drain active HTTP requests and disconnect Prisma within a single deadline. */
export function createShutdown(
  server: Pick<Server, 'close' | 'closeAllConnections'>,
  disconnect: () => Promise<void>,
  options: { timeoutMs?: number; log?: (message: string) => void; onTimeout?: () => void } = {},
) {
  let stopping = false;
  let timedOut = false;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const log = options.log ?? (message => console.info(message));

  return (signal: 'SIGINT' | 'SIGTERM') => {
    if (stopping) return;
    stopping = true;
    log(JSON.stringify({ event: 'api_shutdown_start', signal }));
    // The deadline must cover BOTH HTTP drain and Prisma disconnect. Clearing it
    // when the HTTP server closes would allow a hung DB disconnect to block exit.
    const watchdog = setTimeout(() => {
      timedOut = true;
      log(JSON.stringify({ event: 'api_shutdown_timeout', timeoutMs }));
      server.closeAllConnections?.();
      // systemd or the orchestrator must be able to restart an unhealthy process.
      // Inject only for isolated unit tests; never silently continue in production.
      if (options.onTimeout) options.onTimeout();
      else process.exit(1);
    }, timeoutMs);

    server.close(error => {
      if (timedOut) return;
      void Promise.resolve().then(disconnect).then(() => {
        if (timedOut) return;
        if (error) process.exitCode = 1;
        log(JSON.stringify({ event: 'api_shutdown_complete', ok: !error }));
      }).catch(() => {
        if (timedOut) return;
        process.exitCode = 1;
        log(JSON.stringify({ event: 'api_shutdown_disconnect_failed' }));
      }).finally(() => clearTimeout(watchdog));
    });
  };
}
