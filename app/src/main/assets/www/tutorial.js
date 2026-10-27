'use strict';
/* Tutorial Cmode di dalam aplikasi (bahasa Indonesia). Dokumentasi kodule diambil dari CModules.defs. */
const Tutorial = (() => {
  const code = c => '<pre class="tcode">' + esc(c) + '</pre>';
  const copyBtn = (c, ttl) => '<div class="trow"><button class="btn sm" data-tcopy="' + esc(c) + '">Salin</button><button class="btn sm primary" data-tinstall="' + esc(c) + '" data-ttl="' + esc(ttl || 'contoh') + '">Pasang di proyek</button></div>';
  const ex = (ttl, c) => '<div class="tex"><b>' + esc(ttl) + '</b>' + code(c) + copyBtn(c, ttl) + '</div>';

  const BASIC = '<h2>Dasar Cmode</h2><p>Cmode adalah bahasa pemrograman sederhana, mirip Python. File-nya berakhiran <code>.cd</code> (contoh <code>utama.cd</code>). Tambah lewat Kode &rarr; <b>+ CD</b>.</p>' +
    '<h3>1. Ambil kodule</h3><p><i>Kodule</i> = modul = kotak perkakas. Sebelum dipakai harus diimpor di atas file:</p>' + code('kodule player impor\nkodule jump impor') +
    '<h3>2. Komentar</h3>' + code('{-- ini komentar satu atau banyak baris --}\n# ini komentar satu baris') +
    '<h3>3. Variabel</h3><p>Variabel menyimpan angka, teks, benar/salah, daftar, atau kamus. Nama animasi juga cuma teks:</p>' + code('nyawa_awal = 3\nnama = "Hero"\nJump = "Lompat2"      {-- nama animasi disimpan di variabel --}\njump.anim = Jump\ndaftar = [1, 2, 3]\nkamus = {"a": 1}') +
    '<h3>4. Fungsi</h3><p>Dibuat dengan <code>def</code> (atau <code>fungsi</code>). Isi fungsi harus menjorok 4 spasi:</p>' + code('def tambah(a, b):\n    return a + b\n\nprint(tambah(2, 3))') +
    '<h3>5. Jika / selama / untuk</h3>' + code('jika x > 5:\n    print("besar")\natau_jika x == 5:\n    print("pas")\nlainnya:\n    print("kecil")\n\nuntuk i dalam range(3):\n    print(i)\n\nselama n < 10:\n    n = n + 1') +
    '<p>Kata Inggris juga boleh: <code>if elif else while for in return and or not True False None</code>. Versi Indonesia: <code>jika atau_jika lainnya selama untuk dalam kembali dan atau bukan benar salah kosong</code>.</p>' +
    '<h3>6. Fungsi bawaan</h3><p><code>print/cetak, len/panjang, str, int, float, abs, round, min, max, sum, range</code>. String format: <code>f"Skor {skor.sekarang()}"</code>.</p>' +
    '<h3>7. Kalau error</h3><p>Di editor, bar di bawah kode menunjukkan <b>Baris N: pesan</b>. Saat game jalan, error muncul sebagai pesan kecil dengan nomor baris.</p>';

  const EVT = () => '<h2>Peristiwa (event)</h2><p>Kalau kamu menulis fungsi dengan nama di bawah, mesin game memanggilnya otomatis. Tidak wajib semua.</p><table class="ttab">' +
    CModules.events.map(e => '<tr><td><code>def ' + esc(e[0]) + ':</code></td><td>' + esc(e[1]) + '</td></tr>').join('') + '</table>' +
    '<p>Kalau kamu menulis <code>tombol_kanan</code>, <code>tombol_kiri</code>, atau <code>tombol_lompat</code>, kamu yang mengatur geraknya sendiri (mis. <code>walk.jalan(1)</code>). Kalau tidak ditulis, joystick dan tombol lompat bekerja otomatis.</p>' +
    ex('Contoh: karakter utama', DEFAULT_CD);

  let Q = '';
  const shown = () => CModules.defs.filter(m => !Q || (m.n + ' ' + m.judul + ' ' + m.desc + ' ' + m.f.map(f => f[0] + ' ' + f[2]).join(' ')).toLowerCase().includes(Q));
  const MODS = () => '<h2>' + CModules.defs.length + ' Kodule</h2><input class="input" id="tq" placeholder="Cari kodule atau fungsi, mis. salju, lompat, suara..." value="' + esc(Q) + '"><div class="chips" style="margin-top:8px">' + shown().map(m => '<a class="chip" href="#" data-tgo="m_' + m.n + '">' + m.n + '</a>').join('') + '</div>' +
    shown().map(m => '<div class="tmod" id="m_' + m.n + '"><h3>' + esc(m.n) + ' <small>' + esc(m.judul) + '</small></h3><p>' + esc(m.desc) + '</p><p class="small">Tulis di atas file: <code>kodule ' + m.n + ' impor</code></p>' +
      m.f.map(f => '<div class="tfn"><code class="sig">' + m.n + '.' + f[0] + esc(f[1]) + '</code><div>' + esc(f[2]) + '</div>' + code(f[3]) + '</div>').join('') +
      (m.p || []).map(p => '<div class="tfn"><code class="sig">' + m.n + '.' + p[0] + '</code> <small>(properti)</small><div>' + esc(p[1]) + '</div></div>').join('') + '</div>').join('');

  const EXAMPLES = () => '<h2>Contoh jadi</h2>' +
    ex('Ketuk teks &rarr; skor naik', EXAMPLE_CD) +
    ex('Koin, musuh, nyawa', ['kodule item impor', 'kodule musuh impor', 'kodule nyawa impor', 'kodule skor impor', 'kodule ui impor', '', 'def mulai():', '    nyawa.atur(3)', '    nyawa.tampil()', '    skor.tampil()', '    item.buat("k1", "Koin", 400, 300)', '    item.buat("k2", "Koin", 460, 300)', '    musuh.buat("m1", "Slime", 800, 340, 120, 60)', '', 'def mati():', '    ui.teks("go", "Game over", 40, 40, 30)', '    waktu_ulang()', '', 'kodule waktu impor', 'def waktu_ulang():', '    waktu.tunda(2000, ulang)', '', 'def ulang():', '    ui.hapus("go")', '    nyawa.atur(3)', '    player.reset()'].join('\n')) +
    ex('Dialog dengan pilihan', ['kodule dialog impor', 'kodule scene impor', '', 'def mulai():', '    scene.buat("gua")', '    dialog.tanya("Masuk gua?", ["Ya", "Tidak"], jawab)', '', 'def jawab(nomor, teks):', '    jika nomor == 0:', '        scene.pindah("gua")'].join('\n')) +
    ex('Musik + suara + simpan data', ['kodule music impor', 'kodule sfx impor', 'kodule save impor', 'kodule skor impor', '', 'def mulai():', '    music.putar("latar")      {-- impor file "latar" di tab Suara --}', '    rekor = save.muat("rekor", 0)', '    print("Rekor:", rekor)', '', 'def tombol_lompat():', '    sfx.putar("lompat")'].join('\n')) +
    ex('Animasi bernama Startled saat teks diketuk', ['kodule teks impor', '', 'def klik_teks(id):', '    jika id == "ketuk":', '        teks.jadi_animasi("ketuk", "Startled", 2000)'].join('\n'));

  const STUDIO = '<h2>Alat studio</h2>' +
    '<h3>Pengaturan game</h3><p>Tombol <b>Pengaturan</b> di editor: gravitasi, kecepatan jalan, tinggi lompat, lompat ganda, zoom, nyawa, latar, siklus hari, cuaca, musik latar, titik mulai, ukuran dan posisi kontrol (mode kidal), tombol jeda, debug, dan konsol. Semua berlaku otomatis tanpa kode.</p>' +
    '<h3>Panggung: Teks, Platform, Objek, Mulai</h3><p><b>Platform</b>: tambah, seret, lebarkan lewat ujung kanan. <b>Objek</b>: taruh benda, item (koin), dan musuh dari animasi mana pun, lalu beri ID untuk dipakai di kode. <b>Mulai</b>: tentukan titik awal pemain.</p>' +
    '<h3>Pustaka aset</h3><p>Sprite siap pakai (slime, koin, kelelawar, peti, pintu, dll), 6 latar, 8 musik, dan 23 efek suara. Nama musik dan efek bisa langsung dipanggil di kode tanpa mengimpor: <code>music.putar("petualangan")</code>, <code>sfx.putar("koin")</code>.</p>' +
    '<h3>Alat animasi</h3><p>Onion skin, balik / putar frame, balik urutan, salin frame ke animasi lain, potong sprite sheet, mode putar (ulang, sekali, maju mundur), duplikat animasi dan sprite.</p>' +
    '<h3>Kode</h3><p>Undo / redo, cari dan ganti, snippet, ukuran huruf, indent otomatis, duplikat file, impor file .cd .js .css.</p>' +
    '<h3>Proyek</h3><p>Menu &rarr; Ekspor (.prosprite), Backup dan pulihkan, Statistik. Di beranda: Impor proyek. Proyek baru bisa mulai dari template.</p>' +
    '<h3>Saat game jalan</h3><p>Tombol jeda: lanjut, ulangi, debug (hitbox + FPS), konsol (hasil <code>print</code> dan error), foto layar.</p>';
  const GAME = '<h2>Publish &amp; Game</h2><p>1. Beranda &rarr; tab <b>Akun</b> &rarr; Login GitHub (ikuti petunjuk di layar).</p><p>2. Di editor tekan <b>Publish</b>. Proyek diunggah jadi repo publik di GitHub-mu.</p><p>3. Orang lain membuka tab <b>Game</b>, memilih game, lalu Main.</p>' +
    '<p><b>Keamanan:</b> game dari orang lain hanya menjalankan file <code>.cd</code> (Cmode). File JS/CSS tidak ikut dipublish dan tidak dijalankan.</p>';

  const CH = [['Dasar', () => BASIC], ['Peristiwa', EVT], ['Kodule', MODS], ['Contoh', EXAMPLES], ['Studio', () => STUDIO], ['Publish', () => GAME]];
  let cur = 0, root = null;
  function draw() {
    root.innerHTML = '<header class="topbar"><button class="icon-btn" data-tx="close">' + I.back + '</button><b style="margin-left:4px">Tutorial Cmode</b></header><div class="tut-main"><nav class="tnav">' +
      CH.map((c, i) => '<button class="' + (i === cur ? 'on' : '') + '" data-tch="' + i + '">' + c[0] + '</button>').join('') + '</nav><article class="tbody" id="tbody">' + CH[cur][1]() + '</article></div>';
  }
  function onInputT(e) { if (e.target.id === 'tq') { Q = e.target.value.trim().toLowerCase(); const pos = e.target.selectionStart; draw(); const el = document.getElementById('tq'); if (el) { el.focus(); el.setSelectionRange(pos, pos); } } }
  async function onClick(e) {
    const t = e.target;
    const ch = t.closest('[data-tch]'); if (ch) { cur = +ch.dataset.tch; draw(); return; }
    if (t.closest('[data-tx="close"]')) { close(); return; }
    const go = t.closest('[data-tgo]'); if (go) { e.preventDefault(); const el = document.getElementById(go.dataset.tgo); if (el) el.scrollIntoView({ behavior: 'smooth' }); return; }
    const cp = t.closest('[data-tcopy]'); if (cp) { const v = cp.dataset.tcopy; try { await navigator.clipboard.writeText(v); toast('Disalin'); } catch (er) { const ta = document.createElement('textarea'); ta.value = v; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('Disalin'); } catch (e2) { toast('Gagal menyalin'); } ta.remove(); } return; }
    const ins = t.closest('[data-tinstall]'); if (ins) {
      if (!S.project) return toast('Buka proyek dulu');
      const f = { id: uid(), name: 'contoh' + (S.project.scripts.filter(x => /\.cd$/i.test(x.name)).length + 1) + '.cd', code: ins.dataset.tinstall };
      S.project.scripts.push(f); dirty(); toast('Dipasang sebagai ' + f.name + ' (file lain yang ber-fungsi sama bisa bentrok, hapus yang tidak dipakai)', 4000);
    }
  }
  function open() { if (root) return; root = document.createElement('div'); root.className = 'tutwrap'; document.body.appendChild(root); root.addEventListener('click', onClick); root.addEventListener('input', onInputT); root.addEventListener('dismiss', close); draw(); }
  function close() { if (root) { root.remove(); root = null; } }
  return { open, close, get active() { return !!root; } };
})();
