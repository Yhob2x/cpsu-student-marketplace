import { expect, test } from 'bun:test';
import type { Server } from 'node:http';
import { createShutdown } from '../src/graceful-shutdown.js';

test('graceful shutdown is idempotent and disconnects only after HTTP drain', async () => {
  const order: string[] = [];
  let finish!: () => void;
  const finished = new Promise<void>(resolve => { finish = resolve; });
  const server = {
    close(callback: (error?: Error) => void) {
      order.push('close');
      queueMicrotask(() => callback());
    },
    closeAllConnections() { order.push('force-close'); },
  } as unknown as Pick<Server, 'close' | 'closeAllConnections'>;
  const shutdown = createShutdown(server, async () => {
    order.push('disconnect');
  }, { timeoutMs: 1000, log(message) {
    const record = JSON.parse(message) as { event: string };
    if (record.event === 'api_shutdown_complete') finish();
  } });
  shutdown('SIGTERM');
  shutdown('SIGINT');
  await finished;
  expect(order).toEqual(['close', 'disconnect']);
});
