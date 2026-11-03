'use client';

import { useEffect } from 'react';

/** Registra o service worker (app instalável no celular e abertura offline do casco). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return null;
}
