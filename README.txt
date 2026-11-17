KATALOG SCANDIA BOTANI - PWA (GitHub Pages)

ISI FOLDER INI diunggah ke repository GitHub (satu repository, mis. katalog-3d):
  index.html, config.js, sw.js, manifest.webmanifest,
  icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png, logo.png
File model .glb yang sudah ada di repository tetap dipakai (tidak perlu dihapus).
ar.html lama tidak dipakai lagi (boleh dihapus).

LANGKAH:
1. Apps Script: ganti isi Code.gs dengan Code-pwa.gs, lalu Deploy > Manage deployments > Edit > New version.
   Salin "Web app URL" (berakhiran /exec).
2. Buka config.js di GitHub, tempel URL itu pada API_URL, lalu Commit.
3. Di sheet Config, ubah "URL Katalog" menjadi alamat GitHub Pages
   (contoh: https://scandiabotanisquarebogor-hue.github.io/katalog-3d/), lalu jalankan buatQrSemua() agar QR baru.
4. Buka alamat GitHub Pages di HP, lalu "Pasang aplikasi di layar utama".
