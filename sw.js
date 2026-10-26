// Service worker: guarda o "casco" do app para abrir rapido e funcionar mesmo com sinal ruim.
// A API nunca entra no cache.
const VERSION = 'treino-v5';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/api.js', 'js/ui.js', 'js/v_home.js', 'js/v_profile.js', 'js/v_plan.js',
  'js/guides.js', 'js/v_workout.js', 'js/v_finish.js', 'js/v_body.js', 'js/v_history.js', 'js/main.js',
  'icons/icon-192.png', 'icons/icon-512.png',
  'css/fonts/sora-latin-wght-normal.woff2', 'css/fonts/dm-mono-latin-400-normal.woff2', 'css/fonts/dm-mono-latin-500-normal.woff2'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/api/')) return;
  // Rede primeiro (pega atualizacoes), cache como reserva
  e.respondWith(
    fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req).then((r) => r || caches.match('index.html')))
  );
});
