/* Service worker: guarda o app no aparelho para abrir sem internet.
   Mostra a versão guardada na hora e atualiza em segundo plano. */
const CACHE = 'monikfit-v1';
const ASSETS = [
  './', './index.html', './ios.css', './ios.js', './manifest.webmanifest',
  './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function clean(resp) {
  // O Safari recusa páginas redirecionadas vindas do service worker; recria a resposta sem o redirecionamento.
  if (!resp.redirected) return resp;
  const body = await resp.blob();
  return new Response(body, { status: resp.status, statusText: resp.statusText, headers: resp.headers });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // YouTube e afins vão direto para a internet

  const key = req.mode === 'navigate' ? './index.html' : req;
  const network = fetch(req)
    .then(async (resp) => {
      if (resp && resp.ok) {
        const fixed = await clean(resp);
        const cache = await caches.open(CACHE);
        await cache.put(key, fixed.clone());
        return fixed;
      }
      return resp;
    })
    .catch(() => null);

  event.waitUntil(network);
  event.respondWith(
    caches.match(key, { ignoreSearch: true }).then(async (cached) => {
      if (cached) return cached;
      const fresh = await network;
      return fresh || new Response('Sem conexão', { status: 504, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    })
  );
});
