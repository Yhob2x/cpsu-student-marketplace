# Realtime, push and photo-service operations

## Windows local development
- From the repository root, run `php artisan serve`, and in a separate terminal `php artisan reverb:start --host=127.0.0.1 --port=8080`.
- Local `.env` needs MARKET_REALTIME_ENABLED=true and matching REVERB_APP_ID, REVERB_APP_KEY and REVERB_APP_SECRET; keep credentials out of Git. Use localhost/127.0.0.1 origins. Rebuild with `bun run build` after frontend changes.
- From photo-service, install dependencies with `bun install --frozen-lockfile`. From the root run `powershell -File scripts/start-photo-service.ps1` to supervise the local worker. Check with `php artisan marketplace:photo-health`.
- For XAMPP PHP 8.5 on this workstation, set `$env:OPENSSL_CONF='C:\xampp\php\extras\ssl\openssl.cnf'` in PowerShell before running crypto tests or the push worker. This is process-local, not a global PHP setting. Adapt the path on other machines.

## Production release (not deployed)
- Use the supplied systemd templates in infrastructure/deploy and Nginx WebSocket proxy; review paths, permissions, environment files and host names for the actual VPS. Bind Reverb privately; proxy its client WebSocket endpoint over HTTPS, not its publishing API. Configure the exact allowed origins, REVERB_SAME_ORIGIN=true, and matching server-side credentials.
- Enable the photo health timer and supervised service. Verify both liveness and actual safe-image processing. Preserve fail-closed behavior when screening is unavailable.
- Push remains opt-in and disabled by default. Validate the approved HTTPS origin, VAPID credentials/contact, and institutional delivery approval before enabling the subscription and delivery flags described in .env.example. Start `php artisan marketplace:push-drain --watch` or the supplied worker service only after approval. Do not log subscription endpoints or keys. Stop/restart the worker when changing configuration; a running process can retain cached settings.
- Push uses a leased outbox and per-device attempts; it is not exactly-once delivery in the event of a crash after provider acceptance. Check opt-out, quiet hours, muted threads and expired subscriptions during staging.

## Verification and limitations
- Run `bun run test:frontend`, `bun run build`, `php artisan test` with the isolated test database, `bun scripts/qa-realtime-socket.mjs`, and `bun scripts/qa-photo-health.mjs` (local services must be running for the latter two).
- Verify two independently signed-in student browsers for chat, receipts, transaction changes, reconnect and fallback. Verify installed PWA notification receipt and notification tap on actual supported Android/iOS devices over HTTPS. Synthetic delivery tests do not contact live providers. The student/admin browser regression tests mock APIs.
- No production deployment, live push activation or development database migration was performed.
