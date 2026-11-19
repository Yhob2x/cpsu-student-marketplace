// No-dependency PWA asset check. Run from the repository root: bun run pwa:check
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const web = path.resolve(__dirname, '..', 'apps', 'web');
const publicDir = path.join(web, 'public');
const manifest = JSON.parse(fs.readFileSync(path.join(publicDir, 'manifest.webmanifest'), 'utf8'));
const index = fs.readFileSync(path.join(web, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(publicDir, 'sw.js'), 'utf8');

assert.equal(manifest.id, '/');
assert.equal(manifest.scope, '/');
assert.equal(manifest.start_url, '/');
assert.equal(manifest.display, 'standalone');
const theme = fs.readFileSync(path.join(web, '..', 'shared', 'theme.css'), 'utf8');
const primary = theme.match(/--color-primary:\s*(#[a-fA-F0-9]{6})\s*;/)?.[1];
assert.ok(primary, 'Shared CPSU primary token must exist');
assert.equal(manifest.theme_color.toUpperCase(), primary.toUpperCase());
assert.ok(index.includes(`name="theme-color" content="${primary}"`), 'HTML and PWA colors must share the CPSU primary token');
assert.equal(manifest.short_name, 'CPSU Market');
assert.match(index, /<link rel="manifest" href="\/manifest\.webmanifest"/);
assert.match(index, /<meta name="apple-mobile-web-app-title" content="CPSU Market"/);
assert.match(index, /<link rel="apple-touch-icon" href="\/icons\/apple-touch-icon\.png"/);
assert.match(sw, /const OFFLINE_URL = '\/offline\.html'/);
assert.match(sw, /request\.mode !== 'navigate'/);
assert.match(sw, /url\.pathname\.startsWith\('\/api\/'\)/);

const signature = Buffer.from('89504e470d0a1a0a', 'hex');
const assertPng = (file, expected) => {
  const bytes = fs.readFileSync(path.join(publicDir, file));
  assert.ok(bytes.subarray(0, 8).equals(signature), `${file} is not a PNG`);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  assert.equal(width, expected, `${file} width`);
  assert.equal(height, expected, `${file} height`);
  console.log(`✓ ${file} (${width}×${height})`);
};

const actualIcons = new Set();
for (const purpose of ['any', 'maskable']) {
  for (const dimension of [192, 512]) {
    const matches = manifest.icons.filter(icon => icon.sizes === `${dimension}x${dimension}` && icon.purpose === purpose);
    assert.equal(matches.length, 1, `Expected one ${purpose} ${dimension}x${dimension} icon`);
    const icon = matches[0];
    assert.equal(icon.type, 'image/png');
    assert.ok(icon.src.startsWith('/icons/'));
    assertPng(icon.src.replace(/^\//, ''), dimension);
    actualIcons.add(icon.src);
  }
}
assert.equal(actualIcons.size, 4, 'Maskable and normal PNG assets must be separate.');
assertPng('icons/apple-touch-icon.png', 180);
assert.ok(fs.existsSync(path.join(publicDir, 'offline.html')));
assert.equal(manifest.shortcuts.length, 3);
assert.deepEqual(manifest.shortcuts.map(x => x.url), ['/explore', '/dashboard', '/inquiries']);
console.log('✓ Manifest, Apple metadata, install shortcuts and offline-only service worker contracts');
console.log('✓ All PWA assets validated');
