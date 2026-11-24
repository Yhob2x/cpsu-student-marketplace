import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Windows needs one canonical path form, or Rollup bundles the entry module twice.
const root = realpathSync.native(dirname(fileURLToPath(import.meta.url))).replaceAll('\\', '/');
process.chdir(root);

export default defineConfig({
  root,
  plugins: [laravel({ input: [`${root}/resources/js/app.tsx`], refresh: true }), react(), tailwindcss()],
  resolve: { alias: { '@': resolve(root, 'resources/js') } },
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
});