import Pusher from 'pusher-js';
import { api } from '@/lib/api';

export const realtimeEvent = 'cpsu:realtime';
export type RealtimeScope = 'chat' | 'account' | 'transaction' | 'reconnect';
let subscribed = false;
/** Keep a slow reconciliation poll while connected; resume normal polling immediately on disconnect. */
export function shouldPollRealtime(lastPollAt: number, now = Date.now()) {
  return !subscribed || now - lastPollAt >= 15_000;
}
export function listenRealtime(callback: () => void, scopes: RealtimeScope[]) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const handle = (event: Event) => {
    const scope = (event as CustomEvent<RealtimeScope>).detail;
    if (document.hidden || (!scopes.includes(scope) && scope !== 'reconnect')) return;
    if (timer !== undefined) return;
    timer = setTimeout(() => { timer = undefined; callback(); }, 120);
  };
  window.addEventListener(realtimeEvent, handle);
  return () => { window.removeEventListener(realtimeEvent, handle); if (timer !== undefined) clearTimeout(timer); };
}

/** One authenticated socket per browser session; only invalidation signals travel on it. */
export function connectRealtime(userId: number) {
  let active = true;
  let client: Pusher | undefined;
  const emit = (scope: RealtimeScope) => {
    if (active) window.dispatchEvent(new CustomEvent(realtimeEvent, { detail: scope }));
  };
  void api<{ enabled: boolean; key: string | null; port: number; sameOrigin: boolean }>('/realtime/config').then(config => {
    if (!active || !config.enabled || !config.key) return;
    const secure = location.protocol === 'https:';
    if (!secure && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
    const port = config.sameOrigin ? Number(location.port || (secure ? 443 : 80)) : config.port;
    client = new Pusher(config.key, {
      cluster: 'mt1', wsHost: location.hostname, wsPort: port, wssPort: port,
      forceTLS: secure, enabledTransports: ['ws', 'wss'], disableStats: true,
      channelAuthorization: {
        endpoint: '/api/v1/realtime/auth', transport: 'ajax',
        customHandler: (params, callback) => {
          if (!active) { callback(new Error('Session closed'), null); return; }
          void api<{ auth: string }>('/realtime/auth', {
            body: { socket_id: params.socketId, channel_name: params.channelName },
          }).then(data => { if (active) callback(null, data); else callback(new Error('Session closed'), null); })
            .catch(error => callback(error, null));
        },
      },
    });
    const channel = client.subscribe('private-market-user.' + userId);
    channel.bind('pusher:subscription_succeeded', () => { if (active) { subscribed = true; emit('reconnect'); } });
    client.connection.bind('state_change', (states: { current: string }) => {
      if (active && states.current !== 'connected') subscribed = false;
    });
    channel.bind('pusher:subscription_error', () => { if (active) subscribed = false; });
    channel.bind('market.changed', (data: { scope?: RealtimeScope }) => {
      if (data.scope === 'chat' || data.scope === 'account' || data.scope === 'transaction') emit(data.scope);
    });
  }).catch(() => { /* Existing foreground polling continues when sockets are unavailable. */ });
  return () => { active = false; subscribed = false; client?.disconnect(); };
}
