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

test('shutdown deadline still fires if HTTP closes but Prisma disconnect never resolves', async () => {
  const steps: string[] = [];
  const server = {
    close(callback: (error?: Error) => void) {
      steps.push('close');
      queueMicrotask(callback);
    },
    closeAllConnections() { steps.push('force-close'); },
  } as unknown as Pick<Server, 'close' | 'closeAllConnections'>;
  let resolveDeadline!: () => void;
  const deadline = new Promise<void>(resolve => { resolveDeadline = resolve; });
  const shutdown = createShutdown(server, () => {
    steps.push('disconnect');
    return new Promise<void>(() => {});
  }, {
    timeoutMs: 15,
    log: () => {},
    onTimeout: () => { steps.push('timed-out'); resolveDeadline(); },
  });
  shutdown('SIGTERM');
  shutdown('SIGINT');
  await deadline;
  expect(steps).toEqual(['close', 'disconnect', 'force-close', 'timed-out']);
}, 1000);
