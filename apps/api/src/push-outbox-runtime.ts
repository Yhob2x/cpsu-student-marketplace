import { prisma } from './db.js';
import { env } from './env.js';
import { pushDeliveryReady } from './push.js';
import { createPushRelay } from './push-delivery.js';
import { createPushOutboxDelivery } from './push-outbox-delivery.js';
import { PrismaPushLeasePort } from './push-outbox-repository.js';
import { PUSH_OUTBOX_WORKERS, runConfiguredPushOutboxTick } from './push-outbox-worker.js';

const POLL_INTERVAL_MS = 2_000;

export function startPushOutbox(): () => Promise<void> {
  const { VAPID_SUBJECT: subject, VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey } = env;
  if (!pushDeliveryReady || !subject || !publicKey || !privateKey) return async () => {};

  const stop = new AbortController();
  const port = new PrismaPushLeasePort(prisma);
  const relay = createPushRelay({ subject, publicKey, privateKey }, stop.signal);
  const deliver = createPushOutboxDelivery(prisma, relay, undefined, stop.signal);

  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> | undefined;
  const schedule = (delay = POLL_INTERVAL_MS) => {
    if (stop.signal.aborted) return;
    timer = setTimeout(() => {
      let nextDelay = POLL_INTERVAL_MS;
      running = (async () => {
        const now = new Date();
        await port.expireDue(now);
        await port.expireExhausted(now);
        if (stop.signal.aborted) return;
        const { claimed, lostLeases } = await runConfiguredPushOutboxTick(port, deliver);
        if (lostLeases) console.warn('Web Push outbox lost leases', { count: lostLeases });
        if (claimed === PUSH_OUTBOX_WORKERS) nextDelay = 0;
      })().catch(() => console.warn('Web Push outbox tick failed')).finally(() => schedule(nextDelay));
    }, delay);
    timer.unref();
  };
  schedule();
  return async () => {
    stop.abort();
    clearTimeout(timer);
    await running;
  };
}
