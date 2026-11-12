import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:4000' } },
  // Mirror the production same-origin API setup during local PWA preview checks.
  preview: { port: 4173, proxy: { '/api': 'http://localhost:4000' } },
});
