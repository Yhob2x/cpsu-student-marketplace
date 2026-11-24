// Laravel's Vite entry. The original index.html build injected this preload polyfill automatically.
import 'vite/modulepreload-polyfill';
import './styles';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppLayout } from '@/layouts/app-layout';
import { SessionProvider } from '@/providers/session-provider';

// PwaStatus owns the sole production service-worker registration and update flow.
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SessionProvider>
          <AppLayout />
        </SessionProvider>
      </BrowserRouter>
    </React.StrictMode>,
  );
}
