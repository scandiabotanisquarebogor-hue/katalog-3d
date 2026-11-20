// Service worker Katalog SCANDIA BOTANI
// Ganti nomor versi di bawah setiap kali index.html berubah besar, supaya cache lama dibersihkan.
const V = "katalog-v3";
const SHELL = ["./", "index.html", "config.js", "manifest.webmanifest", "logo.png", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  // Data (Apps Script) dan foto Drive tidak di-cache di sini; data disimpan oleh aplikasi sendiri.
  if (/script\.google\.com|googleusercontent\.com|drive\.google\.com|quickchart\.io/.test(u.host)) return;

  // Halaman & config: ambil dari jaringan dulu (supaya perubahan langsung terlihat), cadangan dari cache.
  if (r.mode === "navigate" || u.pathname.endsWith("/config.js")) {
    // Halaman katalog disimpan sebagai "index.html", halaman admin sebagai "admin.html"
    const key = r.mode === "navigate" ? (u.pathname.endsWith("/admin.html") ? "admin.html" : "index.html") : r;
    e.respondWith(
      fetch(r).then(res => {
        if (res && res.status === 200) { const cp = res.clone(); caches.open(V).then(c => c.put(key, cp)); }
        return res;
      }).catch(() => caches.match(key))
    );
    return;
  }

  // File lain di situs ini, font, dan model-viewer: pakai cache, perbarui di belakang layar.
  if (u.origin === location.origin || /fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/.test(u.host)) {
    e.respondWith(caches.open(V).then(c => c.match(r).then(hit => {
      const net = fetch(r).then(res => {
        if (res && (res.status === 200 || res.type === "opaque")) c.put(r, res.clone());
        return res;
      }).catch(() => hit);
      return hit || net;
    })));
  }
});
