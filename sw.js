/* Service worker CYCLE COUNT: cangkang aplikasi tersimpan, data tetap lewat internet. */
var VERSI = 'cc-v7';
var INTI = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './logo.svg', './logo-mark.svg'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSI).then(function (c) { return c.addAll(INTI); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== VERSI; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  // Halaman dan berkas aplikasi: coba internet dulu, cadangan dari simpanan.
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(VERSI).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (r) { return r || caches.match('./index.html'); });
    }));
    return;
  }
  // Pustaka pemindai barcode dari jsDelivr: simpan agar kamera tetap bisa dipakai saat sinyal buruk.
  if (url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(caches.match(req).then(function (r) {
      return r || fetch(req).then(function (res) {
        if (res && res.ok) { var copy = res.clone(); caches.open(VERSI).then(function (c) { c.put(req, copy); }); }
        return res;
      });
    }));
  }
  // Permintaan lain (server Apps Script) tidak disentuh.
});
