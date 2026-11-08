// Service worker completo para funcionamento offline do PWA (Painel Admin e App do Motorista)
const SHELL_CACHE = 'vsm-frota-shell-v3';
const DATA_CACHE = 'vsm-frota-data-v3';

const SHELL_URLS = [
  '/',
  '/app/driver',
  '/login',
  '/logo.png',
  '/icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        Promise.allSettled(SHELL_URLS.map((url) => cache.add(url)))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== DATA_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Rotas de leitura de contexto (/api/driver/context e /api/fleet): Network-First com fallback para cache offline
  if (url.pathname === '/api/driver/context' || url.pathname === '/api/fleet') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(DATA_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || Response.error())
        )
    );
    return;
  }

  // Demais rotas de API não são cacheadas
  if (url.pathname.startsWith('/api/')) return;

  // Arquivos estáticos e páginas: Network-First com fallback instantâneo para o cache
  e.respondWith(
    fetch(req)
      .then((res) => {
        const isStaticOrPage =
          url.pathname.startsWith('/_next/static') ||
          SHELL_URLS.includes(url.pathname) ||
          req.mode === 'navigate';

        if (res.ok && !res.redirected && isStaticOrPage) {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => {
          if (hit) return hit;
          if (req.mode !== 'navigate') return Response.error();
          const fallback = url.pathname.startsWith('/app/driver') ? '/app/driver' : '/';
          return caches.match(fallback).then((page) => page || Response.error());
        })
      )
  );
});
