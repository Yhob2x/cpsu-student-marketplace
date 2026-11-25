// Local transport smoke: dedicated synthetic channel, never a student's channel.
import { createHmac, randomUUID } from 'node:crypto';
const key = process.env.REVERB_APP_KEY, secret = process.env.REVERB_APP_SECRET;
const port = Number(process.env.REVERB_SERVER_PORT || 8080);
if (!key || !secret) throw new Error('Local Reverb settings missing');
const channel = 'private-market-qa-' + randomUUID();
const socket = new WebSocket('ws://127.0.0.1:' + port + '/app/' + key + '?protocol=7&client=js&version=8.6.0&flash=false', {
  headers: { Origin: 'http://127.0.0.1:8000' },
});
let start = 0;
const timeout = setTimeout(() => { console.error('Realtime smoke timed out'); socket.close(); process.exit(1); }, 12000);
socket.addEventListener('message', async ({ data }) => {
  const message = JSON.parse(String(data));
  if (message.event === 'pusher:connection_established') {
    const id = JSON.parse(message.data).socket_id;
    const auth = key + ':' + createHmac('sha256', secret).update(id + ':' + channel).digest('hex');
    socket.send(JSON.stringify({ event: 'pusher:subscribe', data: { channel, auth } }));
  }
  if (message.event === 'pusher_internal:subscription_succeeded') {
    start = performance.now();
    const proc = Bun.spawn(['php', 'artisan', 'tinker', '--execute=App\\Services\\Realtime::client()->trigger(getenv("CPSU_QA_CHANNEL"), "market.changed", ["scope" => "chat"]);'], {
      env: { ...process.env, CPSU_QA_CHANNEL: channel }, stdout: 'ignore', stderr: 'ignore',
    });
    if (await proc.exited !== 0) { console.error('Local PHP publisher failed'); process.exit(1); }
  }
  if (message.event === 'market.changed' && message.channel === channel && JSON.parse(message.data).scope === 'chat') {
    clearTimeout(timeout);
    console.log('PASS private Reverb transport: synthetic PHP-to-WebSocket event received in ' + Math.round(performance.now() - start) + ' ms');
    socket.close();
    process.exit(0);
  }
});
socket.addEventListener('error', () => { console.error('Reverb connection failed'); process.exit(1); });
