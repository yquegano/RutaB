/* RutaB · service worker (v10, 2026-11-09)
   - La app abre sin internet (index.html, íconos y manifest quedan guardados).
   - Las páginas del libro se guardan a medida que se ven, o todas juntas con
     el botón "Guardar el libro" (caché aparte, no se borra al actualizar). */
const CORE = 'rutab-core-v10';
const LIBRO = 'rutab-libro-v1';
const FONTS = 'rutab-fonts-v1';
const CORE_FILES = ['./', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-192.png',
  './icons/maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CORE).then(c => c.addAll(CORE_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  const keep = [CORE, LIBRO, FONTS];
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('rutab-') && !keep.includes(k)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Páginas: primero internet (para tener siempre la última versión); sin internet, la copia guardada.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CORE).then(c => c.put('./index.html', copy)); }
      return res;
    }).catch(() => caches.match('./index.html', { ignoreSearch: true })));
    return;
  }

  // Libro: primero lo guardado; si no está, se descarga y se guarda.
  if (url.origin === location.origin && url.pathname.includes('/libro/')) {
    e.respondWith(caches.open(LIBRO).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) c.put(req, res.clone());
      return res;
    }))));
    return;
  }

  // Letras de Google Fonts: se usan las guardadas y se actualizan en segundo plano.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(c => c.match(req).then(hit => {
      const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
    return;
  }

  // Resto de archivos propios (íconos, manifest).
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req)));
  }
});
