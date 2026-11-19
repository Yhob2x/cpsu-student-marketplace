import type { Server } from 'node:http';

/** Drain requests before releasing Prisma connections during service restarts. */
export function createShutdown(
  server: Pick<Server, 'close' | 'closeAllConnections'>,
  disconnect: () => Promise<void>,
  options: { timeoutMs?: number; log?: (message: string) => void } = {},
) {
  let stopping = false;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const log = options.log ?? (message => console.info(message));

  return (signal: 'SIGINT' | 'SIGTERM') => {
    if (stopping) return;
    stopping = true;
    log(JSON.stringify({ event: 'api_shutdown_start', signal }));
    const watchdog = setTimeout(() => {
      console.error(JSON.stringify({ event: 'api_shutdown_timeout', timeoutMs }));
      process.exitCode = 1;
      // Stop lingering keep-alive connections only after the drain deadline.
      server.closeAllConnections?.();
    }, timeoutMs);
    server.close(error => {
      clearTimeout(watchdog);
      void disconnect().then(() => {
        if (error) process.exitCode = 1;
        log(JSON.stringify({ event: 'api_shutdown_complete', ok: !error }));
      }).catch(() => {
        process.exitCode = 1;
        console.error(JSON.stringify({ event: 'api_shutdown_disconnect_failed' }));
      });
    });
  };
}
