// Service worker mínimo: cacheia o "casco" do app (painel e área do motorista) para abrir sem internet.
// Nunca cacheia /api (dados e sessão sempre vêm da rede).
const CACHE = 'vsm-frota-v2';
const SHELL = ['/logo.png', '/icon.png', '/icons/icon-192.png', '/manifest.webmanifest'];
const PAGES = ['/', '/app/driver'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api')) return;
  // network-first; cai para o cache quando offline
  e.respondWith(
    fetch(req)
      .then((res) => {
        const cacheable =
          url.pathname.startsWith('/_next/static') || SHELL.includes(url.pathname) || PAGES.includes(url.pathname);
        // res.redirected = foi mandado para /login: não guarda a tela de login no lugar da página
        if (res.ok && !res.redirected && cacheable) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
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
