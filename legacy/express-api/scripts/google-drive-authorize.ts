import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';

// Run locally as the platform operator. Do not share the resulting refresh token
// in chat, GitHub, logs, browser URLs, or public screenshots.
const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
if (!clientId || !clientSecret) throw new Error('Set GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET in apps/api/.env first.');

const state = randomBytes(24).toString('hex');
const server = createServer();
server.on('request', async (req, res) => {
  const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
  if (requestUrl.pathname !== '/oauth2callback' || requestUrl.searchParams.get('state') !== state) {
    res.writeHead(404).end('Not found');
    return;
  }
  const code = requestUrl.searchParams.get('code');
  if (!code) {
    res.writeHead(400).end('Authorization was not granted.');
    server.close();
    return;
  }
  const address = server.address();
  if (!address || typeof address === 'string') { res.writeHead(500).end(); return; }
  const redirectUri = `http://127.0.0.1:${address.port}/oauth2callback`;
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code,
        redirect_uri: redirectUri, grant_type: 'authorization_code' }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error('Google did not accept the OAuth code.');
    const tokens = await response.json() as { refresh_token?: string };
    if (!tokens.refresh_token) throw new Error('Google did not return an offline refresh token. Revoke the test grant and retry with consent.');
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end('Google Drive authorization complete. Return to your private terminal to finish setup.');
    console.log('\nAdd the following to apps/api/.env privately. NEVER paste it in chat or commit it:');
    console.log(`GOOGLE_DRIVE_REFRESH_TOKEN="${tokens.refresh_token}"`);
  } catch (error) {
    res.writeHead(502, { 'Content-Type': 'text/plain' }).end('Authorization could not be completed. Check the local terminal.');
    console.error(error instanceof Error ? error.message : 'Authorization failed.');
  } finally {
    server.close();
  }
});
server.listen(0, '127.0.0.1', () => {
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('Unable to start loopback callback.');
  const redirectUri = `http://127.0.0.1:${addr.port}/oauth2callback`;
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri, response_type: 'code',
    scope: 'https://www.googleapis.com/auth/drive.file',
    access_type: 'offline', prompt: 'consent', state,
  }).toString();
  console.log('Open this Google authorization URL in your local browser:\n' + url);
});
