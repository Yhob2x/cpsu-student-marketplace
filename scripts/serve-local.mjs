import { join } from 'node:path';

const { promise: photoReady, resolve: confirmPhotoReady } = Promise.withResolvers();
const photo = Bun.spawn([process.execPath, '--env-file=../.env', 'server.mjs', '--check-existing'], {
  cwd: join(import.meta.dir, '../photo-service'),
  stdout: 'inherit',
  stderr: 'inherit',
  ipc(message) {
    if (message === 'photo-ready') confirmPhotoReady(true);
  },
});

let app;
try {
  const startedPhoto = await Promise.race([
    photoReady,
    photo.exited.then(code => {
      // A clean exit before readiness means --check-existing found a running service.
      if (code === 0) return false;
      throw new Error(`Photo service could not start (exit code ${code}).`);
    }),
  ]);
  app = Bun.spawn(['php', 'artisan', 'serve', ...process.argv.slice(2)], {
    stdio: ['inherit', 'inherit', 'inherit'],
  });
  process.exitCode = await (startedPhoto ? Promise.race([
    app.exited,
    photo.exited.then(code => { throw new Error(`Photo service stopped (exit code ${code}).`); }),
  ]) : app.exited);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (app?.exitCode === null) app.kill();
  if (photo.exitCode === null) photo.kill();
}
