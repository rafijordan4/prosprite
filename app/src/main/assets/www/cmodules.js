'use strict';
/* =====================================================================
   cmodules.js: 30 kodule bawaan Cmode + dokumentasinya (dipakai juga oleh Tutorial)
   Format fungsi: [nama, tandaTangan, penjelasan, contoh, implementasi(E, ...argumen)]
   ===================================================================== */
(function (G) {
const d = (v, def) => (v === null || v === undefined ? def : v);
const sh = v => Cmode.show(v);
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

/* area benda: kotak dengan titik jangkar tengah-bawah */
function playerBox(E) { const a = E.a; return { x: E.P.x, y: E.P.y, w: a.hw * 2 * a.hitScale, h: Math.max(20, a.dh * 0.85) }; }
function overlap(E, bx, by, bw, bh) { const p = playerBox(E); return Math.abs(p.x - bx) < (p.w + bw) / 2 && p.y > by - bh && p.y - p.h < by; }
function entList(E, id) { const e = E.ent(id); if (!e) throw new Error('Benda dengan ID "' + id + '" tidak ada'); return e; }

const DEFS = [
{ n: 'player', judul: 'Pemain', desc: 'Mengatur karakter yang kamu mainkan.', f: [
  ['buat', '(nama)', 'Pilih ProSprite bernama nama sebagai pemain. Benar kalau ketemu, Salah kalau tidak (pemain tetap yang sekarang).', 'player.buat("Hero")', (E, nama) => E.setPlayer(E.text(nama, 'Nama'))],
  ['posisi', '(x, y)', 'Pindahkan pemain ke titik x, y di dunia (dunia lebarnya 1800, tinggi 400, tanah di y=340).', 'player.posisi(200, 340)', (E, x, y) => { E.teleport(E.num(x, 'x'), E.num(y, 'y')); return null; }],
  ['x', '()', 'Posisi x pemain sekarang.', 'if player.x() > 900: ...', E => E.P.x],
  ['y', '()', 'Posisi y kaki pemain sekarang (makin kecil makin tinggi).', 'tinggi = 340 - player.y()', E => E.P.y],
  ['kecepatan_x', '()', 'Kecepatan mendatar pemain.', 'v = player.kecepatan_x()', E => E.P.vx],
  ['kecepatan_y', '()', 'Kecepatan tegak pemain (positif = jatuh).', 'if player.kecepatan_y() > 0: ...', E => E.P.vy],
  ['di_tanah', '()', 'Benar kalau pemain sedang berpijak.', 'if player.di_tanah(): ...', E => E.P.onGround],
  ['hadap', '(arah)', 'Atur arah hadap: 1 = kanan, -1 = kiri.', 'player.hadap(-1)', (E, r) => { E.P.facing = E.num(r, 'arah') < 0 ? -1 : 1; return null; }],
  ['skala', '(n)', 'Ubah ukuran pemain (1 = normal, 2 = dua kali).', 'player.skala(1.5)', (E, n) => { E.setScale(clampN(E.num(n, 'n'), 0.2, 6)); return null; }],
  ['bicara', '(teks, ms=1500)', 'Munculkan gelembung ucapan di atas kepala pemain.', 'player.bicara("Halo!", 2000)', (E, t, ms) => { E.Pro.say(sh(t), d(ms, 1500)); return null; }],
  ['sembunyi', '(ya=True)', 'Sembunyikan atau tampilkan pemain.', 'player.sembunyi(False)', (E, ya) => { E.a.hidden = !!d(ya, true); return null; }],
  ['reset', '()', 'Kembalikan pemain ke titik awal scene.', 'player.reset()', E => { E.resetPlayer(); return null; }]
] },
{ n: 'idle', judul: 'Diam (Idle)', desc: 'Animasi saat pemain berdiri diam. Otomatis memakai animasi bernama Idle.', f: [
  ['aktif', '()', 'Paksa animasi diam tampil sebentar.', 'idle.aktif()', E => { E.forceAnim(E.a.an.idle, 500); return null; }],
  ['pakai', '(nama_animasi)', 'Pakai animasi lain (nama harus sama persis) untuk keadaan diam.', 'idle.pakai("Napas")', (E, n) => { E.useAnim('idle', E.text(n, 'Nama animasi')); return null; }],
  ['kecepatan', '(fps)', 'Atur kecepatan animasi diam (frame per detik).', 'idle.kecepatan(6)', (E, f) => { E.a.an.idle = Object.assign({}, E.a.an.idle, { fps: clampN(E.num(f, 'fps'), 1, 60) }); return null; }]
], p: [['anim', 'Nama animasi diam. Bisa diisi: idle.anim = "Napas".', E => E.animName('idle'), (E, v) => E.useAnim('idle', E.text(v, 'Nama animasi'))]] },
{ n: 'walk', judul: 'Jalan (Walk)', desc: 'Kecepatan dan animasi jalan. Otomatis memakai animasi bernama Walk / Walking.', f: [
  ['atur_kecepatan', '(n)', 'Atur kecepatan jalan. Bawaan 5.', 'walk.atur_kecepatan(7)', (E, n) => { E.setWalk(clampN(E.num(n, 'Kecepatan'), 0, 30)); return null; }],
  ['kecepatan', '()', 'Kecepatan jalan sekarang.', 'k = walk.kecepatan()', E => E.a.walkU],
  ['aktif', '()', 'Izinkan pemain berjalan.', 'walk.aktif()', E => { E.a.canWalk = true; return null; }],
  ['mati', '()', 'Larang pemain berjalan (misalnya saat cerita).', 'walk.mati()', E => { E.a.canWalk = false; return null; }],
  ['jalan', '(arah)', 'Jalankan pemain 1 frame ke arah -1 (kiri) sampai 1 (kanan), tanpa joystick. Panggil tiap frame.', 'walk.jalan(1)', (E, r) => { E.a.autoX = clampN(E.num(r, 'arah'), -1, 1); return null; }],
  ['pakai', '(nama_animasi)', 'Pakai animasi lain untuk berjalan.', 'walk.pakai("Lari")', (E, n) => { E.useAnim('walk', E.text(n, 'Nama animasi')); return null; }],
  ['kecepatan_anim', '(fps)', 'Atur kecepatan animasi jalan.', 'walk.kecepatan_anim(16)', (E, f) => { E.a.an.walk = Object.assign({}, E.a.an.walk || E.a.an.idle, { fps: clampN(E.num(f, 'fps'), 1, 60) }); return null; }]
], p: [['anim', 'Nama animasi jalan. Bisa diisi: walk.anim = "Lari".', E => E.animName('walk'), (E, v) => E.useAnim('walk', E.text(v, 'Nama animasi'))]] },
{ n: 'jump', judul: 'Lompat (Jump)', desc: 'Tinggi lompat dan animasi lompat. Otomatis memakai animasi bernama Jump.', f: [
  ['atur_tinggi', '(n)', 'Atur tinggi lompat. Bawaan 12.', 'jump.atur_tinggi(15)', (E, n) => { E.setJump(clampN(E.num(n, 'Tinggi'), 1, 40)); return null; }],
  ['tinggi', '()', 'Tinggi lompat sekarang.', 't = jump.tinggi()', E => E.a.jumpH],
  ['aktif', '()', 'Suruh pemain melompat sekarang (kalau sedang berpijak).', 'jump.aktif()', E => E.doJump(false)],
  ['izinkan', '(ya=True)', 'Boleh atau tidaknya pemain melompat.', 'jump.izinkan(False)', (E, ya) => { E.a.canJump = !!d(ya, true); return null; }],
  ['lompat_ganda', '(jumlah=2)', 'Berapa kali boleh lompat berturut-turut (2 = lompat ganda).', 'jump.lompat_ganda(2)', (E, n) => { E.a.maxJumps = clampN(Math.round(d(n, 2)), 1, 9); E.a.jumpsLeft = E.a.maxJumps - 1; return null; }],
  ['pakai', '(nama_animasi)', 'Pakai animasi lain untuk melompat.', 'jump.pakai("Terbang")', (E, n) => { E.useAnim('jump', E.text(n, 'Nama animasi')); return null; }],
  ['kecepatan_anim', '(fps)', 'Atur kecepatan animasi lompat.', 'jump.kecepatan_anim(12)', (E, f) => { if (E.a.an.jump) E.a.an.jump = Object.assign({}, E.a.an.jump, { fps: clampN(E.num(f, 'fps'), 1, 60) }); return null; }]
], p: [['anim', 'Nama animasi lompat. Bisa diisi: jump.anim = "Terbang".', E => E.animName('jump'), (E, v) => E.useAnim('jump', E.text(v, 'Nama animasi'))]] },
{ n: 'gravity', judul: 'Gravitasi', desc: 'Seberapa kuat pemain ditarik ke bawah.', f: [
  ['atur', '(g)', 'Atur gravitasi. Bumi = 9.8 (bawaan). Bulan = 1.6.', 'gravity.atur(9.8)', (E, g) => { E.setGravity(clampN(E.num(g, 'g'), 0.5, 40)); return null; }],
  ['nilai', '()', 'Gravitasi sekarang.', 'g = gravity.nilai()', E => E.a.gravU],
  ['nyala', '()', 'Nyalakan gravitasi.', 'gravity.nyala()', E => { E.a.gravityOn = true; return null; }],
  ['mati', '()', 'Matikan gravitasi: pemain melayang di tempat.', 'gravity.mati()', E => { E.a.gravityOn = false; E.P.vy = 0; return null; }]
] },
{ n: 'collision', judul: 'Tabrakan', desc: 'Cek tabrakan pemain dengan benda, teks, dan kotak.', f: [
  ['aktif', '()', 'Nyalakan tabrakan dengan platform (bawaan).', 'collision.aktif()', E => { E.a.collide = true; return null; }],
  ['mati', '()', 'Matikan tabrakan dengan platform; pemain hanya berdiri di tanah.', 'collision.mati()', E => { E.a.collide = false; return null; }],
  ['hitbox', '(skala)', 'Perbesar/perkecil kotak tabrakan pemain (1 = normal).', 'collision.hitbox(0.8)', (E, k) => { E.a.hitScale = clampN(E.num(k, 'skala'), 0.2, 3); return null; }],
  ['tabrak', '(id)', 'Benar kalau pemain menyentuh benda / musuh / item / teks ber-ID tersebut.', 'if collision.tabrak("pintu"): ...', (E, id) => {
    const e = E.ent(id); if (e) return overlap(E, e.x, e.y, e.dw * 0.6, e.dh * 0.8);
    const t = E.textFind(id); const bb = t && World._bb.get(t.id);
    if (bb && t.visible !== false) return overlap(E, bb.x + bb.w / 2, bb.y + bb.h, bb.w, bb.h);
    return false;
  }],
  ['sentuh', '(x, y, lebar, tinggi)', 'Benar kalau pemain menyentuh kotak dengan sudut kiri-atas x, y.', 'collision.sentuh(500, 200, 80, 60)', (E, x, y, w, h) => overlap(E, E.num(x) + E.num(w) / 2, E.num(y) + E.num(h), w, h)]
] },
{ n: 'camera', judul: 'Kamera', desc: 'Mengatur kamera: ikut pemain, zoom, getar.', f: [
  ['ikuti', '(ya=True)', 'Kamera mengikuti pemain (bawaan) atau diam.', 'camera.ikuti(False)', (E, ya) => { E.a.camFollow = !!d(ya, true); return null; }],
  ['zoom', '(n)', 'Perbesar (di atas 1) atau perkecil (di bawah 1). Rentang 0.6 sampai 1.6.', 'camera.zoom(1.3)', (E, n) => { E.a.zoom = clampN(E.num(n, 'zoom'), 0.6, 1.6); return null; }],
  ['geser', '(x)', 'Taruh kamera di x (otomatis berhenti mengikuti pemain).', 'camera.geser(600)', (E, x) => { E.a.camFollow = false; E.a.camManual = E.num(x, 'x'); return null; }],
  ['getar', '(ms=300, kuat=6)', 'Getarkan layar.', 'camera.getar(400, 8)', (E, ms, k) => { E.shake(d(ms, 300), d(k, 6)); return null; }],
  ['x', '()', 'Posisi x kamera sekarang.', 'cx = camera.x()', E => E.a.cam]
] },
{ n: 'music', judul: 'Musik', desc: 'Memutar musik latar dari file di tab Suara.', f: [
  ['putar', '(nama, ulang=True, volume=1)', 'Putar musik dari tab Suara. Musik sebelumnya berhenti.', 'music.putar("latar")', (E, n, ul, v) => { E.music(E.text(n, 'Nama musik'), d(ul, true), d(v, 1)); return null; }],
  ['berhenti', '()', 'Hentikan musik.', 'music.berhenti()', E => { E.musicStop(); return null; }],
  ['jeda', '()', 'Jeda musik.', 'music.jeda()', E => { if (E.a.audio.music) E.a.audio.music.pause(); return null; }],
  ['lanjut', '()', 'Lanjutkan musik yang dijeda.', 'music.lanjut()', E => { if (E.a.audio.music) E.a.audio.music.play().catch(() => { }); return null; }],
  ['volume', '(v)', 'Atur volume musik 0 sampai 1.', 'music.volume(0.5)', (E, v) => { E.a.audio.vol = clampN(E.num(v, 'volume'), 0, 1); if (E.a.audio.music) E.a.audio.music.volume = E.a.audio.vol; return null; }],
  ['daftar', '()', 'Daftar nama suara yang ada di tab Suara.', 'print(music.daftar())', E => E.soundNames()]
] },
{ n: 'sfx', judul: 'Efek suara', desc: 'Suara pendek (lompat, koin, ledakan). Pakai file dari tab Suara, atau suara bawaan tanpa file.', f: [
  ['putar', '(nama, volume=1)', 'Putar efek suara. Nama bisa dari tab Suara atau bawaan: lompat, koin, ledak, klik, luka, menang, kalah, bip.', 'sfx.putar("koin")', (E, n, v) => { E.sfx(E.text(n, 'Nama suara'), d(v, 1)); return null; }],
  ['volume', '(v)', 'Atur volume semua efek 0 sampai 1.', 'sfx.volume(0.6)', (E, v) => { E.a.audio.sfxVol = clampN(E.num(v, 'volume'), 0, 1); return null; }],
  ['bawaan', '()', 'Daftar nama suara bawaan.', 'print(sfx.bawaan())', () => Synth.names.slice()]
] },
{ n: 'dialog', judul: 'Dialog', desc: 'Kotak percakapan di bawah layar. Pemain berhenti bergerak selama dialog tampil.', f: [
  ['tampil', '(teks, nama="", selesai=None)', 'Tampilkan dialog; ketuk untuk menutup. Fungsi selesai dipanggil setelah ditutup.', 'dialog.tampil("Halo!", "Hero")', (E, t, nama, cb) => { E.dialog(sh(t), nama ? sh(nama) : '', Cmode.cb(cb)); return null; }],
  ['tanya', '(teks, pilihan, hasil)', 'Dialog dengan tombol pilihan. Fungsi hasil menerima nomor pilihan (mulai 0) dan teksnya.', 'dialog.tanya("Lanjut?", ["Ya", "Tidak"], jawab)', (E, t, opsi, cb) => { if (!Array.isArray(opsi) || !opsi.length) throw new Error('pilihan harus berupa daftar, contoh ["Ya", "Tidak"]'); E.dialog(sh(t), '', Cmode.cb(cb), opsi.map(sh)); return null; }],
  ['tutup', '()', 'Tutup dialog.', 'dialog.tutup()', E => { E.dialogClose(); return null; }],
  ['terbuka', '()', 'Benar kalau dialog sedang tampil.', 'if dialog.terbuka(): ...', E => E.a.dialog.open]
] },
{ n: 'ui', judul: 'Tampilan layar (HUD)', desc: 'Teks dan bar yang menempel di layar. Posisi x dan y dalam persen (0 sampai 100).', f: [
  ['teks', '(id, teks, x, y, ukuran=18, warna="#ffffff")', 'Buat / ubah teks di layar.', 'ui.teks("judul", "Level 1", 40, 5)', (E, id, t, x, y, u, w) => { E.hudText(sh(id), sh(t), E.num(x, 'x'), E.num(y, 'y'), d(u, 18), d(w, '#ffffff')); return null; }],
  ['ubah', '(id, teks)', 'Ganti isi teks yang sudah dibuat.', 'ui.ubah("judul", "Level 2")', (E, id, t) => { const el = E.hudGet(sh(id)); if (!el) throw new Error('Teks layar "' + sh(id) + '" belum dibuat dengan ui.teks'); el.textContent = sh(t); return null; }],
  ['warna', '(id, warna)', 'Ganti warna teks layar (contoh "#ff0000").', 'ui.warna("judul", "#ffd166")', (E, id, w) => { const el = E.hudGet(sh(id)); if (!el) throw new Error('Teks layar "' + sh(id) + '" belum dibuat'); el.style.color = sh(w); return null; }],
  ['bar', '(id, nilai, maks, x, y, lebar=20, warna=None)', 'Gambar bar (misalnya nyawa). Panggil lagi dengan nilai baru untuk mengubah.', 'ui.bar("hp", 3, 5, 3, 10)', (E, id, v, m, x, y, w, c) => { E.hudBar(sh(id), E.num(v, 'nilai'), E.num(m, 'maks'), E.num(x, 'x'), E.num(y, 'y'), d(w, 20), c ? sh(c) : null); return null; }],
  ['sembunyi', '(id)', 'Sembunyikan elemen layar.', 'ui.sembunyi("judul")', (E, id) => { const el = E.hudGet(sh(id)); if (el) el.style.display = 'none'; return null; }],
  ['tampil', '(id)', 'Tampilkan lagi elemen layar.', 'ui.tampil("judul")', (E, id) => { const el = E.hudGet(sh(id)); if (el) el.style.display = ''; return null; }],
  ['hapus', '(id)', 'Hapus elemen layar.', 'ui.hapus("judul")', (E, id) => { E.hudRemove(sh(id)); return null; }],
  ['hapus_semua', '()', 'Hapus semua teks dan bar di layar.', 'ui.hapus_semua()', E => { for (const k of [...E.a.hud.keys()]) E.hudRemove(k); return null; }]
] },
{ n: 'button', judul: 'Tombol', desc: 'Tombol di layar yang memanggil fungsi saat diketuk. Posisi dalam persen.', f: [
  ['buat', '(id, label, x, y, fungsi)', 'Buat tombol. Fungsi dipanggil dengan id tombol.', 'button.buat("main", "Main", 45, 60, mulai_game)', (E, id, l, x, y, cb) => { E.button(sh(id), sh(l), E.num(x, 'x'), E.num(y, 'y'), Cmode.cb(cb)); return null; }],
  ['ubah', '(id, label)', 'Ganti tulisan tombol.', 'button.ubah("main", "Lanjut")', (E, id, l) => { const el = E.a.buttons.get(sh(id)); if (!el) throw new Error('Tombol "' + sh(id) + '" belum dibuat'); el.textContent = sh(l); return null; }],
  ['nonaktif', '(id, ya=True)', 'Matikan / nyalakan tombol.', 'button.nonaktif("main")', (E, id, ya) => { const el = E.a.buttons.get(sh(id)); if (el) el.disabled = !!d(ya, true); return null; }],
  ['hapus', '(id)', 'Hapus tombol.', 'button.hapus("main")', (E, id) => { E.buttonRemove(sh(id)); return null; }]
] },
{ n: 'save', judul: 'Simpan data', desc: 'Menyimpan angka, teks, daftar di HP (tetap ada setelah game ditutup). Tiap game punya simpanan sendiri.', f: [
  ['simpan', '(kunci, nilai)', 'Simpan sebuah nilai.', 'save.simpan("level", 3)', (E, k, v) => { E.saveSet(sh(k), v); return null; }],
  ['muat', '(kunci, awal=None)', 'Ambil nilai tersimpan; kalau belum ada, kembalikan awal.', 'level = save.muat("level", 1)', (E, k, v) => E.saveGet(sh(k), v === undefined ? null : v)],
  ['ada', '(kunci)', 'Benar kalau kunci pernah disimpan.', 'if save.ada("level"): ...', (E, k) => E.saveHas(sh(k))],
  ['hapus', '(kunci)', 'Hapus satu simpanan.', 'save.hapus("level")', (E, k) => { E.saveDel(sh(k)); return null; }],
  ['hapus_semua', '()', 'Hapus semua simpanan game ini.', 'save.hapus_semua()', E => { E.saveClear(); return null; }]
] },
{ n: 'scene', judul: 'Scene (level)', desc: 'Beberapa layar/level dalam satu game. Scene "utama" sudah ada dari tab Panggung.', f: [
  ['buat', '(nama)', 'Buat scene baru yang isinya hanya tanah. Isi dengan platform, teks, musuh, dll.', 'scene.buat("level2")', (E, n) => E.sceneCreate(E.text(n, 'Nama scene'))],
  ['pindah', '(nama)', 'Pindah ke scene itu. Pemain kembali ke titik awalnya dan fungsi scene_mulai(nama) dipanggil.', 'scene.pindah("level2")', (E, n) => E.sceneGo(E.text(n, 'Nama scene'))],
  ['sekarang', '()', 'Nama scene yang sedang jalan.', 'print(scene.sekarang())', E => E.sceneName()],
  ['daftar', '()', 'Daftar nama scene.', 'print(scene.daftar())', E => E.sceneList()],
  ['mulai_di', '(x, y)', 'Atur titik awal pemain untuk scene sekarang.', 'scene.mulai_di(100, 340)', (E, x, y) => { E.a.start = { x: E.num(x), y: E.num(y) }; const s = E.a.scenes.get(E.a.sceneName); if (s) s.start = E.a.start; return null; }]
] },
{ n: 'platform', judul: 'Platform', desc: 'Papan tempat berpijak di dunia. Dunia lebar 1800, tinggi 400, tanah di y=340.', f: [
  ['tambah', '(x, y, lebar, tinggi=16)', 'Tambah platform (x, y = sudut kiri-atas).', 'platform.tambah(300, 250, 120)', (E, x, y, w, h) => { E.Pro.platforms.push({ x: E.num(x, 'x'), y: E.num(y, 'y'), w: E.num(w, 'lebar'), h: d(h, 16) }); return null; }],
  ['hapus_semua', '()', 'Hapus semua platform melayang (tanah tetap ada).', 'platform.hapus_semua()', E => { E.Pro.platforms.splice(0, E.Pro.platforms.length, ...E.Pro.platforms.filter(p => p.h >= 40)); return null; }],
  ['tanah', '(ada=True)', 'Tampilkan atau hilangkan tanah di dasar dunia.', 'platform.tanah(False)', (E, ya) => { const pl = E.Pro.platforms, has = pl.some(p => p.h >= 40); if (d(ya, true) && !has) pl.unshift({ x: 0, y: 340, w: 1800, h: 60 }); if (!d(ya, true)) pl.splice(0, pl.length, ...pl.filter(p => p.h < 40)); return null; }],
  ['jumlah', '()', 'Jumlah platform sekarang.', 'n = platform.jumlah()', E => E.Pro.platforms.length]
] },
{ n: 'teks', judul: 'Teks dunia', desc: 'Teks di dalam dunia game (yang dibuat di tab Panggung, atau lewat kode). Tiap teks punya ID.', f: [
  ['tambah', '(id, teks, x, y, ukuran=24, warna="#ffffff")', 'Buat teks baru di dunia.', 'teks.tambah("papan", "Awas!", 700, 200)', (E, id, t, x, y, u, w) => { id = sh(id); E.Pro.texts = E.Pro.texts.filter(q => (q.name || q.id) !== id); E.Pro.texts.push({ id: 'k_' + id, name: id, text: sh(t), x: E.num(x, 'x'), y: E.num(y, 'y'), size: d(u, 24), color: d(w, '#ffffff') }); const s = E.a.scenes.get(E.a.sceneName); if (s) s.texts = E.Pro.texts; return null; }],
  ['ubah', '(id, teks)', 'Ganti isi teks.', 'teks.ubah("papan", "Aman")', (E, id, t) => { E.textNeed(id).text = sh(t); return null; }],
  ['ambil', '(id)', 'Ambil isi teks.', 's = teks.ambil("papan")', (E, id) => E.textNeed(id).text],
  ['warna', '(id, warna)', 'Ganti warna teks.', 'teks.warna("papan", "#ff0000")', (E, id, w) => { E.textNeed(id).color = sh(w); return null; }],
  ['ukuran', '(id, n)', 'Ganti ukuran teks.', 'teks.ukuran("papan", 40)', (E, id, n) => { E.textNeed(id).size = clampN(E.num(n), 8, 120); return null; }],
  ['pindah', '(id, x, y)', 'Pindahkan teks.', 'teks.pindah("papan", 100, 100)', (E, id, x, y) => { const t = E.textNeed(id); t.x = E.num(x, 'x'); t.y = E.num(y, 'y'); return null; }],
  ['x', '(id)', 'Posisi x teks.', 'teks.x("papan")', (E, id) => E.textNeed(id).x],
  ['y', '(id)', 'Posisi y teks.', 'teks.y("papan")', (E, id) => E.textNeed(id).y],
  ['sembunyi', '(id)', 'Sembunyikan teks (juga tidak bisa diklik).', 'teks.sembunyi("papan")', (E, id) => { E.textNeed(id).visible = false; return null; }],
  ['tampil', '(id)', 'Tampilkan teks lagi.', 'teks.tampil("papan")', (E, id) => { E.textNeed(id).visible = true; return null; }],
  ['hapus', '(id)', 'Hapus teks.', 'teks.hapus("papan")', (E, id) => { id = sh(id); E.Pro.texts = E.Pro.texts.filter(q => (q.name || q.id) !== id); const s = E.a.scenes.get(E.a.sceneName); if (s) s.texts = E.Pro.texts; return null; }],
  ['jadi_animasi', '(id, nama_animasi, ms=2000)', 'Teks menghilang dan diganti animasi (dari ProSprite lain) selama ms, lalu teks kembali.', 'teks.jadi_animasi("ketuk", "Startled", 2000)', (E, id, an, ms) => {
    const t = E.textNeed(id); ms = d(ms, 2000);
    const fx = E.effect(E.text(an, 'Nama animasi'), t.x, t.y, ms, { anchor: 'center' });
    if (!fx) throw new Error('Animasi "' + an + '" tidak ditemukan. Buat ProSprite dengan animasi bernama persis itu.');
    t.visible = false; E.timerAdd(ms, () => { t.visible = true; }); return null;
  }],
  ['daftar', '()', 'Daftar ID semua teks.', 'print(teks.daftar())', E => E.Pro.texts.map(t => t.name || t.id)]
] },
{ n: 'animasi', judul: 'Animasi bebas', desc: 'Memutar animasi mana pun dari ProSprite lain di posisi tertentu, bukan hanya animasi pemain.', f: [
  ['mainkan', '(nama, x, y, ms=2000, tinggi=0)', 'Putar animasi di titik x, y (tengah) selama ms. tinggi=0 berarti ukuran asli sprite. Nama boleh "Sprite/Animasi".', 'animasi.mainkan("Startled", 500, 250, 2000)', (E, n, x, y, ms, tg) => { const fx = E.effect(E.text(n, 'Nama animasi'), E.num(x, 'x'), E.num(y, 'y'), d(ms, 2000), { anchor: 'center', height: d(tg, 0) }); if (!fx) throw new Error('Animasi "' + n + '" tidak ditemukan'); return null; }],
  ['pemain', '(nama, ms=800)', 'Paksa pemain memakai animasi tertentu sebentar (misalnya "Luka").', 'animasi.pemain("Luka", 600)', (E, n, ms) => { const f = E.findNamed(E.text(n, 'Nama animasi')); if (!f) throw new Error('Animasi "' + n + '" tidak ditemukan'); E.forceAnim(f.anim, d(ms, 800)); return null; }],
  ['ada', '(nama)', 'Benar kalau animasi dengan nama itu ada dan ada framenya.', 'if animasi.ada("Startled"): ...', (E, n) => !!E.findNamed(sh(n))],
  ['daftar', '()', 'Daftar semua nama animasi di proyek.', 'print(animasi.daftar())', E => { const o = []; for (const s of E.project.sprites) for (const q of s.anims) if (q.frames.length) o.push(s.name + '/' + q.name); return o; }]
] },
{ n: 'waktu', judul: 'Waktu', desc: 'Menjalankan fungsi nanti atau berulang, dan mengatur kecepatan waktu.', f: [
  ['tunda', '(ms, fungsi, ...nilai)', 'Panggil fungsi sekali setelah ms milidetik. Mengembalikan nomor timer.', 'waktu.tunda(1500, selesai)', (E, ms, fn, ...args) => E.timerAdd(E.num(ms, 'ms'), Cmode.cb(fn), args, false)],
  ['ulang', '(ms, fungsi, ...nilai)', 'Panggil fungsi berulang tiap ms milidetik. Mengembalikan nomor timer.', 'waktu.ulang(1000, detak)', (E, ms, fn, ...args) => E.timerAdd(Math.max(30, E.num(ms, 'ms')), Cmode.cb(fn), args, true)],
  ['berhenti', '(nomor)', 'Batalkan timer.', 'waktu.berhenti(t)', (E, id) => { E.timerClear(id); return null; }],
  ['detik', '()', 'Detik sejak game mulai.', 'print(waktu.detik())', E => E.a.clock],
  ['lambat', '(skala)', 'Atur kecepatan waktu: 1 normal, 0.3 gerak lambat, 2 dua kali cepat.', 'waktu.lambat(0.4)', (E, k) => { E.a.timeScale = clampN(E.num(k, 'skala'), 0.05, 4); return null; }]
] },
{ n: 'acak', judul: 'Acak', desc: 'Bilangan dan pilihan acak.', f: [
  ['angka', '(a, b)', 'Bilangan bulat acak dari a sampai b.', 'n = acak.angka(1, 6)', (E, a, b) => { a = E.num(a); b = E.num(b); return Math.floor(a + Math.random() * (b - a + 1)); }],
  ['desimal', '(a=0, b=1)', 'Bilangan desimal acak.', 'x = acak.desimal()', (E, a, b) => { a = d(a, 0); b = d(b, 1); return a + Math.random() * (b - a); }],
  ['pilih', '(daftar)', 'Ambil satu isi daftar secara acak.', 'w = acak.pilih(["a", "b"])', (E, l) => { if (!Array.isArray(l) || !l.length) throw new Error('Butuh daftar yang tidak kosong'); return l[Math.floor(Math.random() * l.length)]; }],
  ['peluang', '(p=0.5)', 'Benar dengan peluang p (0 sampai 1).', 'if acak.peluang(0.2): ...', (E, p) => Math.random() < d(p, 0.5)],
  ['kocok', '(daftar)', 'Daftar baru dengan urutan diacak.', 'k = acak.kocok([1, 2, 3])', (E, l) => { const o = l.slice(); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; }]
] },
{ n: 'matematika', judul: 'Matematika', desc: 'Fungsi hitung. Sudut dalam radian (pakai radian(derajat) untuk mengubah).', f: [
  ['sin', '(r)', 'Sinus.', 'matematika.sin(1)', (E, r) => Math.sin(E.num(r))],
  ['cos', '(r)', 'Kosinus.', 'matematika.cos(1)', (E, r) => Math.cos(E.num(r))],
  ['akar', '(n)', 'Akar kuadrat.', 'matematika.akar(16)', (E, n) => Math.sqrt(E.num(n))],
  ['pangkat', '(a, b)', 'a pangkat b.', 'matematika.pangkat(2, 8)', (E, a, b) => Math.pow(E.num(a), E.num(b))],
  ['bulat', '(n)', 'Bulatkan ke angka terdekat.', 'matematika.bulat(2.6)', (E, n) => Math.round(E.num(n))],
  ['lantai', '(n)', 'Bulatkan ke bawah.', 'matematika.lantai(2.9)', (E, n) => Math.floor(E.num(n))],
  ['atap', '(n)', 'Bulatkan ke atas.', 'matematika.atap(2.1)', (E, n) => Math.ceil(E.num(n))],
  ['mutlak', '(n)', 'Nilai mutlak.', 'matematika.mutlak(-4)', (E, n) => Math.abs(E.num(n))],
  ['min', '(a, b)', 'Yang terkecil.', 'matematika.min(3, 5)', (E, a, b) => Math.min(E.num(a), E.num(b))],
  ['maks', '(a, b)', 'Yang terbesar.', 'matematika.maks(3, 5)', (E, a, b) => Math.max(E.num(a), E.num(b))],
  ['batas', '(n, kecil, besar)', 'Jepit n supaya tetap di antara kecil dan besar.', 'matematika.batas(x, 0, 100)', (E, n, a, b) => clampN(E.num(n), E.num(a), E.num(b))],
  ['campur', '(a, b, t)', 'Titik di antara a dan b; t=0 di a, t=1 di b.', 'matematika.campur(0, 10, 0.5)', (E, a, b, t) => E.num(a) + (E.num(b) - E.num(a)) * E.num(t)],
  ['jarak', '(x1, y1, x2, y2)', 'Jarak dua titik.', 'matematika.jarak(0, 0, 3, 4)', (E, a, b, c, e) => Math.hypot(E.num(c) - E.num(a), E.num(e) - E.num(b))],
  ['sudut', '(x1, y1, x2, y2)', 'Sudut (radian) dari titik 1 ke titik 2.', 'matematika.sudut(0, 0, 1, 1)', (E, a, b, c, e) => Math.atan2(E.num(e) - E.num(b), E.num(c) - E.num(a))],
  ['radian', '(derajat)', 'Ubah derajat jadi radian.', 'matematika.radian(90)', (E, n) => E.num(n) * Math.PI / 180],
  ['derajat', '(radian)', 'Ubah radian jadi derajat.', 'matematika.derajat(3.14)', (E, n) => E.num(n) * 180 / Math.PI]
], p: [['pi', 'Nilai pi (3.14159...).', () => Math.PI]] },
{ n: 'benda', judul: 'Benda', desc: 'Benda bebas di dunia: peti, pintu, awan, apa saja yang punya animasi (dari ProSprite mana pun).', f: [
  ['buat', '(id, animasi, x, y)', 'Buat benda memakai animasi bernama itu. x, y = titik tengah-bawah.', 'benda.buat("peti", "Peti", 600, 340)', (E, id, an, x, y) => { E.entAdd('benda', sh(id), E.text(an, 'Nama animasi'), E.num(x, 'x'), E.num(y, 'y')); return null; }],
  ['pindah', '(id, x, y)', 'Pindahkan benda.', 'benda.pindah("peti", 100, 340)', (E, id, x, y) => { const e = entList(E, id); e.x = E.num(x); e.y = E.num(y); return null; }],
  ['gerak', '(id, vx, vy)', 'Beri kecepatan (satuan dunia per detik). Mulai dari 0 lalu terus bergerak.', 'benda.gerak("awan", 30, 0)', (E, id, vx, vy) => { const e = entList(E, id); e.vx = E.num(vx); e.vy = E.num(vy); return null; }],
  ['x', '(id)', 'Posisi x benda.', 'benda.x("peti")', (E, id) => entList(E, id).x],
  ['y', '(id)', 'Posisi y benda.', 'benda.y("peti")', (E, id) => entList(E, id).y],
  ['fisika', '(id, ya=True)', 'Benda jatuh karena gravitasi dan berpijak di platform.', 'benda.fisika("peti")', (E, id, ya) => { entList(E, id).physics = !!d(ya, true); return null; }],
  ['sembunyi', '(id, ya=True)', 'Sembunyikan / tampilkan benda.', 'benda.sembunyi("peti")', (E, id, ya) => { entList(E, id).hidden = !!d(ya, true); return null; }],
  ['balik', '(id, ya=True)', 'Balik arah gambar benda (kiri-kanan).', 'benda.balik("peti")', (E, id, ya) => { entList(E, id).flip = !!d(ya, true); return null; }],
  ['animasi', '(id, nama)', 'Ganti animasi benda.', 'benda.animasi("peti", "PetiTerbuka")', (E, id, n) => { const e = entList(E, id), f = E.findNamed(E.text(n, 'Nama animasi')); if (!f) throw new Error('Animasi "' + n + '" tidak ditemukan'); e.anim = f.anim; e.sprite = f.sprite; e.unit = spriteUnit(f.sprite); e.t0 = E.a.clock; return null; }],
  ['ada', '(id)', 'Benar kalau benda dengan ID itu ada.', 'if benda.ada("peti"): ...', (E, id) => !!E.ent(sh(id))],
  ['hapus', '(id)', 'Hapus benda.', 'benda.hapus("peti")', (E, id) => E.entRemove(sh(id))],
  ['jumlah', '()', 'Jumlah semua benda, musuh, dan item di scene ini.', 'n = benda.jumlah()', E => E.a.entities.length]
] },
{ n: 'musuh', judul: 'Musuh', desc: 'Musuh yang berpatroli. Diinjak dari atas: musuh hilang. Disentuh dari samping: nyawa berkurang. Ubah perilaku lewat fungsi injak_musuh(id) dan kena_musuh(id).', f: [
  ['buat', '(id, animasi, x, y, jarak=120, kecepatan=60)', 'Buat musuh yang jalan bolak-balik sejauh jarak dari titik awal.', 'musuh.buat("m1", "Slime", 700, 340, 100)', (E, id, an, x, y, j, k) => { E.entAdd('musuh', sh(id), E.text(an, 'Nama animasi'), E.num(x, 'x'), E.num(y, 'y'), { patrol: { x0: x, range: d(j, 120), speed: d(k, 60), dir: 1 } }); return null; }],
  ['bunuh', '(id)', 'Hilangkan musuh dengan efek ledakan kecil.', 'musuh.bunuh("m1")', (E, id) => { const e = E.ent(sh(id)); if (e) { E.burst(e.x, e.y - e.dh / 2, 16, '#ff9f43'); E.entRemove(id); } return null; }],
  ['hapus', '(id)', 'Hapus musuh tanpa efek.', 'musuh.hapus("m1")', (E, id) => E.entRemove(sh(id))],
  ['jumlah', '()', 'Jumlah musuh yang masih ada.', 'if musuh.jumlah() == 0: ...', E => E.a.entities.filter(e => e.kind === 'musuh').length]
] },
{ n: 'item', judul: 'Item', desc: 'Benda yang bisa dikumpulkan (koin, kunci). Disentuh pemain: item hilang, skor +1, suara koin. Ubah lewat fungsi ambil_item(id).', f: [
  ['buat', '(id, animasi, x, y)', 'Taruh item di dunia.', 'item.buat("koin1", "Koin", 300, 240)', (E, id, an, x, y) => { E.entAdd('item', sh(id), E.text(an, 'Nama animasi'), E.num(x, 'x'), E.num(y, 'y')); return null; }],
  ['hapus', '(id)', 'Hapus item.', 'item.hapus("koin1")', (E, id) => E.entRemove(sh(id))],
  ['jumlah', '()', 'Jumlah item yang belum diambil.', 'sisa = item.jumlah()', E => E.a.entities.filter(e => e.kind === 'item').length]
] },
{ n: 'nyawa', judul: 'Nyawa', desc: 'Nyawa pemain (awal 3). Habis: fungsi mati() dipanggil, kalau tidak ada game mulai ulang.', f: [
  ['atur', '(n)', 'Atur jumlah nyawa (juga jadi nyawa maksimum).', 'nyawa.atur(5)', (E, n) => { E.a.lives = E.a.livesMax = Math.max(1, Math.round(E.num(n))); E.refreshHud(); return null; }],
  ['kurang', '(n=1)', 'Kurangi nyawa.', 'nyawa.kurang()', (E, n) => { E.loseLife(d(n, 1)); return null; }],
  ['tambah', '(n=1)', 'Tambah nyawa (sampai maksimum).', 'nyawa.tambah()', (E, n) => { E.a.lives = Math.min(E.a.livesMax, E.a.lives + d(n, 1)); E.refreshHud(); return null; }],
  ['sekarang', '()', 'Nyawa sekarang.', 'print(nyawa.sekarang())', E => E.a.lives],
  ['tampil', '(ya=True)', 'Tampilkan / sembunyikan hitungan nyawa di pojok layar.', 'nyawa.tampil()', (E, ya) => { E.a.hudLives = !!d(ya, true); E.refreshHud(); return null; }]
] },
{ n: 'skor', judul: 'Skor', desc: 'Skor permainan.', f: [
  ['tambah', '(n=1)', 'Tambah skor.', 'skor.tambah(10)', (E, n) => { E.a.score += E.num(d(n, 1)); E.refreshHud(); return null; }],
  ['atur', '(n)', 'Atur skor.', 'skor.atur(0)', (E, n) => { E.a.score = E.num(n); E.refreshHud(); return null; }],
  ['sekarang', '()', 'Skor sekarang.', 'print(skor.sekarang())', E => E.a.score],
  ['tampil', '(ya=True)', 'Tampilkan / sembunyikan skor di pojok layar.', 'skor.tampil()', (E, ya) => { E.a.hudScore = !!d(ya, true); E.refreshHud(); return null; }],
  ['simpan', '()', 'Simpan skor kalau lebih tinggi dari rekor. Mengembalikan rekor.', 'rekor = skor.simpan()', E => { const b = E.saveGet('__rekor', 0); if (E.a.score > b) { E.saveSet('__rekor', E.a.score); return E.a.score; } return b; }],
  ['tertinggi', '()', 'Rekor skor tersimpan.', 'print(skor.tertinggi())', E => E.saveGet('__rekor', 0)]
] },
{ n: 'input', judul: 'Input', desc: 'Membaca joystick, tombol lompat, dan ketukan layar.', f: [
  ['kiri', '()', 'Benar kalau joystick ke kiri.', 'if input.kiri(): ...', E => E.Pro.input.x < -0.2],
  ['kanan', '()', 'Benar kalau joystick ke kanan.', 'if input.kanan(): ...', E => E.Pro.input.x > 0.2],
  ['arah', '()', 'Arah joystick -1 sampai 1.', 'a = input.arah()', E => E.Pro.input.x],
  ['lompat', '()', 'Benar kalau tombol lompat sedang ditekan.', 'if input.lompat(): ...', E => !!E.Pro.input.jump],
  ['klik_x', '()', 'Posisi x ketukan terakhir di dunia.', 'x = input.klik_x()', E => Math.round(E.a.lastClick.x)],
  ['klik_y', '()', 'Posisi y ketukan terakhir di dunia.', 'y = input.klik_y()', E => Math.round(E.a.lastClick.y)]
] },
{ n: 'layar', judul: 'Layar & dunia', desc: 'Ukuran dan warna latar.', f: [
  ['lebar', '()', 'Lebar bagian dunia yang terlihat di layar.', 'w = layar.lebar()', E => Math.round(E.a.w / E.a.scale)],
  ['tinggi', '()', 'Tinggi dunia (400).', 'h = layar.tinggi()', () => World.H],
  ['dunia_lebar', '()', 'Lebar seluruh dunia (1800).', 'w = layar.dunia_lebar()', () => World.W],
  ['warna_langit', '(atas, bawah)', 'Ganti warna langit dengan dua warna (contoh "#102040"). Panggil tanpa nilai untuk mengembalikan.', 'layar.warna_langit("#201040", "#603060")', (E, a, b) => { E.a.sky = a ? [sh(a), sh(b || a)] : null; return null; }]
] },
{ n: 'efek', judul: 'Efek layar', desc: 'Kilatan, gelap-terang, dan getaran.', f: [
  ['kilat', '(warna="#ffffff", ms=250)', 'Layar berkilat sebentar.', 'efek.kilat("#ff0000")', (E, w, ms) => { E.flash(sh(d(w, '#ffffff')), d(ms, 250)); return null; }],
  ['gelap', '(ms=600)', 'Layar memudar jadi hitam dan tetap hitam sampai efek.terang().', 'efek.gelap(800)', (E, ms) => { E.fade(true, d(ms, 600)); return null; }],
  ['terang', '(ms=600)', 'Layar terang kembali dari gelap.', 'efek.terang()', (E, ms) => { E.unfade(d(ms, 600)); return null; }],
  ['getar', '(ms=300, kuat=6)', 'Getarkan layar.', 'efek.getar()', (E, ms, k) => { E.shake(d(ms, 300), d(k, 6)); return null; }]
] },
{ n: 'partikel', judul: 'Partikel', desc: 'Percikan dan hujan.', f: [
  ['ledak', '(x, y, jumlah=20, warna="#3ee8c8")', 'Semburan partikel di titik x, y.', 'partikel.ledak(player.x(), player.y(), 30)', (E, x, y, n, w) => { E.burst(E.num(x, 'x'), E.num(y, 'y'), d(n, 20), sh(d(w, '#3ee8c8'))); return null; }],
  ['hujan', '(ya=True, warna=None)', 'Nyalakan / matikan hujan.', 'partikel.hujan()', (E, ya, w) => { E.setRain(!!d(ya, true), w ? sh(w) : null); return null; }]
] },
{ n: 'sistem', judul: 'Sistem', desc: 'Pesan, keluar, info.', f: [
  ['toast', '(teks, ms=2200)', 'Pesan kecil di atas layar.', 'sistem.toast("Level selesai!")', (E, t, ms) => { toast(sh(t), d(ms, 2200)); return null; }],
  ['cetak', '(...nilai)', 'Sama seperti print(): tampil sebagai pesan kecil.', 'sistem.cetak("x =", x)', (E, ...a) => { toast(a.map(sh).join(' '), 2200); return null; }],
  ['keluar', '()', 'Keluar dari mode Coba / game.', 'sistem.keluar()', E => { E.exit(); return null; }],
  ['versi', '()', 'Versi Cmode.', 'print(sistem.versi())', () => 'Cmode 1.0'],
  ['nama_game', '()', 'Nama proyek / game ini.', 'print(sistem.nama_game())', E => E.project.name || '']
] }
];

/* peristiwa (fungsi yang dipanggil mesin kalau kamu tulis namanya) untuk Tutorial */
const EVENTS = [
  ['mulai()', 'Dipanggil sekali saat game mulai.'],
  ['update(dt)', 'Dipanggil tiap frame. dt = detik sejak frame sebelumnya.'],
  ['tombol_kanan()', 'Dipanggil tiap frame selama joystick ke kanan.'],
  ['tombol_kiri()', 'Dipanggil tiap frame selama joystick ke kiri.'],
  ['tombol_lompat()', 'Dipanggil sekali tiap tombol lompat ditekan.'],
  ['diam()', 'Dipanggil tiap frame selama joystick di tengah.'],
  ['klik_teks(id)', 'Dipanggil saat sebuah teks diketuk. id = ID teks.'],
  ['klik_karakter()', 'Dipanggil saat pemain diketuk.'],
  ['klik(x, y)', 'Dipanggil tiap ketukan di layar; x, y = posisi di dunia.'],
  ['ambil_item(id)', 'Dipanggil saat item diambil. Kalau ditulis, perilaku bawaan (skor +1) tidak jalan.'],
  ['injak_musuh(id)', 'Dipanggil saat musuh diinjak dari atas. Kalau ditulis, musuh tidak otomatis hilang.'],
  ['kena_musuh(id)', 'Dipanggil saat musuh menyentuh dari samping. Kalau ditulis, nyawa tidak otomatis berkurang.'],
  ['mati()', 'Dipanggil saat nyawa habis. Kalau ditulis, game tidak otomatis mulai ulang.'],
  ['scene_mulai(nama)', 'Dipanggil setelah pindah scene.']
];

const CModules = {
  defs: DEFS, events: EVENTS,
  build(E) {
    const reg = Object.create(null);
    for (const m of DEFS) {
      const o = Object.create(null);
      for (const f of m.f) { const fn = f[4]; o[f[0]] = (...args) => fn(E, ...args); }
      for (const p of (m.p || [])) {
        const get = p[2], set = p[3];
        Object.defineProperty(o, p[0], { enumerable: true, get: () => get(E), set: set ? v => set(E, v) : undefined });
      }
      reg[m.n] = o;
    }
    return reg;
  },
  names() { return DEFS.map(m => m.n); }
};
G.CModules = CModules;
})(window);
