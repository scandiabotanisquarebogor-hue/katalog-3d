/* katalog-kirim.js
   Penghubung: kirim hasil gambar (PNG) dari aplikasi lain (mis. CutOut Studio) LANGSUNG ke produk di katalog,
   tanpa unduh dan unggah ulang. Cara pakai di aplikasi lain:

     <script src="https://NAMA.github.io/REPO/katalog-kirim.js" data-api="URL_WEB_APP_APPS_SCRIPT"></script>
     ...
     tombolKirim.onclick = function () { KatalogKirim.bukaDariCanvas(canvasHasil); };   // atau
     tombolKirim.onclick = function () { KatalogKirim.buka({ blob: blobPngHasil }); };

   Muncul jendela: masuk (sandi admin) > pilih produk > pilih tujuan > Kirim. */
(function () {
  var S = document.currentScript;
  var CFG = { api: (S && S.getAttribute("data-api")) || window.KATALOG_API || "", pw: "", items: null };
  try { CFG.pw = localStorage.getItem("katalog_kirim_pw") || ""; } catch (e) {}

  function post(action, data) {
    if (!CFG.api) return Promise.reject(new Error("Alamat Apps Script belum diatur (data-api)."));
    var body = JSON.stringify(Object.assign({ action: action, pw: CFG.pw }, data || {}));
    return fetch(CFG.api, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: body, redirect: "follow" })
      .then(function (r) { return r.text(); })
      .then(function (t) {
        var j; try { j = JSON.parse(t); } catch (e) { throw new Error("Balasan server tidak dikenali."); }
        if (!j.ok) throw new Error(j.error || "Gagal.");
        return j;
      })
      .catch(function (e) { if (e instanceof TypeError) throw new Error("Tidak ada balasan dari server. Periksa koneksi dan alamat Apps Script."); throw e; });
  }

  // Ubah blob gambar menjadi PNG (transparansi dipertahankan), maksimal 1400 px, lalu base64
  function keBase64Png(blob, maxSide) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(blob), im = new Image();
      im.onerror = function () { URL.revokeObjectURL(url); rej(new Error("Gambar tidak bisa dibaca.")); };
      im.onload = function () {
        var s = Math.min(1, maxSide / Math.max(im.width, im.height)), c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(im.width * s)); c.height = Math.max(1, Math.round(im.height * s));
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); res(c.toDataURL("image/png").split(",")[1]);
      };
      im.src = url;
    });
  }

  var CSS = ".ov{position:fixed;inset:0;z-index:2147483000;background:rgba(30,40,34,.5);display:flex;align-items:flex-end;justify-content:center;font:15px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif}" +
    ".bx{background:#f5f7f2;color:#2e3a33;width:100%;max-width:520px;max-height:92vh;overflow:auto;border-radius:22px 22px 0 0;padding:16px 18px calc(18px + env(safe-area-inset-bottom,0px))}" +
    ".hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.hd b{font-size:16px}" +
    ".x{border:0;background:#e6eee7;color:#2e3a33;width:32px;height:32px;border-radius:50%;font-size:18px;cursor:pointer}" +
    ".pv{height:130px;border-radius:14px;background:repeating-conic-gradient(#e9efe8 0 25%,#fff 0 50%) 50%/16px 16px;display:flex;align-items:center;justify-content:center;margin-bottom:12px;overflow:hidden}" +
    ".pv img{max-width:100%;max-height:100%;object-fit:contain}" +
    "input[type=password],input[type=text],select{width:100%;padding:12px 14px;border:1px solid #e3e9e2;border-radius:12px;background:#fff;color:#2e3a33;font-size:15px;margin-top:6px}" +
    "select[size]{padding:6px}label{display:block;font-size:13px;color:#7d8a82;margin-top:10px}.rad{display:flex;gap:8px;align-items:flex-start;color:#2e3a33;font-size:13.5px;margin-top:8px}" +
    ".go{width:100%;margin-top:14px;padding:14px;border:0;border-radius:999px;background:#6f9c84;color:#fff;font-weight:600;font-size:14px;cursor:pointer}.go:disabled{opacity:.45}" +
    ".go.gh{background:transparent;color:#4d7a63;border:1px solid #6f9c84}#msg{margin-top:10px;font-size:13px;white-space:pre-wrap}.ok{color:#4d7a63}.er{color:#9a3d2c}";

  function buka(opt) {
    opt = opt || {};
    if (!opt.blob) return Promise.reject(new Error("Gambar (blob) belum diberikan."));
    var old = document.getElementById("katalog-kirim-host"); if (old) old.remove();
    var host = document.createElement("div"); host.id = "katalog-kirim-host"; document.body.appendChild(host);
    var root = host.attachShadow({ mode: "open" });
    var purl = URL.createObjectURL(opt.blob);
    root.innerHTML = "<style>" + CSS + "</style><div class='ov'><div class='bx'><div class='hd'><b>Kirim ke katalog</b><button class='x' id='x' aria-label='Tutup'>×</button></div>" +
      "<div class='pv'><img src='" + purl + "' alt=''></div><div id='step'></div><div id='msg'></div></div></div>";
    var $ = function (i) { return root.getElementById ? root.getElementById(i) : root.querySelector("#" + i); };
    function tutup() { URL.revokeObjectURL(purl); host.remove(); }
    $("x").onclick = tutup;
    root.querySelector(".ov").onclick = function (e) { if (e.target === this) tutup(); };
    function msg(t, c) { var m = $("msg"); m.className = c || ""; m.textContent = t || ""; }
    function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

    function langkahMasuk() {
      $("step").innerHTML = "<label>Sandi admin katalog</label><input type='password' id='pw' autocomplete='current-password'><label class='rad'><input type='checkbox' id='ingat' checked> Ingat sandi di perangkat ini</label><button class='go' id='masuk'>Masuk</button>";
      var go = function () {
        var v = $("pw").value; if (!v) { msg("Isi sandi dulu.", "er"); return; }
        CFG.pw = v; $("masuk").disabled = true; msg("Memeriksa…");
        post("list").then(function (j) {
          CFG.items = j.items;
          try { if ($("ingat").checked) localStorage.setItem("katalog_kirim_pw", v); else localStorage.removeItem("katalog_kirim_pw"); } catch (e) {}
          msg(""); langkahPilih();
        }).catch(function (e) { CFG.pw = ""; msg(e.message, "er"); $("masuk").disabled = false; });
      };
      $("masuk").onclick = go; $("pw").onkeydown = function (e) { if (e.key === "Enter") go(); };
    }

    function langkahPilih() {
      $("step").innerHTML = "<label>Produk</label><input type='text' id='cari' placeholder='Cari kode atau nama' autocomplete='off'><select id='sel' size='6'></select>" +
        "<label>Simpan sebagai</label><label class='rad'><input type='radio' name='tj' value='png' checked><span><b>Foto tanpa background</b> (kolom Foto transparan PNG, dipakai di Coba di Ruangan)</span></label>" +
        "<label class='rad'><input type='radio' name='tj' value='foto'><span><b>Tambahan foto produk</b> (masuk galeri di kolom Foto)</span></label><button class='go' id='kirim' disabled>Kirim</button>";
      function isi() {
        var q = $("cari").value.toLowerCase(), sel = $("sel"), prev = sel.value;
        sel.innerHTML = (CFG.items || []).filter(function (x) { return (x.k + " " + x.n).toLowerCase().indexOf(q) >= 0; })
          .map(function (x) { return "<option value='" + esc(x.k) + "'>" + esc(x.k) + " — " + esc(x.n) + "</option>"; }).join("");
        if (prev && sel.querySelector("option[value='" + prev.replace(/'/g, "") + "']")) sel.value = prev;
        $("kirim").disabled = !sel.value;
      }
      $("cari").oninput = isi; $("sel").onchange = function () { $("kirim").disabled = !$("sel").value; }; isi();
      $("kirim").onclick = function () {
        var kode = $("sel").value; if (!kode) return;
        var tj = root.querySelector("input[name=tj]:checked").value;
        $("kirim").disabled = true; msg("Mengirim…");
        keBase64Png(opt.blob, 1400).then(function (d) { return post(tj, { kode: kode, mime: "image/png", data: d, mode: "tambah" }); })
          .then(function (j) {
            msg("Terkirim ke " + kode + " (" + (tj === "png" ? "kolom Foto transparan PNG" : "kolom Foto") + "). Katalog ikut diperbarui sekitar 1 menit.", "ok");
            $("step").innerHTML = "<button class='go' id='lagi'>Kirim ke produk lain</button><button class='go gh' id='tutup'>Selesai</button>";
            $("lagi").onclick = function () { msg(""); langkahPilih(); }; $("tutup").onclick = tutup;
            if (typeof opt.onSelesai === "function") { try { opt.onSelesai({ kode: kode, tujuan: tj, url: j.url }); } catch (e) {} }
          })
          .catch(function (e) {
            if (/Sandi salah|ADMIN_PASSWORD/.test(e.message)) { CFG.pw = ""; try { localStorage.removeItem("katalog_kirim_pw"); } catch (x) {} msg(e.message, "er"); langkahMasuk(); return; }
            msg(e.message, "er"); $("kirim").disabled = false;
          });
      };
    }

    if (CFG.pw) {
      msg("Memuat daftar produk…");
      post("list").then(function (j) { CFG.items = j.items; msg(""); langkahPilih(); })
        .catch(function (e) { CFG.pw = ""; msg(/Sandi/.test(e.message) ? "" : e.message, "er"); langkahMasuk(); });
    } else langkahMasuk();
    return Promise.resolve();
  }

  function bukaDariCanvas(canvas, opt) {
    return new Promise(function (res, rej) {
      canvas.toBlob(function (b) { if (!b) return rej(new Error("Gambar kosong.")); res(buka(Object.assign({}, opt, { blob: b }))); }, "image/png");
    });
  }

  window.KatalogKirim = { buka: buka, bukaDariCanvas: bukaDariCanvas, config: function (o) { if (o && o.api) CFG.api = o.api; } };
})();
