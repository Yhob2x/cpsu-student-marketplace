import { createApp } from './app.js';
import { env } from './env.js';
import { prisma } from './db.js';
import { createShutdown } from './graceful-shutdown.js';
import { startPushOutbox } from './push-outbox-runtime.js';

const server = createApp().listen(env.PORT, env.BIND_HOST, () =>
  console.log(`CPSU Marketplace API on ${env.BIND_HOST}:${env.PORT}`));
const stopPushOutbox = startPushOutbox();
const shutdown = createShutdown(server, async () => {
  await stopPushOutbox();
  await prisma.$disconnect();
});
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
