// ============================================================
// Katalog Satu Klik — backend Google Apps Script (versi 3.1, PWA GitHub Pages + admin unggah file)
// Setup sekali: Extensions > Apps Script, tempel file ini + file HTML
// "Katalog", jalankan setupKatalog(), lalu Deploy > New deployment >
// Web app (Execute as: Me, Access: Anyone), tempel URL ke Config >
// baris "URL Katalog".
// ============================================================

const SHEET_PRODUK = 'Produk';
const SHEET_CONFIG = 'Config';
const SHEET_SALES  = 'Sales';
const CACHE_KEY    = 'katalog_data_v1';
const CACHE_TTL    = 60; // detik; sinkron dengan auto-refresh 60 dtk di frontend

const ss_    = () => SpreadsheetApp.getActiveSpreadsheet();
const cache_ = () => CacheService.getScriptCache();

// Ambil sheet dengan pesan error yang jelas kalau belum ada
function sh_(name) {
  const s = ss_().getSheetByName(name);
  if (!s) throw new Error('Sheet "' + name + '" tidak ditemukan. Jalankan setupKatalog() satu kali dulu.');
  return s;
}

// ---------- SETUP ----------
function setupKatalog() {
  var ss = ss_();
  var p = ss.getSheetByName(SHEET_PRODUK) || ss.insertSheet(SHEET_PRODUK);
  if (p.getLastRow() === 0) {
    p.appendRow(['Kode','Nama','Kategori','Harga','Stok','Panjang (cm)','Lebar (cm)','Tinggi (cm)','Material','Keterangan','Foto (link/ID Drive)','Ilustrasi (kursi/kerja/meja/mejakerja/sofa/lemari/rak/lampu)','Aktif','QR (cetak & tempel)','Foto transparan PNG (opsional, untuk Coba di Ruangan)','Model 3D .glb (link langsung, opsional, untuk AR)','Skala AR (isi TIDAK untuk menonaktifkan skala; kosong = aktif)']);
    p.appendRow(['KM-001','Kursi Makan Kayu','Kursi',450000,12,45,50,85,'Kayu jati solid','Gaya Skandinavia','','kursi','YA']);
    p.appendRow(['MM-003','Meja Makan 4 Orang','Meja',1850000,5,140,80,75,'Top kayu MDF veneer, kaki besi','Untuk ruang makan sedang','','meja','YA']);
    p.getRange('A1:Q1').setFontWeight('bold').setBackground('#2dc4b2').setFontColor('#ffffff');
    p.setFrozenRows(1);
  }
  var c = ss.getSheetByName(SHEET_CONFIG) || ss.insertSheet(SHEET_CONFIG);
  if (c.getLastRow() === 0) {
    c.appendRow(['Kunci','Nilai']);
    c.appendRow(['Nama Toko','SCANDIA BOTANI']);
    c.appendRow(['URL Katalog','(tempel link Web app di sini)']);
  }
  var s = ss.getSheetByName(SHEET_SALES) || ss.insertSheet(SHEET_SALES);
  if (s.getLastRow() === 0) {
    s.appendRow(['Nama Sales','WhatsApp (62…)','Aktif']);
    s.appendRow(['Sales 1','6281234567890','YA']);
    s.appendRow(['Sales 2','6281234567891','YA']);
    s.appendRow(['Sales 3','6281234567892','YA']);
  }
  buatQrSemua();
}

// ---------- QR ----------
// Mencari baris "URL Katalog" di Config secara dinamis, lalu mengembalikan
// referensi sel-nya (contoh: Config!$B$3). Dipanggil sekali per batch.
function urlRefConfig_() {
  var v = sh_(SHEET_CONFIG).getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]).trim() === 'URL Katalog') return SHEET_CONFIG + '!$B$' + (i + 1);
  }
  return '""';
}

// Menulis semua formula QR dalam satu batch (jauh lebih cepat dari per baris)
function buatQrSemua() {
  var sh = sh_(SHEET_PRODUK);
  var last = sh.getLastRow();
  if (last < 2) return;
  var ref = urlRefConfig_();
  var kodes = sh.getRange(2, 1, last - 1, 1).getValues();
  var formulas = kodes.map(function (r, i) {
    if (!r[0]) return [''];
    return ['=IFERROR(IMAGE("https://quickchart.io/qr?size=220&text="&ENCODEURL(' + ref + '&"?kode="&A' + (i + 2) + ')))'];
  });
  sh.getRange(2, 14, formulas.length, 1).setFormulas(formulas);
  sh.setRowHeightsForced(2, last - 1, 110);
}

// ---------- WEB APP ----------
// Mode 1 (utama): API JSON untuk aplikasi di GitHub Pages  ->  .../exec?api=1
//   Dengan &callback=namaFungsi, hasilnya dibungkus JSONP (cadangan bila fetch diblokir browser).
// Mode 2: halaman lama. Bila "URL Katalog" di sheet Config sudah diisi alamat GitHub Pages,
//   halaman ini hanya menampilkan tombol menuju katalog terbaru (QR lama tetap berfungsi).
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.api) return api_(p);
  try {
    var raw = p.kode ? String(p.kode) : '';
    var kode = /^[\w.-]{1,40}$/.test(raw) ? raw : '';
    var pwa = urlPwa_();
    if (pwa) return redirectPage_(pwa, kode);
    var t = HtmlService.createTemplateFromFile('Katalog');
    t.kodeJson = JSON.stringify(kode);
    return t.evaluate().setTitle('SCANDIA BOTANI · Katalog Produk')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (err) {
    console.error(err);
    return HtmlService.createHtmlOutput(
      '<div style="font-family:sans-serif;padding:40px;text-align:center">' +
      '<h2>Katalog gagal dimuat</h2>' +
      '<p>Jalankan <b>setupKatalog()</b> satu kali, lalu <b>Deploy &gt; Manage deployments &gt; Edit &gt; New version</b>.</p></div>');
  }
}

function api_(p) {
  var json;
  try {
    json = JSON.stringify(getData());
  } catch (err) {
    console.error(err);
    json = JSON.stringify({ error: String(err && err.message || err) });
  }
  var cb = String(p.callback || '');
  if (/^[\w.$]{1,60}$/.test(cb)) {
    return ContentService.createTextOutput(cb + '(' + json + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

// Alamat GitHub Pages dibaca dari Config > "URL Katalog" (hanya alamat https selain script.google.com)
function urlPwa_() {
  try {
    var v = sh_(SHEET_CONFIG).getDataRange().getValues();
    for (var i = 1; i < v.length; i++) {
      if (String(v[i][0]).trim() === 'URL Katalog') {
        var u = String(v[i][1]).trim();
        if (/^https:\/\//.test(u) && u.indexOf('script.google.com') < 0) return u;
      }
    }
  } catch (e) {}
  return '';
}

function redirectPage_(url, kode) {
  var target = url + (kode ? (url.indexOf('?') < 0 ? '?' : '&') + 'kode=' + encodeURIComponent(kode) : '');
  var safe = target.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return HtmlService.createHtmlOutput(
    '<div style="font-family:sans-serif;padding:40px;text-align:center">' +
    '<h2>Katalog sudah pindah</h2><p>Ketuk tombol di bawah untuk membuka katalog terbaru.</p>' +
    '<p><a target="_top" href="' + safe + '" style="display:inline-block;padding:14px 26px;background:#4d7a63;color:#fff;border-radius:999px;text-decoration:none;font-weight:600">Buka Katalog</a></p></div>')
    .setTitle('SCANDIA BOTANI · Katalog Produk')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ---------- UTIL FOTO ----------
function fid_(v) {
  v = String(v || '').trim();
  if (!v) return '';
  var m = v.match(/\/d\/([\w-]+)/) || v.match(/[?&]id=([\w-]+)/);
  if (m) return m[1];
  if (/^[\w-]{25,}$/.test(v)) return v;
  return '';
}
// Foto utama (lh3, mempertahankan transparansi PNG) + cadangan (thumbnail Drive)
function foto_(v) { var i = fid_(v); return i ? 'https://lh3.googleusercontent.com/d/' + i + '=w900' : String(v || '').trim(); }
function fotoCad_(v) { var i = fid_(v); return i ? 'https://drive.google.com/thumbnail?id=' + i + '&sz=w900' : ''; }
// Beberapa foto dalam satu sel: boleh dipisah baris baru (Alt+Enter), spasi, koma, titik koma (;) atau |
function fotoList_(v) {
  return String(v || '').split(/[\s,;|]+/).map(function (s) { return s.trim(); }).filter(String)
    .map(function (s) { return { u: foto_(s), b: fotoCad_(s) }; });
}

// ---------- DATA (dengan cache 60 detik, hemat kuota & lebih cepat) ----------
function getData() {
  var hit = cache_().get(CACHE_KEY);
  if (hit) return JSON.parse(hit);

  var cfg = {};
  sh_(SHEET_CONFIG).getDataRange().getValues().slice(1).forEach(function (r) {
    if (r[0]) cfg[String(r[0]).trim()] = r[1];
  });

  var items = sh_(SHEET_PRODUK).getDataRange().getValues().slice(1)
    .filter(function (r) { return r[0] && String(r[12]).toUpperCase() === 'YA'; })
    .map(function (r) {
      var fl = fotoList_(r[10]), f0 = fl[0] || {};
      return {
        k: String(r[0]), n: String(r[1] || ''), c: r[2] || 'Lainnya',
        p: Number(r[3]) || 0, s: Number(r[4]) || 0,
        pj: Number(r[5]) || 0, l: Number(r[6]) || 0, t: Number(r[7]) || 0,
        m: r[8] || '', d: r[9] || '',
        f: f0.u || '', fb: f0.b || '', fl: fl,
        g: foto_(r[14]), gb: fotoCad_(r[14]),
        glb: String(r[15] || '').trim(),
        sk: String(r[16] || '').trim().toUpperCase() === 'TIDAK' ? 0 : 1,
        e: r[11] || ''
      };
    });

  var sales = sh_(SHEET_SALES).getDataRange().getValues().slice(1)
    .filter(function (r) { return r[0] && r[1] && String(r[2]).toUpperCase() === 'YA'; })
    .map(function (r) { return { n: String(r[0]), wa: String(r[1]).replace(/\D/g, '') }; });

  var data = {
    store: cfg['Nama Toko'] || '',
    sales: sales,
    items: items,
    updated: Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd MMM HH:mm')
  };

  // CacheService menolak nilai lebih dari ~100 KB; jika terlalu besar,
  // data tetap dikembalikan tanpa cache agar katalog tidak gagal total.
  try {
    cache_().put(CACHE_KEY, JSON.stringify(data), CACHE_TTL);
  } catch (err) {
    console.warn('Cache dilewati: ' + err.message);
  }
  return data;
}

// Panggil fungsi ini setelah edit data penting agar perubahan langsung tampil.
function resetCacheKatalog() {
  cache_().remove(CACHE_KEY);
}

// ============================================================
// ADMIN: unggah foto, foto transparan (PNG), dan model 3D (.glb)
// Dipakai oleh admin.html. Semua rahasia disimpan di Script properties,
// BUKAN di kode ini:  Project Settings > Script properties > Add property
//   ADMIN_PASSWORD  : sandi panjang buatan Anda sendiri
//   GITHUB_TOKEN    : fine-grained token GitHub (izin Contents: Read and write, hanya repo katalog)
//   GITHUB_REPO     : pemilik/nama-repo   (contoh: scandiabotanisquarebogor-hue/katalog-3d)
//   GITHUB_BRANCH   : opsional, bawaan "main"
// Setelah mengisi, jalankan cekAdmin() dari editor untuk memeriksa semuanya.
// ============================================================
const COL = { FOTO: 11, PNG: 15, GLB: 16 };
const MAX_FOTO = 12 * 1024 * 1024;  // 12 MB (hasil decode)
const MAX_GLB  = 25 * 1024 * 1024;  // 25 MB
const props_ = () => PropertiesService.getScriptProperties();

function doPost(e) {
  var lock = null;
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    auth_(req.pw);
    if (req.action === 'list') return out_({ ok: true, items: adminList_(), info: adminInfo_() });
    lock = LockService.getScriptLock();
    lock.waitLock(25000);
    switch (req.action) {
      case 'foto':  return out_(upFoto_(req));
      case 'png':   return out_(upPng_(req));
      case 'glb':   return out_(upGlb_(req));
      case 'lepas': return out_(lepas_(req));
      case 'tambah': return out_(tambah_(req));
      case 'ubah':   return out_(ubah_(req));
      default: throw new Error('Aksi tidak dikenal.');
    }
  } catch (err) {
    console.error(err);
    return out_({ ok: false, error: String(err && err.message || err) });
  } finally {
    if (lock) { try { lock.releaseLock(); } catch (x) {} }
  }
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// Cek sandi + batasi percobaan salah (8 kali per 10 menit)
function auth_(pw) {
  var c = cache_(), key = 'admin_gagal', n = Number(c.get(key) || 0);
  if (n >= 8) throw new Error('Terlalu banyak percobaan salah. Coba lagi dalam 10 menit.');
  var real = props_().getProperty('ADMIN_PASSWORD');
  if (!real) throw new Error('ADMIN_PASSWORD belum diatur di Script properties.');
  if (!pw || String(pw) !== real) { c.put(key, String(n + 1), 600); throw new Error('Sandi salah.'); }
  c.remove(key);
}

function adminList_() {
  return sh_(SHEET_PRODUK).getDataRange().getValues().slice(1)
    .filter(function (r) { return r[0]; })
    .map(function (r) {
      return {
        k: String(r[0]).trim(), n: String(r[1] || ''), c: String(r[2] || ''),
        p: Number(r[3]) || 0, s: Number(r[4]) || 0, m: String(r[8] || ''), d: String(r[9] || ''), e: String(r[11] || ''),
        pj: Number(r[5]) || 0, l: Number(r[6]) || 0, t: Number(r[7]) || 0,
        aktif: String(r[12]).toUpperCase() === 'YA',
        sk: String(r[16] || '').trim().toUpperCase() === 'TIDAK' ? 0 : 1,
        foto: fotoList_(r[10]).map(function (o) { return o.u; }),
        png: r[14] ? foto_(r[14]) : '',
        glb: String(r[15] || '').trim()
      };
    });
}

function adminInfo_() {
  var p = props_();
  return { github: !!(p.getProperty('GITHUB_TOKEN') && p.getProperty('GITHUB_REPO')) };
}

function row_(kode) {
  var sh = sh_(SHEET_PRODUK), n = sh.getLastRow();
  var v = sh.getRange(1, 1, n, 1).getValues();
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]).trim() === String(kode || '').trim()) return i + 1;
  }
  throw new Error('Kode produk "' + kode + '" tidak ditemukan di sheet Produk.');
}

function aman_(s) { return String(s || '').replace(/[^\w.-]/g, '_').slice(0, 40); }
function stempel_() { return Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMdd-HHmmss'); }

// Folder induk di Drive (dibuat otomatis sekali) + subfolder "foto" dan "png"
function folder_(nama) {
  var p = props_(), root = null, id = p.getProperty('DRIVE_FOLDER_ID');
  if (id) { try { root = DriveApp.getFolderById(id); } catch (e) { root = null; } }
  if (!root) { root = DriveApp.createFolder('Katalog SCANDIA BOTANI'); p.setProperty('DRIVE_FOLDER_ID', root.getId()); }
  var it = root.getFoldersByName(nama);
  return it.hasNext() ? it.next() : root.createFolder(nama);
}

function simpanDrive_(req, subfolder) {
  var rowIdx = row_(req.kode), mime = String(req.mime || '');
  if (mime !== 'image/jpeg' && mime !== 'image/png') throw new Error('Jenis file harus JPG atau PNG.');
  var bytes = Utilities.base64Decode(String(req.data || ''));
  if (!bytes.length) throw new Error('File kosong.');
  if (bytes.length > MAX_FOTO) throw new Error('File terlalu besar (maksimal 12 MB).');
  var nama = aman_(req.kode) + '_' + stempel_() + '_' + Math.floor(Math.random() * 900 + 100) + (mime === 'image/png' ? '.png' : '.jpg');
  var file = folder_(subfolder).createFile(Utilities.newBlob(bytes, mime, nama));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { row: rowIdx, url: 'https://drive.google.com/file/d/' + file.getId() + '/view' };
}

function upFoto_(req) {
  var s = simpanDrive_(req, 'foto');
  var cell = sh_(SHEET_PRODUK).getRange(s.row, COL.FOTO), cur = String(cell.getValue() || '').trim();
  cell.setValue(req.mode === 'ganti' || !cur ? s.url : cur + '\n' + s.url);
  resetCacheKatalog();
  return { ok: true, url: s.url };
}

function upPng_(req) {
  if (String(req.mime) !== 'image/png') throw new Error('Foto tanpa background harus berformat PNG.');
  var s = simpanDrive_(req, 'png');
  sh_(SHEET_PRODUK).getRange(s.row, COL.PNG).setValue(s.url);
  resetCacheKatalog();
  return { ok: true, url: s.url };
}

function upGlb_(req) {
  var rowIdx = row_(req.kode);
  var bytes = Utilities.base64Decode(String(req.data || ''));
  if (bytes.length < 12 || (bytes[0] & 255) !== 0x67 || (bytes[1] & 255) !== 0x6C || (bytes[2] & 255) !== 0x54 || (bytes[3] & 255) !== 0x46) {
    throw new Error('File bukan .glb yang valid.');
  }
  if (bytes.length > MAX_GLB) throw new Error('Model terlalu besar (maksimal 25 MB).');
  var path = 'models/' + aman_(req.kode).toLowerCase() + '-' + stempel_() + '.glb';
  var url = githubPut_(path, bytes, 'Model 3D ' + req.kode);
  sh_(SHEET_PRODUK).getRange(rowIdx, COL.GLB).setValue(url);
  resetCacheKatalog();
  return { ok: true, url: url, note: 'GitHub Pages butuh sekitar 1-2 menit sebelum model bisa dibuka.' };
}

// Lepas tautan dari sheet (file di Drive/GitHub tidak dihapus)
function lepas_(req) {
  var rowIdx = row_(req.kode), sh = sh_(SHEET_PRODUK);
  if (req.kolom === 'foto') {
    var cell = sh.getRange(rowIdx, COL.FOTO);
    var raw = String(cell.getValue() || '').split(/[\s,;|]+/).map(function (s) { return s.trim(); }).filter(String);
    var i = Number(req.index);
    if (!(i >= 0 && i < raw.length)) throw new Error('Foto tidak ditemukan.');
    raw.splice(i, 1);
    cell.setValue(raw.join('\n'));
  } else if (req.kolom === 'png') {
    sh.getRange(rowIdx, COL.PNG).clearContent();
  } else if (req.kolom === 'glb') {
    sh.getRange(rowIdx, COL.GLB).clearContent();
  } else {
    throw new Error('Kolom tidak dikenal.');
  }
  resetCacheKatalog();
  return { ok: true };
}

// Kirim file ke GitHub (REST API). Token dibaca dari Script properties.
function githubPut_(path, bytes, pesan) {
  var p = props_(), token = p.getProperty('GITHUB_TOKEN'), repo = p.getProperty('GITHUB_REPO'), branch = p.getProperty('GITHUB_BRANCH') || 'main';
  if (!token || !repo) throw new Error('GITHUB_TOKEN / GITHUB_REPO belum diatur di Script properties.');
  var api = 'https://api.github.com/repos/' + repo + '/contents/' + path.split('/').map(encodeURIComponent).join('/');
  var headers = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'katalog-admin' };
  var body = { message: pesan, content: Utilities.base64Encode(bytes), branch: branch };
  var res = UrlFetchApp.fetch(api, { method: 'put', contentType: 'application/json', headers: headers, payload: JSON.stringify(body), muteHttpExceptions: true });
  var code = res.getResponseCode();
  if (code !== 200 && code !== 201) {
    var msg = ''; try { msg = JSON.parse(res.getContentText()).message || ''; } catch (e) {}
    if (code === 401) throw new Error('Token GitHub tidak valid atau kedaluwarsa.');
    if (code === 403 || code === 404) throw new Error('GitHub menolak (' + code + '). Pastikan token punya izin Contents: Read and write untuk repo ' + repo + '. ' + msg);
    throw new Error('GitHub gagal (' + code + '): ' + msg);
  }
  return pagesUrl_(path);
}

function pagesUrl_(path) {
  var repo = props_().getProperty('GITHUB_REPO').split('/'), owner = repo[0].toLowerCase(), name = repo[1];
  var base = name.toLowerCase() === owner + '.github.io' ? 'https://' + owner + '.github.io/' : 'https://' + owner + '.github.io/' + name + '/';
  return base + path;
}

// Jalankan sekali dari editor setelah mengisi Script properties: cek semua pengaturan.
function cekAdmin() {
  var p = props_(), log = [];
  ['ADMIN_PASSWORD', 'GITHUB_TOKEN', 'GITHUB_REPO'].forEach(function (k) { log.push(k + ': ' + (p.getProperty(k) ? 'OK' : 'BELUM DIISI')); });
  folder_('foto'); folder_('png');
  log.push('Folder Drive: ' + DriveApp.getFolderById(p.getProperty('DRIVE_FOLDER_ID')).getUrl());
  var repo = p.getProperty('GITHUB_REPO'), token = p.getProperty('GITHUB_TOKEN');
  if (repo && token) {
    var r = UrlFetchApp.fetch('https://api.github.com/repos/' + repo, { headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'User-Agent': 'katalog-admin' }, muteHttpExceptions: true });
    var code = r.getResponseCode(), izin = '';
    try { var j = JSON.parse(r.getContentText()); izin = j.permissions ? (j.permissions.push ? 'boleh menulis' : 'TIDAK boleh menulis') : ''; } catch (e) {}
    log.push('GitHub: HTTP ' + code + (code === 200 ? ' (repo ditemukan, ' + izin + ')' : ' (periksa token / nama repo)'));
  }
  Logger.log(log.join('\n'));
  return log.join('\n');
}

// ---------- TAMBAH / EDIT PRODUK (dipakai admin.html) ----------
var ILUSTRASI_OK = ['kursi', 'kerja', 'meja', 'mejakerja', 'sofa', 'lemari', 'rak', 'lampu'];

// Teks yang diawali = + - @ bisa dibaca Sheets sebagai rumus; beri tanda petik di depannya.
function teks_(s) {
  s = String(s || '');
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function dataProduk_(req) {
  var d = req.data || {};
  var nama = String(d.nama || '').trim();
  if (!nama) throw new Error('Nama produk wajib diisi.');
  function angka(v, label, desimal) {
    var s = String(v === undefined || v === null ? '' : v).trim().replace(',', '.');
    if (s === '') return '';
    var n = Number(s);
    if (!isFinite(n) || n < 0) throw new Error(label + ' harus berupa angka 0 atau lebih.');
    return desimal ? Math.round(n * 100) / 100 : Math.round(n);
  }
  var ilus = String(d.ilustrasi || '').trim().toLowerCase();
  if (ilus && ILUSTRASI_OK.indexOf(ilus) < 0) throw new Error('Ilustrasi tidak dikenal.');
  return {
    nama: nama.slice(0, 120), kategori: String(d.kategori || '').trim().slice(0, 40),
    harga: angka(d.harga, 'Harga'), stok: angka(d.stok, 'Stok'),
    pj: angka(d.pj, 'Panjang', true), l: angka(d.l, 'Lebar', true), t: angka(d.t, 'Tinggi', true),
    material: String(d.material || '').trim().slice(0, 200), ket: String(d.ket || '').trim().slice(0, 500),
    ilustrasi: ilus,
    aktif: String(d.aktif).toUpperCase() === 'TIDAK' ? 'TIDAK' : 'YA',
    skala: String(d.skala).toUpperCase() === 'TIDAK' ? 'TIDAK' : ''
  };
}

function qrBaris_(sh, row) {
  var ref = urlRefConfig_();
  sh.getRange(row, 14).setFormula('=IFERROR(IMAGE("https://quickchart.io/qr?size=220&text="&ENCODEURL(' + ref + '&"?kode="&A' + row + ')))');
  sh.setRowHeight(row, 110);
}

function tambah_(req) {
  var kode = String(req.kode || '').trim();
  if (!/^[\w.-]{2,30}$/.test(kode)) throw new Error('Kode hanya boleh huruf, angka, titik, strip, dan garis bawah (2-30 karakter).');
  var sh = sh_(SHEET_PRODUK), last = sh.getLastRow();
  var ada = last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues() : [];
  for (var i = 0; i < ada.length; i++) {
    if (String(ada[i][0]).trim().toLowerCase() === kode.toLowerCase()) throw new Error('Kode "' + kode + '" sudah dipakai produk lain.');
  }
  var d = dataProduk_(req);
  sh.appendRow([kode, teks_(d.nama), teks_(d.kategori), d.harga, d.stok, d.pj, d.l, d.t, teks_(d.material), teks_(d.ket), '', d.ilustrasi, d.aktif, '', '', '', d.skala]);
  qrBaris_(sh, sh.getLastRow());
  resetCacheKatalog();
  return { ok: true, kode: kode };
}

function ubah_(req) {
  var row = row_(req.kode), sh = sh_(SHEET_PRODUK), d = dataProduk_(req);
  sh.getRange(row, 2, 1, 9).setValues([[teks_(d.nama), teks_(d.kategori), d.harga, d.stok, d.pj, d.l, d.t, teks_(d.material), teks_(d.ket)]]);
  sh.getRange(row, 12).setValue(d.ilustrasi);
  sh.getRange(row, 13).setValue(d.aktif);
  sh.getRange(row, 17).setValue(d.skala);
  resetCacheKatalog();
  return { ok: true };
}
