KATALOG SCANDIA BOTANI - PWA + ADMIN (GitHub Pages + Google Apps Script)

A. FILE YANG DIUNGGAH KE REPOSITORY GITHUB (satu repository, mis. katalog-3d)
   index.html            katalog untuk customer (PWA)
   admin.html            halaman admin: edit/tambah produk, unggah foto, PNG, model 3D
   config.js             satu-satunya tempat alamat Apps Script
   sw.js, manifest.webmanifest
   icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png, logo.png
   Folder "models/" dibuat otomatis oleh Admin saat unggah model 3D.
   File .glb lama di akar repository tetap berfungsi. ar.html lama tidak dipakai lagi.

B. APPS SCRIPT (sekali saja)
   1. Ganti isi Code.gs dengan Code-pwa.gs.
   2. Project Settings > Script properties > tambahkan:
        ADMIN_PASSWORD  = sandi panjang buatan sendiri
        GITHUB_TOKEN    = token GitHub (lihat C)
        GITHUB_REPO     = pemilik/nama-repo   (contoh: scandiabotanisquarebogor-hue/katalog-3d)
        GITHUB_BRANCH   = main   (opsional)
   3. Jalankan fungsi cekAdmin() dari editor, izinkan akses Drive dan "layanan eksternal"
      yang diminta, lalu baca hasilnya di Execution log (semua harus OK).
   4. Deploy > Manage deployments > Edit > New version > Deploy.
      Salin Web app URL (berakhiran /exec).

C. TOKEN GITHUB
   GitHub > Settings > Developer settings > Personal access tokens > Fine-grained tokens > Generate new token
   - Repository access: Only select repositories -> pilih repo katalog saja
   - Permissions > Repository permissions > Contents: Read and write
   - Salin tokennya sekali; tempel ke Script properties (GITHUB_TOKEN). Jangan dibagikan.

D. config.js
   Isi API_URL dengan Web app URL dari B-4, lalu Commit.

E. SHEET CONFIG
   Ubah "URL Katalog" menjadi alamat GitHub Pages (contoh: https://scandiabotanisquarebogor-hue.github.io/katalog-3d/),
   lalu jalankan buatQrSemua() agar semua QR menunjuk ke aplikasi baru.
   (QR lama berisi alamat Apps Script tetap berfungsi: halamannya menampilkan tombol menuju katalog baru.)

F. PAKAI
   Admin  : https://NAMA.github.io/REPO/admin.html
            - Data produk : edit produk terpilih atau "+ Produk baru" (baris + QR dibuat otomatis)
            - Cari produk: ketik kode, nama, atau kategori di kolom pencarian, lalu ketuk hasilnya (atau tekan Enter untuk memilih hasil pertama)
            - Foto produk, foto tanpa background (PNG), model 3D: pilih produk > pilih file > Unggah
   Katalog: https://NAMA.github.io/REPO/   (bisa dipasang ke layar utama HP)
