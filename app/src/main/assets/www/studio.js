'use strict';
/* =====================================================================
   studio.js (v4): alat studio: pengaturan game, editor panggung (platform, objek, titik mulai),
   pustaka aset, ekspor/impor, backup, alat frame, potong sprite sheet, editor kode lebih enak,
   template proyek, statistik.
   Dimuat setelah app.js; menimpa beberapa fungsi lewat pembungkus.
   ===================================================================== */
const Studio = (() => {
  const SET = () => { const p = S.project; if (!p.settings) p.settings = {}; for (const k of Object.keys(DEFAULT_SETTINGS)) if (p.settings[k] === undefined) p.settings[k] = DEFAULT_SETTINGS[k]; return p.settings; };
  const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* abaikan */ } } };
  const num = (v, d) => { v = parseFloat(v); return isFinite(v) ? v : d; };
  const allAnims = () => { const o = []; for (const s of S.project.sprites) for (const q of s.anims) if (q.frames.length) o.push(q.name); return [...new Set(o)]; };

  /* ================= simpan file (Android lewat Native, browser lewat unduhan) ================= */
  function saveBlobFile(name, mime, text) {
    if (window.Native && Native.saveFile) {
      const u = new TextEncoder().encode(text); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
      Native.saveFile(name, btoa(s), mime);
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('Tersimpan: ' + name);
    }
  }
  window.__nativeSaved = (ok, msg) => toast(ok ? 'Tersimpan di Download: ' + msg : 'Gagal menyimpan: ' + msg, 4000);

  /* ================= pengaturan game ================= */
  const FIELDS = [
    ['Fisika', [['gravity', 'Gravitasi', 'range', 2, 25, 0.1], ['walk', 'Kecepatan jalan', 'range', 1, 12, 0.5], ['jump', 'Tinggi lompat', 'range', 4, 24, 0.5], ['doubleJump', 'Lompat ganda', 'bool'], ['zoom', 'Zoom kamera', 'range', 0.7, 1.4, 0.05]]],
    ['Nyawa & skor', [['lives', 'Jumlah nyawa', 'range', 1, 9, 1], ['showLives', 'Tampilkan nyawa', 'bool'], ['showScore', 'Tampilkan skor', 'bool']]],
    ['Dunia', [['bg', 'Latar', 'select', () => [['', 'Bawaan (bintang)']].concat(Packs.data.bg.map(b => [b.name, b.title]))],
      ['hari', 'Siklus hari (subuh, pagi, siang, sore, malam)', 'bool'], ['hariJam', 'Tampilkan jam', 'bool'],
      ['cuaca', 'Cuaca', 'select', () => [['', 'Cerah'], ['hujan', 'Hujan'], ['badai', 'Badai'], ['salju', 'Salju'], ['kabut', 'Kabut'], ['debu', 'Debu']]],
      ['music', 'Musik latar', 'select', () => [['', 'Tanpa musik']].concat(Packs.data.music.map(m => [m.name, m.title])).concat((S.project.sounds || []).map(s => [s.name, s.name + ' (milikmu)']))], ['musicVol', 'Volume musik', 'range', 0, 1, 0.05]]],
    ['Titik mulai pemain', [['startX', 'x', 'range', 0, 1800, 10], ['startY', 'y (340 = tanah)', 'range', 0, 340, 10]]],
    ['Kontrol', [['stick', 'Ukuran joystick', 'range', 90, 200, 2], ['jumpBtn', 'Ukuran tombol lompat', 'range', 70, 140, 2], ['ctlOpacity', 'Transparansi kontrol', 'range', 0.3, 1, 0.05], ['leftHand', 'Mode kidal (joystick di kanan)', 'bool']]],
    ['Developer', [['pauseBtn', 'Tombol jeda di layar', 'bool'], ['debug', 'Debug: hitbox + FPS', 'bool'], ['console', 'Konsol di layar', 'bool']]]
  ];
  function settingsModal() {
    const st = SET();
    let h = '<h3>Pengaturan game</h3><label>Nama game</label><input class="input" data-sf="@name" value="' + esc(S.project.name) + '" maxlength="40">';
    for (const [title, rows] of FIELDS) {
      h += '<div class="setgrp">' + esc(title) + '</div>';
      for (const r of rows) {
        const [key, label, type] = r, v = st[key];
        if (type === 'bool') h += '<button class="toggle ' + (v ? 'on' : '') + '" data-sact="bool" data-k="' + key + '"><span>' + esc(label) + '</span><span class="sw"></span></button>';
        else if (type === 'range') h += '<label>' + esc(label) + ' <span class="val" id="sv-' + key + '">' + (+v).toFixed(r[5] < 1 ? (r[5] < 0.1 ? 2 : 1) : 0) + '</span></label><input type="range" min="' + r[3] + '" max="' + r[4] + '" step="' + r[5] + '" value="' + v + '" data-sf="' + key + '" data-step="' + r[5] + '">';
        else h += '<label>' + esc(label) + '</label><select class="input" data-sf="' + key + '">' + r[3]().map(o => '<option value="' + esc(o[0]) + '"' + (String(v == null ? '' : v) === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select>';
      }
    }
    h += '<div class="row end" style="margin-top:12px"><button class="btn" data-sact="reset">Kembalikan bawaan</button><button class="btn primary" data-sact="close">Selesai</button></div>';
    const m = modal(h, 'wide setmodal');
    m.el.addEventListener('click', e => {
      const b = e.target.closest('[data-sact]'); if (!b) return;
      if (b.dataset.sact === 'bool') { st[b.dataset.k] = !st[b.dataset.k]; b.classList.toggle('on', st[b.dataset.k]); dirty(); }
      else if (b.dataset.sact === 'close') { m.close(); renderEditor(); }
      else if (b.dataset.sact === 'reset') askConfirm('Kembalikan semua pengaturan ke bawaan?', 'Kembalikan').then(ok => { if (ok) { S.project.settings = {}; dirty(); m.close(); settingsModal(); } });
    });
    m.el.addEventListener('dismiss', () => { m.close(); renderEditor(); });
  }
  function onInput(e) {
    const t = e.target, k = t.dataset && t.dataset.sf; if (!k || !S.project) return;
    if (k === '@name') { S.project.name = t.value.slice(0, 40); dirty(); return; }
    if (k.startsWith('o:')) return objInput(k.slice(2), t);
    if (k.startsWith('p:')) return platInput(k.slice(2), t);
    const st = SET();
    if (t.tagName === 'SELECT') st[k] = t.value; else if (t.type === 'range') { st[k] = parseFloat(t.value); const sv = $('#sv-' + k); if (sv) sv.textContent = (+t.value).toFixed(+t.dataset.step < 1 ? (+t.dataset.step < 0.1 ? 2 : 1) : 0); } else st[k] = t.value;
    dirty();
  }

  /* ================= editor panggung: platform, objek, titik mulai ================= */
  S.tool = 'teks'; S.selPlat = -1; S.selObj = -1;
  const platsOf = () => S.project.platforms || null;
  const ensurePlats = () => { const p = S.project; if (!p.platforms) p.platforms = World.defaultPlatforms.map(x => Object.assign({}, x)); return p.platforms; };
  const objs = () => (S.project.objects = S.project.objects || []);
  const snap = v => Math.round(v / 10) * 10;
  const objImg = o => { const f = World_findAnim(o.anim); return f ? { img: getImg(f.anim.frames[0]), unit: spriteUnit(f.sprite) } : null; };
  function World_findAnim(name) {
    const n = String(name).toLowerCase();
    for (const s of S.project.sprites) for (const q of s.anims) if (q.name.toLowerCase() === n && q.frames.length) return { sprite: s, anim: q };
    return null;
  }
  const objBox = o => { const r = objImg(o); if (!r || !r.img.naturalWidth) return { x: o.x - 24, y: o.y - 48, w: 48, h: 48 }; const w = r.img.naturalWidth * r.unit, h = r.img.naturalHeight * r.unit; return { x: o.x - w / 2, y: o.y - h, w, h }; };

  function stageRight() {
    const tools = [['teks', 'Teks'], ['platform', 'Platform'], ['objek', 'Objek'], ['mulai', 'Mulai']].map(t => '<button class="chip ' + (S.tool === t[0] ? 'on' : '') + '" data-act="tool" data-t="' + t[0] + '">' + t[1] + '</button>').join('');
    let h = '<div class="chips" style="margin-bottom:8px">' + tools + '</div>';
    if (S.tool === 'teks') return h + _rightHTML();
    if (S.tool === 'platform') {
      const L = platsOf(), pl = L && L[S.selPlat];
      h += '<button class="btn sm block" data-act="plat-add">+ Platform</button>';
      if (pl) {
        h += '<label>x <span class="val" id="pv-x">' + pl.x + '</span></label><input type="range" min="0" max="1800" step="10" value="' + pl.x + '" data-sf="p:x">' +
          '<label>y <span class="val" id="pv-y">' + pl.y + '</span></label><input type="range" min="0" max="380" step="10" value="' + pl.y + '" data-sf="p:y">' +
          '<label>Lebar <span class="val" id="pv-w">' + pl.w + '</span></label><input type="range" min="40" max="1800" step="10" value="' + pl.w + '" data-sf="p:w">' +
          '<button class="btn sm danger block" style="margin-top:8px" data-act="plat-del">Hapus platform</button>';
      } else h += '<div class="small" style="margin-top:8px">Ketuk platform buat memilih, seret buat memindah, seret ujung kanan buat melebarkan.</div>';
      h += '<div class="sep"></div><button class="btn sm block" data-act="plat-reset">Kembalikan platform bawaan</button>';
      return h;
    }
    if (S.tool === 'objek') {
      const L = objs(), o = L[S.selObj], names = allAnims();
      if (!names.length) return h + '<div class="empty-hint">Belum ada animasi. Buat ProSprite lain (musuh, koin, peti) atau ambil dari Pustaka.</div><button class="btn sm primary block" data-act="library">Buka Pustaka</button>';
      h += '<label>Animasi untuk objek baru</label><select class="input" id="newobj-an">' + names.map(n => '<option>' + esc(n) + '</option>').join('') + '</select>' +
        '<div class="row" style="margin-top:6px"><button class="btn sm grow" data-act="obj-add" data-k="benda">+ Benda</button><button class="btn sm grow" data-act="obj-add" data-k="item">+ Item</button><button class="btn sm grow" data-act="obj-add" data-k="musuh">+ Musuh</button></div>';
      if (o) {
        h += '<div class="sep"></div><label>ID untuk kode</label><input class="input" data-sf="o:id" value="' + esc(o.id) + '" maxlength="20">' +
          '<label>Animasi</label><select class="input" data-sf="o:anim">' + names.map(n => '<option' + (n.toLowerCase() === String(o.anim).toLowerCase() ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + '</select>' +
          '<label>Jenis</label><select class="input" data-sf="o:kind">' + [['benda', 'Benda (hiasan)'], ['item', 'Item (diambil, skor +1)'], ['musuh', 'Musuh (patroli)']].map(k => '<option value="' + k[0] + '"' + (o.kind === k[0] ? ' selected' : '') + '>' + k[1] + '</option>').join('') + '</select>';
        if (o.kind === 'musuh') h += '<label>Jarak patroli <span class="val" id="ov-range">' + (o.range || 120) + '</span></label><input type="range" min="20" max="600" step="10" value="' + (o.range || 120) + '" data-sf="o:range"><label>Kecepatan <span class="val" id="ov-speed">' + (o.speed || 60) + '</span></label><input type="range" min="10" max="240" step="10" value="' + (o.speed || 60) + '" data-sf="o:speed">';
        if (o.kind === 'benda') h += '<button class="toggle ' + (o.physics ? 'on' : '') + '" style="margin-top:8px" data-act="obj-phys"><span>Kena gravitasi</span><span class="sw"></span></button>';
        h += '<button class="btn sm danger block" style="margin-top:8px" data-act="obj-del">Hapus objek</button>';
      } else h += '<div class="small" style="margin-top:8px">Ketuk objek buat memilih, seret buat memindah. Di kode: <code>benda.pindah("id", x, y)</code>, <code>musuh.bunuh("id")</code>.</div>';
      return h;
    }
    const st = SET();
    return h + '<div class="small">Ketuk atau seret di panggung buat menaruh titik mulai pemain (bendera hijau).</div><div class="sep"></div><div class="small">x = <b>' + st.startX + '</b> &nbsp; y = <b>' + st.startY + '</b></div><button class="btn sm block" style="margin-top:8px" data-act="start-reset">Kembalikan ke kiri-bawah</button>';
  }
  function platInput(k, t) { const pl = platsOf() && platsOf()[S.selPlat]; if (!pl) return; pl[k] = Math.round(+t.value); const sv = $('#pv-' + k); if (sv) sv.textContent = pl[k]; dirty(); }
  function objInput(k, t) {
    const o = objs()[S.selObj]; if (!o) return;
    if (k === 'id') o.id = t.value.replace(/[^\w]/g, '').slice(0, 20) || o.id; else if (k === 'anim') { o.anim = t.value; } else if (k === 'kind') { o.kind = t.value; renderRight(); }
    else { o[k] = +t.value; const sv = $('#ov-' + k); if (sv) sv.textContent = o[k]; }
    dirty();
  }

  function studioDrawScene(now) {
    const { ctx, w, h } = ST, scale = h / World.H, vw = w / scale, p = S.project, st = SET();
    S.camX = clamp(S.camX, 0, Math.max(0, World.W - vw));
    let bg = null; if (st.bg && Packs.bgUrl(st.bg)) { bg = Studio._bg && Studio._bg.n === st.bg ? Studio._bg.im : null; if (!bg) { const im = new Image(); im.src = Packs.bgUrl(st.bg); Studio._bg = { n: st.bg, im }; bg = im; } }
    const plats = p.platforms || World.defaultPlatforms;
    World.draw(ctx, w, h, S.camX, scale, p.texts, S.tool === 'teks' ? S.textId : null, plats, 0, null, bg);
    ctx.save(); ctx.translate(-S.camX * scale, 0); ctx.scale(scale, scale);
    // objek
    for (let i = 0; i < objs().length; i++) {
      const o = objs()[i], r = objImg(o), bx = objBox(o);
      if (r && r.img.naturalWidth) ctx.drawImage(r.img, bx.x, bx.y, bx.w, bx.h); else { ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(bx.x, bx.y, bx.w, bx.h); }
      if (S.tool === 'objek') {
        ctx.strokeStyle = i === S.selObj ? '#3ee8c8' : 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.strokeRect(bx.x, bx.y, bx.w, bx.h); ctx.setLineDash([]);
        ctx.font = '700 10px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = o.kind === 'musuh' ? '#ff5d73' : o.kind === 'item' ? '#ffd166' : '#9fb0d8'; ctx.fillText(o.kind + ': ' + o.id, o.x, bx.y - 6);
        if (o.kind === 'musuh' && i === S.selObj) { ctx.strokeStyle = 'rgba(255,93,115,.6)'; ctx.beginPath(); ctx.moveTo(o.x - (o.range || 120), o.y + 4); ctx.lineTo(o.x + (o.range || 120), o.y + 4); ctx.stroke(); }
      }
    }
    if (S.tool === 'platform') {
      for (let i = 0; i < plats.length; i++) {
        const pl = plats[i]; if (!p.platforms) break;
        ctx.strokeStyle = i === S.selPlat ? '#ffd166' : 'rgba(255,255,255,.25)'; ctx.lineWidth = i === S.selPlat ? 2.5 : 1; ctx.strokeRect(pl.x, pl.y, pl.w, Math.min(pl.h, 60));
        if (i === S.selPlat) { ctx.fillStyle = '#ffd166'; ctx.fillRect(pl.x + pl.w - 6, pl.y - 4, 10, Math.min(pl.h, 60) + 8); }
      }
    }
    // pemain di titik mulai
    const sp = playerSprite(p);
    if (sp) {
      const an = sp.anims.find(a => RE.Idle.test(a.name) && a.frames.length) || sp.anims.find(a => a.frames.length);
      if (an) { const img = getImg(an.frames[Math.floor(now / 1000 * an.fps) % an.frames.length]); if (img.naturalWidth) World.drawPlayer(ctx, img, st.startX, st.startY, spriteUnit(sp), 1); }
    }
    if (S.tool === 'mulai') {
      ctx.strokeStyle = '#3ee8c8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(st.startX, st.startY); ctx.lineTo(st.startX, st.startY - 120); ctx.stroke();
      ctx.fillStyle = '#3ee8c8'; ctx.beginPath(); ctx.moveTo(st.startX, st.startY - 120); ctx.lineTo(st.startX + 34, st.startY - 106); ctx.lineTo(st.startX, st.startY - 92); ctx.fill();
    }
    ctx.restore();
  }

  function bindPointer(cv) {
    let drag = null;
    const wpos = e => { const r = cv.getBoundingClientRect(), sc = ST.h / World.H; return { x: (e.clientX - r.left) / sc + S.camX, y: (e.clientY - r.top) / sc }; };
    cv.onpointerdown = e => {
      if (S.tab !== 'stage') return;
      cv.setPointerCapture(e.pointerId); const p = wpos(e), st = SET();
      if (S.tool === 'teks') {
        const hit = World.hitText(S.project.texts, p.x, p.y);
        if (hit) { S.textId = hit.id; drag = { mode: 'text', t: hit, dx: hit.x - p.x, dy: hit.y - p.y }; renderRight(); }
        else { drag = { mode: 'pan', sx: e.clientX, cam: S.camX }; if (S.textId) { S.textId = null; renderRight(); } }
      } else if (S.tool === 'platform') {
        const L = platsOf() || []; let hit = -1;
        const sel = L[S.selPlat];
        if (sel && Math.abs(p.x - (sel.x + sel.w)) < 16 && p.y > sel.y - 14 && p.y < sel.y + Math.min(sel.h, 60) + 14) { drag = { mode: 'resize', pl: sel }; return; }
        for (let i = L.length - 1; i >= 0; i--) if (p.x >= L[i].x - 4 && p.x <= L[i].x + L[i].w + 4 && p.y >= L[i].y - 10 && p.y <= L[i].y + Math.min(L[i].h, 60) + 6) { hit = i; break; }
        if (hit >= 0) { S.selPlat = hit; drag = { mode: 'plat', pl: L[hit], dx: L[hit].x - p.x, dy: L[hit].y - p.y }; renderRight(); }
        else { drag = { mode: 'pan', sx: e.clientX, cam: S.camX }; if (S.selPlat >= 0) { S.selPlat = -1; renderRight(); } }
      } else if (S.tool === 'objek') {
        let hit = -1; const L = objs();
        for (let i = L.length - 1; i >= 0; i--) { const b = objBox(L[i]); if (p.x >= b.x - 6 && p.x <= b.x + b.w + 6 && p.y >= b.y - 6 && p.y <= b.y + b.h + 6) { hit = i; break; } }
        if (hit >= 0) { S.selObj = hit; drag = { mode: 'obj', o: L[hit], dx: L[hit].x - p.x, dy: L[hit].y - p.y }; renderRight(); }
        else { drag = { mode: 'pan', sx: e.clientX, cam: S.camX }; if (S.selObj >= 0) { S.selObj = -1; renderRight(); } }
      } else if (S.tool === 'mulai') {
        st.startX = clamp(snap(p.x), 0, 1800); st.startY = clamp(snap(p.y), 0, 340); drag = { mode: 'start' }; dirty(); renderRight();
      }
    };
    cv.onpointermove = e => {
      if (!drag) return; const p = wpos(e), st = SET();
      if (drag.mode === 'text') { drag.t.x = Math.round(p.x + drag.dx); drag.t.y = Math.round(p.y + drag.dy); }
      else if (drag.mode === 'pan') S.camX = drag.cam - (e.clientX - drag.sx) / (ST.h / World.H);
      else if (drag.mode === 'plat') { drag.pl.x = clamp(snap(p.x + drag.dx), 0, 1800); drag.pl.y = clamp(snap(p.y + drag.dy), 0, 380); }
      else if (drag.mode === 'resize') drag.pl.w = clamp(snap(p.x - drag.pl.x), 40, 1800);
      else if (drag.mode === 'obj') { drag.o.x = Math.round(clamp(p.x + drag.dx, 0, 1800)); drag.o.y = Math.round(clamp(p.y + drag.dy, 0, 400)); }
      else if (drag.mode === 'start') { st.startX = clamp(snap(p.x), 0, 1800); st.startY = clamp(snap(p.y), 0, 340); }
      drag.moved = true;
    };
    cv.onpointerup = cv.onpointercancel = () => { if (drag && drag.moved) { dirty(); if (drag.mode === 'plat' || drag.mode === 'resize' || drag.mode === 'start') renderRight(); } drag = null; };
  }

  /* ================= pustaka aset ================= */
  let prev = null;
  function playPrev(url) { if (prev) { prev.pause(); prev = null; } prev = new Audio(url); prev.play().catch(() => toast('Tidak bisa diputar')); }
  function libraryModal(tab) {
    tab = tab || 'sprite'; const D = Packs.data;
    const tabs = [['sprite', 'Sprite'], ['latar', 'Latar'], ['musik', 'Musik'], ['efek', 'Efek suara']].map(t => '<button class="' + (tab === t[0] ? 'on' : '') + '" data-lt="' + t[0] + '">' + t[1] + '</button>').join('');
    let body = '';
    if (tab === 'sprite') body = '<div class="libgrid">' + D.sprites.map(s => '<div class="libcard"><div class="libimg"><img src="packs/' + s.anims[0].frames[0] + '"></div><b>' + esc(s.name) + '</b><small>' + s.anims.map(a => a.name).join(', ') + '</small><button class="btn sm primary" data-lsp="' + esc(s.name) + '">+ Tambah</button></div>').join('') + '</div>';
    else if (tab === 'latar') body = '<div class="libgrid">' + [{ name: '', title: 'Bawaan' }].concat(D.bg).map(b => '<div class="libcard"><div class="libimg wide">' + (b.name ? '<img src="packs/bg/' + b.name + '.jpg">' : '<span class="small">Bintang</span>') + '</div><b>' + esc(b.title) + '</b><button class="btn sm ' + (SET().bg === b.name ? 'primary' : '') + '" data-lbg="' + b.name + '">' + (SET().bg === b.name ? 'Dipakai' : 'Pakai') + '</button></div>').join('') + '</div>';
    else if (tab === 'musik') body = D.music.map(m => '<div class="srow"><button class="icon-btn sm" data-lpl="packs/music/' + m.name + '.wav">' + I.play + '</button><div class="grow"><b>' + esc(m.title) + '</b><div class="small"><code>' + m.name + '</code> · ' + m.sec + ' dtk</div></div><button class="btn sm ' + (SET().music === m.name ? 'primary' : '') + '" data-lmu="' + m.name + '">' + (SET().music === m.name ? 'Musik latar' : 'Jadikan latar') + '</button></div>').join('') + '<div class="small" style="margin-top:8px">Di kode: <code>music.putar("nama")</code></div>';
    else body = '<div class="libgrid sfx">' + D.sfx.map(n => '<button class="chip" data-lpl="packs/sfx/' + n + '.wav">' + I.play + ' ' + n + '</button>').join('') + '</div><div class="small" style="margin-top:8px">Di kode: <code>sfx.putar("nama")</code></div>';
    const m = modal('<h3>Pustaka aset bawaan</h3><div class="tabs libtabs">' + tabs + '</div><div class="libbody">' + body + '</div><div class="row end"><button class="btn primary" id="lclose">Tutup</button></div>', 'wide libmodal');
    m.$('#lclose').onclick = () => { if (prev) prev.pause(); m.close(); renderEditor(); };
    m.el.addEventListener('dismiss', () => { if (prev) prev.pause(); m.close(); renderEditor(); });
    m.el.addEventListener('click', async e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.lt) { m.close(); return libraryModal(t.dataset.lt); }
      if (t.dataset.lpl) return playPrev(t.dataset.lpl);
      if (t.dataset.lmu !== undefined) { SET().music = t.dataset.lmu; dirty(); m.close(); return libraryModal('musik'); }
      if (t.dataset.lbg !== undefined) { SET().bg = t.dataset.lbg; dirty(); m.close(); return libraryModal('latar'); }
      if (t.dataset.lsp) {
        const src = D.sprites.find(s => s.name === t.dataset.lsp); t.textContent = '...'; t.disabled = true;
        try {
          let nm = src.name, k = 2; while (S.project.sprites.some(s => s.name === nm)) nm = src.name + ' ' + k++;
          const sp = mkSprite(nm); sp.scale = 0.9;
          for (const an of src.anims) { const a2 = mkAnim(an.name); a2.fps = an.fps; for (const f of an.frames) a2.frames.push(await urlToDataURL('packs/' + f)); sp.anims.push(a2); }
          S.project.sprites.push(sp); dirty(); t.textContent = 'Ditambahkan'; toast(nm + ' ditambahkan ke proyek');
        } catch (er) { t.textContent = 'Gagal'; console.error(er); }
      }
    });
  }

  /* ================= ekspor / impor / backup / statistik ================= */
  function projectBytes(p) { return JSON.stringify(p).length; }
  function exportProject() {
    const p = JSON.parse(JSON.stringify(S.project));
    saveBlobFile((S.project.name || 'proyek').replace(/[^\w-]+/g, '_') + '.prosprite', 'application/json', JSON.stringify({ prosprite: 1, project: p }));
  }
  async function importProjectText(txt) {
    const j = JSON.parse(txt); const p = j && j.project; if (!p || !Array.isArray(p.sprites)) throw new Error('Bukan file .prosprite');
    p.id = uid(); p.updated = Date.now(); p.name = (p.name || 'Impor') + ' (impor)'; delete p.published; p.sounds = p.sounds || []; p.scripts = p.scripts || [];
    await DB.put(p); S.homeTab = 'proj'; showHome(); toast('Proyek diimpor: ' + p.name);
  }
  const DB_all = DB.all.bind(DB);
  DB.allRaw = DB_all; DB.all = async () => (await DB_all()).filter(p => !String(p.id).startsWith('bk:'));
  async function backupNow(note) {
    const p = S.project; if (!p || String(p.id).startsWith('bk:')) return;
    await flush(); const all = (await DB_all()).filter(x => String(x.id).startsWith('bk:' + p.id + ':')).sort((a, b) => b.updated - a.updated);
    const copy = JSON.parse(JSON.stringify(p)); copy.id = 'bk:' + p.id + ':' + Date.now(); copy.bkNote = note || ''; copy.updated = Date.now();
    await DB.put(copy);
    for (const old of all.slice(4)) await DB.del(old.id);
  }
  async function backupModal() {
    const p = S.project; await flush();
    const list = (await DB_all()).filter(x => String(x.id).startsWith('bk:' + p.id + ':')).sort((a, b) => b.updated - a.updated);
    const m = modal('<h3>Backup proyek</h3><p class="small">Salinan otomatis dibuat tiap proyek dibuka dan sebelum publish (5 terakhir disimpan).</p>' +
      (list.length ? list.map(b => '<div class="srow"><div class="grow"><b>' + new Date(b.updated).toLocaleString('id-ID') + '</b><div class="small">' + (b.bkNote || 'otomatis') + ' · ' + (projectBytes(b) / 1048576).toFixed(1) + ' MB</div></div><button class="btn sm" data-bk="' + b.id + '">Pulihkan</button></div>').join('') : '<div class="empty-hint">Belum ada backup.</div>') +
      '<div class="row end" style="margin-top:10px"><button class="btn" id="bknow">Buat backup sekarang</button><button class="btn primary" id="bkc">Tutup</button></div>');
    m.$('#bkc').onclick = () => m.close(); m.el.addEventListener('dismiss', () => m.close());
    m.$('#bknow').onclick = async () => { await backupNow('manual'); m.close(); backupModal(); toast('Backup dibuat'); };
    m.el.addEventListener('click', async e => {
      const b = e.target.closest('[data-bk]'); if (!b) return;
      if (!await askConfirm('Pulihkan versi ini? Versi sekarang dibackup dulu.', 'Pulihkan')) return;
      await backupNow('sebelum pulihkan'); const src = list.find(x => x.id === b.dataset.bk); const copy = JSON.parse(JSON.stringify(src)); copy.id = p.id; delete copy.bkNote; copy.updated = Date.now();
      await DB.put(copy); m.close(); openProject(copy); toast('Proyek dipulihkan');
    });
  }
  function statsModal() {
    const p = S.project; let frames = 0, anims = 0; for (const s of p.sprites) { anims += s.anims.length; for (const a of s.anims) frames += a.frames.length; }
    const mb = projectBytes(p) / 1048576, pub = JSON.stringify(Game.packProject(p)).length / 1048576;
    const rows = [['ProSprite', p.sprites.length], ['Animasi', anims], ['Frame', frames], ['Teks', p.texts.length], ['Platform', (p.platforms || World.defaultPlatforms).length], ['Objek', (p.objects || []).length], ['Suara milikmu', (p.sounds || []).length], ['File kode', p.scripts.length], ['Ukuran proyek', mb.toFixed(2) + ' MB'], ['Ukuran saat publish', pub.toFixed(2) + ' MB (maks 30)']];
    const warn = pub > 25 ? '<div class="warn">Hampir melewati batas publish 30 MB. Kurangi frame atau suara.</div>' : (frames > 300 ? '<div class="warn">Frame banyak, game bisa berat di HP lama.</div>' : '');
    const m = modal('<h3>Statistik proyek</h3><table class="ttab">' + rows.map(r => '<tr><td>' + r[0] + '</td><td><b>' + r[1] + '</b></td></tr>').join('') + '</table>' + warn + '<div class="row end"><button class="btn primary" id="sc">Tutup</button></div>');
    m.$('#sc').onclick = () => m.close(); m.el.addEventListener('dismiss', () => m.close());
  }
  function moreModal() {
    const items = [['settings', 'Pengaturan game'], ['library', 'Pustaka aset'], ['tutorial', 'Tutorial Cmode'], ['export', 'Ekspor proyek (.prosprite)'], ['backup', 'Backup & pulihkan'], ['stats', 'Statistik proyek'], ['dupproj', 'Duplikat proyek ini']];
    const m = modal('<h3>Menu</h3><div class="menulist">' + items.map(i => '<button class="btn block" data-mi="' + i[0] + '">' + i[1] + '</button>').join('') + '</div>');
    m.el.addEventListener('dismiss', () => m.close());
    m.el.addEventListener('click', e => { const b = e.target.closest('[data-mi]'); if (!b) return; m.close(); const k = b.dataset.mi; setTimeout(() => { if (k === 'settings') settingsModal(); else if (k === 'library') libraryModal(); else if (k === 'tutorial') Tutorial.open(); else if (k === 'export') exportProject(); else if (k === 'backup') backupModal(); else if (k === 'stats') statsModal(); else if (k === 'dupproj') ACTS['dup-proj']({ dataset: { id: S.project.id } }); }, 190); });
  }

  /* ================= alat frame & animasi ================= */
  async function transformFrame(kind) {
    const an = curAnim(); if (!an || !an.frames.length) return toast('Belum ada frame');
    pauseAt(); const i = S.frame, im = await loadImage(an.frames[i]);
    const c = document.createElement('canvas'), rot = kind === 'rot'; c.width = rot ? im.naturalHeight : im.naturalWidth; c.height = rot ? im.naturalWidth : im.naturalHeight;
    const x = c.getContext('2d'); x.translate(c.width / 2, c.height / 2);
    if (kind === 'fh') x.scale(-1, 1); else if (kind === 'fv') x.scale(1, -1); else if (rot) x.rotate(Math.PI / 2);
    x.drawImage(im, -im.naturalWidth / 2, -im.naturalHeight / 2);
    an.frames[i] = c.toDataURL('image/png'); dirty(); renderEditor();
  }
  function sliceModal() {
    const m = modal('<h3>Potong sprite sheet</h3><p class="small">Pilih gambar yang berisi banyak frame dalam kotak-kotak, lalu isi jumlah kolom dan baris. Hasilnya jadi frame di animasi sekarang.</p>' +
      '<button class="btn block" id="sfile">Pilih gambar sheet</button><div id="sinfo" class="small" style="margin:6px 0"></div>' +
      '<div class="row"><div class="grow"><label>Kolom</label><input class="input" id="scols" type="number" min="1" max="30" value="4"></div><div class="grow"><label>Baris</label><input class="input" id="srows" type="number" min="1" max="30" value="1"></div></div>' +
      '<div class="row end" style="margin-top:12px"><button class="btn" id="sc">Batal</button><button class="btn primary" id="sok" disabled>Potong</button></div>');
    let img = null; const inp = $('#sheet-in');
    m.$('#sfile').onclick = () => { inp.value = ''; inp.click(); };
    inp.onchange = async () => { const f = inp.files[0]; if (!f) return; img = await createImageBitmap(f); m.$('#sinfo').textContent = f.name + ' (' + img.width + 'x' + img.height + ')'; m.$('#sok').disabled = false; };
    m.$('#sc').onclick = () => m.close(); m.el.addEventListener('dismiss', () => m.close());
    m.$('#sok').onclick = () => {
      const cols = clamp(+m.$('#scols').value | 0, 1, 30), rows = clamp(+m.$('#srows').value | 0, 1, 30), fw = Math.floor(img.width / cols), fh = Math.floor(img.height / rows), out = [];
      if (cols * rows > 120) return toast('Maksimal 120 frame');
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const cv = document.createElement('canvas'); cv.width = fw; cv.height = fh; cv.getContext('2d').drawImage(img, c * fw, r * fh, fw, fh, 0, 0, fw, fh); out.push(cv.toDataURL('image/png')); }
      m.close(); addFrames(out);
    };
  }
  function copyFrameModal() {
    const an = curAnim(); if (!an || !an.frames.length) return;
    const opts = []; for (const s of S.project.sprites) for (const q of s.anims) if (q !== an) opts.push([s.name + ' / ' + q.name, q.id]);
    if (!opts.length) return toast('Buat animasi lain dulu');
    const m = modal('<h3>Salin frame ke animasi lain</h3><select class="input" id="cto">' + opts.map(o => '<option value="' + o[1] + '">' + esc(o[0]) + '</option>').join('') + '</select><div class="row end" style="margin-top:12px"><button class="btn" id="mc">Batal</button><button class="btn primary" id="mo">Salin frame ini</button></div>');
    m.$('#mc').onclick = () => m.close(); m.el.addEventListener('dismiss', () => m.close());
    m.$('#mo').onclick = () => { for (const s of S.project.sprites) for (const q of s.anims) if (q.id === m.$('#cto').value) q.frames.push(an.frames[S.frame]); m.close(); dirty(); toast('Frame disalin'); renderEditor(); };
  }
  function animTools() {
    const an = curAnim(); if (!an) return '';
    return '<div class="sep"></div><label>Mode putar</label><select class="input" data-sf="@mode">' + [['loop', 'Ulang terus'], ['sekali', 'Sekali lalu berhenti'], ['pingpong', 'Maju mundur']].map(o => '<option value="' + o[0] + '"' + ((an.mode || 'loop') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>' +
      '<label>Alat frame</label><div class="toolgrid"><button class="btn sm" data-act="fr-fh">Balik ↔</button><button class="btn sm" data-act="fr-fv">Balik ↕</button><button class="btn sm" data-act="fr-rot">Putar 90°</button><button class="btn sm" data-act="fr-rev">Balik urutan</button><button class="btn sm" data-act="fr-copy">Salin ke anim</button><button class="btn sm" data-act="fr-slice">Potong sheet</button></div>' +
      '<button class="toggle ' + (S.onion ? 'on' : '') + '" style="margin-top:8px" data-act="onion"><span>Onion skin</span><span class="sw"></span></button>' +
      '<div class="row" style="margin-top:8px"><button class="btn sm grow" data-act="dup-anim">Duplikat animasi</button><button class="btn sm grow" data-act="dup-sprite">Duplikat sprite</button></div>';
  }

  /* ================= template proyek ================= */
  const TEMPLATES = [
    ['kosong', 'Kosong', 'Kontrol bawaan + utama.cd (karakter dasar). Cocok kalau kamu mau mulai dari nol.'],
    ['hero', 'Hero: ukuran + siklus hari', 'Tombol Kecil Besar (4 ukuran) + pagi/siang/sore/malam/subuh. Beri nama sprite pemain "Hero".'],
    ['aksi', 'Aksi: koin + musuh + nyawa', 'Sudah berisi slime, koin, permata, bendera, latar hutan, dan musik. Tinggal tambah pemain.']
  ];
  async function newProjectFlow() {
    const choice = await new Promise(res => {
      const m = modal('<h3>Proyek baru</h3><div class="menulist">' + TEMPLATES.map(t => '<button class="btn block tpl" data-tp="' + t[0] + '"><b>' + t[1] + '</b><small>' + t[2] + '</small></button>').join('') + '</div>');
      m.el.addEventListener('click', e => { const b = e.target.closest('[data-tp]'); if (b) { m.close(); res(b.dataset.tp); } });
      m.el.addEventListener('dismiss', () => { m.close(); res(null); });
    });
    if (!choice) return;
    const n = await askText('Nama proyek', choice === 'kosong' ? 'Proyek baru' : TEMPLATES.find(t => t[0] === choice)[1].split(':')[0]); if (!n) return;
    const p = mkProject(n); p.settings = {};
    if (choice === 'hero') {
      p.scripts = p.scripts.filter(f => f.name !== 'utama.cd');
      for (const nm of ['hero.cd', 'hero.js', 'hero.css']) p.scripts.push({ id: uid(), name: nm, code: await (await fetch('templates/' + nm)).text() });
    } else if (choice === 'aksi') {
      await Packs.ready;
      for (const nm of ['Slime', 'Koin', 'Permata', 'Bendera', 'Kelelawar']) {
        const src = Packs.data.sprites.find(s => s.name === nm); if (!src) continue; const sp = mkSprite(nm); sp.scale = 0.9;
        for (const an of src.anims) { const a2 = mkAnim(an.name); a2.fps = an.fps; for (const f of an.frames) a2.frames.push(await urlToDataURL('packs/' + f)); sp.anims.push(a2); }
        p.sprites.push(sp);
      }
      p.settings = { bg: 'hutan', music: 'petualangan', showLives: true, showScore: true, lives: 3, hari: false };
      p.objects = [
        { id: 'koin1', kind: 'item', anim: 'Koin', x: 330, y: 262 }, { id: 'koin2', kind: 'item', anim: 'Koin', x: 560, y: 194 }, { id: 'koin3', kind: 'item', anim: 'Koin', x: 800, y: 264 },
        { id: 'gem1', kind: 'item', anim: 'Permata', x: 1300, y: 132 }, { id: 'm1', kind: 'musuh', anim: 'Slime', x: 900, y: 340, range: 120, speed: 60 },
        { id: 'm2', kind: 'musuh', anim: 'Slime', x: 1500, y: 340, range: 160, speed: 70 }, { id: 'bendera', kind: 'benda', anim: 'Bendera', x: 1700, y: 340 }
      ];
      p.texts.push({ id: uid(), name: 'petunjuk', text: 'Kumpulkan koin, injak slime!', x: 260, y: 120, size: 22, color: '#ffffff' });
      p.scripts = p.scripts.filter(f => f.name !== 'utama.cd'); p.scripts.push({ id: uid(), name: 'utama.cd', code: TPL.AKSI_CD });
    }
    await DB.put(p); openProject(p);
  }
  const TPL = {
    AKSI_CD: ['{-- Template Aksi: koin, musuh, nyawa. Tambahkan ProSprite pemainmu dengan animasi Idle/Walk/Jump. --}', 'kodule skor impor', 'kodule sfx impor', 'kodule game impor', 'kodule melayang impor', 'kodule pencapaian impor', 'kodule collision impor', 'kodule player impor', 'kodule minimap impor', '', 'koin_diambil = 0', '', 'def mulai():', '    minimap.tampil()', '', 'def ambil_item(id):', '    koin_diambil = koin_diambil + 1', '    skor.tambah(10)', '    sfx.putar("koin")', '    melayang.tampil("+10", player.x(), player.y() - 70, "#ffd166")', '    jika koin_diambil == 3:', '        pencapaian.buka("tiga_koin", "Pengumpul koin")', '', 'def mati():', '    game.kalah("Game over", "Coba lagi!")', '', 'def update(dt):', '    jika collision.tabrak("bendera"):', '        game.menang("Sampai!", "Kamu menamatkan level ini")', ''].join('\n'),
    _: 0
  };

  /* ================= editor kode: undo, cari, snippet, font, indent ================= */
  const HIST = {};
  function hist(f) { return HIST[f.id] || (HIST[f.id] = { s: [f.code], i: 0 }); }
  function pushHist(f) { const h = hist(f); if (h.s[h.i] === f.code) return; h.s = h.s.slice(0, h.i + 1); h.s.push(f.code); if (h.s.length > 80) h.s.shift(); h.i = h.s.length - 1; }
  function applyHist(dir) {
    const f = curFile(); if (!f) return; const h = hist(f), ta = $('#code'); pushHist(f);
    const ni = h.i + dir; if (ni < 0 || ni >= h.s.length) return toast(dir < 0 ? 'Tidak ada yang bisa di-undo' : 'Tidak ada yang bisa di-redo', 1200);
    h.i = ni; f.code = h.s[ni]; ta.value = f.code; dirty(700); if (typeof checkCd === 'function') checkCd();
  }
  const SNIPPETS = [
    ['Karakter dasar', 'def mulai():\n    gravity.atur(9.8)\n    walk.atur_kecepatan(5)\n    jump.atur_tinggi(12)\n'],
    ['Lompat ganda', 'kodule jump impor\njump.lompat_ganda(2)\n'],
    ['Ketuk teks', 'def klik_teks(id):\n    jika id == "ketuk":\n        sfx.putar("koin")\n        skor.tambah(1)\n'],
    ['Ambil item', 'def ambil_item(id):\n    skor.tambah(10)\n    sfx.putar("koin")\n'],
    ['Injak / kena musuh', 'def injak_musuh(id):\n    musuh.bunuh(id)\n    skor.tambah(5)\n\ndef kena_musuh(id):\n    nyawa.kurang()\n    efek.getar(200, 6)\n'],
    ['Dialog pilihan', 'dialog.tanya("Lanjut?", ["Ya", "Tidak"], jawab)\n\ndef jawab(nomor, teks):\n    jika nomor == 0:\n        player.bicara("Ayo!")\n'],
    ['Musik latar', 'music.putar("petualangan")\n'],
    ['Siklus hari', 'kodule hari impor\nhari.mulai()\nhari.atur_durasi(50, 60, 60, 60, 90)\n'],
    ['Cuaca salju', 'kodule cuaca impor\ncuaca.salju()\n'],
    ['Gua gelap', 'kodule senter impor\nsenter.nyala(0.9, 130)\n'],
    ['Timer ulang', 'def detak():\n    print("tik")\n\nwaktu.ulang(1000, detak)\n'],
    ['Layar menang', 'game.menang("Selamat!", "Kamu menang")\n'],
    ['Pintu ke scene', 'scene.buat("level2")\npintu.buat("p1", "Pintu", 1600, 340, "level2", 100, 340)\n'],
    ['Simpan / muat', 'level = save.muat("level", 1)\nsave.simpan("level", level + 1)\n'],
    ['Tween halus', 'def atur(v):\n    player.skala(v)\n\ntween.mulai("besar", 1, 2, 600, atur, None, "mantul")\n']
  ];
  function snippetModal() {
    const m = modal('<h3>Snippet kode</h3><div class="menulist">' + SNIPPETS.map((s, i) => '<button class="btn block" data-sn="' + i + '">' + esc(s[0]) + '</button>').join('') + '</div>');
    m.el.addEventListener('dismiss', () => m.close());
    m.el.addEventListener('click', e => { const b = e.target.closest('[data-sn]'); if (!b) return; m.close(); insertAtCursor(SNIPPETS[+b.dataset.sn][1]); });
  }
  function findModal() {
    const ta = $('#code'); if (!ta) return;
    const m = modal('<h3>Cari & ganti</h3><input class="input" id="ffind" placeholder="Cari..."><input class="input" id="frep" placeholder="Ganti dengan..." style="margin-top:6px"><div class="small" id="fcnt" style="margin:6px 0"></div>' +
      '<div class="row end"><button class="btn" id="fnext">Berikutnya</button><button class="btn" id="frone">Ganti</button><button class="btn" id="frall">Ganti semua</button><button class="btn primary" id="fx">Tutup</button></div>');
    const cnt = () => { const q = m.$('#ffind').value; m.$('#fcnt').textContent = q ? (ta.value.split(q).length - 1) + ' ditemukan' : ''; };
    m.$('#ffind').oninput = cnt;
    m.$('#fnext').onclick = () => { const q = m.$('#ffind').value; if (!q) return; let i = ta.value.indexOf(q, ta.selectionEnd); if (i < 0) i = ta.value.indexOf(q); if (i < 0) return toast('Tidak ketemu', 1200); ta.setSelectionRange(i, i + q.length); ta.focus(); const lh = 18; ta.scrollTop = Math.max(0, ta.value.slice(0, i).split('\n').length * lh - 80); };
    m.$('#frone').onclick = () => { const q = m.$('#ffind').value; if (q && ta.value.slice(ta.selectionStart, ta.selectionEnd) === q) { ta.setRangeText(m.$('#frep').value, ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true })); } m.$('#fnext').click(); cnt(); };
    m.$('#frall').onclick = () => { const q = m.$('#ffind').value; if (!q) return; const n = ta.value.split(q).length - 1; ta.value = ta.value.split(q).join(m.$('#frep').value); ta.dispatchEvent(new Event('input', { bubbles: true })); toast(n + ' diganti'); cnt(); };
    m.$('#fx').onclick = () => m.close(); m.el.addEventListener('dismiss', () => m.close());
  }
  function codeTools() {
    const ta = $('#code'), f = curFile(); if (!ta || !f) return;
    const fs = +LS.get('ps_fs', 13); ta.style.fontSize = fs + 'px'; hist(f);
    const bar = document.createElement('div'); bar.className = 'ctools';
    bar.innerHTML = '<button class="btn sm" data-act="c-undo">Undo</button><button class="btn sm" data-act="c-redo">Redo</button><button class="btn sm" data-act="c-find">Cari</button><button class="btn sm" data-act="c-snip">Snippet</button><button class="btn sm" data-act="c-dup">Duplikat</button><div class="grow"></div><button class="btn sm" data-act="c-fs" data-d="-1">A−</button><button class="btn sm" data-act="c-fs" data-d="1">A+</button>';
    ta.parentNode.insertBefore(bar, ta);
    let tm = 0; ta.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => { const cf = curFile(); if (cf) pushHist(cf); }, 500); });
  }
  function autoIndent(e) {
    const ta = e.target; if (e.key !== 'Enter' || ta.id !== 'code' || e.shiftKey) return;
    const f = curFile(); if (!f || isCss(f) && false) return;
    const pos = ta.selectionStart, before = ta.value.slice(0, pos), line = before.slice(before.lastIndexOf('\n') + 1), ind = /^[ \t]*/.exec(line)[0];
    let extra = ''; const tl = line.trimEnd(); if (/\.cd$/i.test(f.name) ? tl.endsWith(':') : /[{(\[]$/.test(tl)) extra = '    ';
    e.preventDefault(); ta.setRangeText('\n' + ind + extra, ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /* ================= aksi ================= */
  const acts = {
    settings: () => settingsModal(), library: () => libraryModal(), more: () => moreModal(),
    'new-proj': () => newProjectFlow(),
    'import-proj': () => { const i = $('#proj-in'); i.value = ''; i.click(); },
    tool: b => { S.tool = b.dataset.t; S.selPlat = -1; S.selObj = -1; S.textId = null; renderRight(); },
    'plat-add': () => { const L = ensurePlats(); L.push({ x: snap(S.camX + 200), y: 240, w: 160, h: 16 }); S.selPlat = L.length - 1; dirty(); renderRight(); },
    'plat-del': () => { const L = platsOf(); if (L && L[S.selPlat]) { L.splice(S.selPlat, 1); S.selPlat = -1; dirty(); renderRight(); } },
    'plat-reset': async () => { if (await askConfirm('Kembalikan platform ke bawaan? Platform buatanmu dihapus.', 'Kembalikan')) { S.project.platforms = null; S.selPlat = -1; dirty(); renderRight(); } },
    'obj-add': b => {
      const an = ($('#newobj-an') || {}).value; if (!an) return;
      const L = objs(); let id = b.dataset.k + (L.length + 1); while (L.some(o => o.id === id)) id += 'x';
      const o = { id, kind: b.dataset.k, anim: an, x: snap(S.camX + 220), y: 340 }; if (o.kind === 'musuh') { o.range = 120; o.speed = 60; }
      L.push(o); S.selObj = L.length - 1; dirty(); renderRight();
    },
    'obj-del': () => { const L = objs(); if (L[S.selObj]) { L.splice(S.selObj, 1); S.selObj = -1; dirty(); renderRight(); } },
    'obj-phys': () => { const o = objs()[S.selObj]; if (o) { o.physics = !o.physics; dirty(); renderRight(); } },
    'start-reset': () => { const st = SET(); st.startX = 80; st.startY = 340; dirty(); renderRight(); },
    'fr-fh': () => transformFrame('fh'), 'fr-fv': () => transformFrame('fv'), 'fr-rot': () => transformFrame('rot'),
    'fr-rev': () => { const an = curAnim(); if (an) { an.frames.reverse(); S.frame = 0; dirty(); renderEditor(); toast('Urutan dibalik'); } },
    'fr-copy': () => copyFrameModal(), 'fr-slice': () => sliceModal(),
    onion: () => { S.onion = !S.onion; renderRight(); },
    'dup-anim': () => { const sp = curSprite(), an = curAnim(); if (!sp || !an) return; const c = JSON.parse(JSON.stringify(an)); c.id = uid(); c.name = an.name + ' 2'; sp.anims.push(c); S.animId = c.id; dirty(); renderEditor(); toast('Animasi diduplikat'); },
    'dup-sprite': () => { const sp = curSprite(); if (!sp) return; const c = JSON.parse(JSON.stringify(sp)); c.id = uid(); c.name = sp.name + ' 2'; for (const a of c.anims) a.id = uid(); S.project.sprites.push(c); S.spriteId = c.id; S.animId = c.anims[0] ? c.anims[0].id : null; dirty(); renderEditor(); toast('Sprite diduplikat'); },
    'c-undo': () => applyHist(-1), 'c-redo': () => applyHist(1), 'c-find': () => findModal(), 'c-snip': () => snippetModal(),
    'c-dup': () => { const f = curFile(); if (!f) return; const m = /^(.*?)(\.[^.]+)$/.exec(f.name) || [0, f.name, '']; const nf = { id: uid(), name: m[1] + '_salinan' + m[2], code: f.code }; S.project.scripts.push(nf); S.fileId = nf.id; dirty(); renderCode(); toast('File diduplikat'); },
    'c-fs': b => { const v = clamp(+LS.get('ps_fs', 13) + (+b.dataset.d) * 1, 9, 24); LS.set('ps_fs', v); const ta = $('#code'); if (ta) ta.style.fontSize = v + 'px'; }
  };

  /* ================= pasang pembungkus ke app.js ================= */
  const _rightHTML = rightHTML;
  rightHTML = function () {
    if (S.tab === 'stage') return stageRight();
    const h = _rightHTML();
    return S.tab === 'anim' ? h + animTools() : h;
  };
  drawScene = studioDrawScene;
  bindStagePointer = bindPointer;
  const _renderEditor = renderEditor;
  renderEditor = function () {
    _renderEditor();
    const tb = $('.topbar'); if (!tb) return;
    const codeBtn = $('[data-act="code"]', tb);
    const mk = (act, label) => { const b = document.createElement('button'); b.className = 'btn'; b.dataset.act = act; b.innerHTML = '<span>' + label + '</span>'; return b; };
    tb.insertBefore(mk('settings', 'Pengaturan'), codeBtn); tb.appendChild(mk('more', 'Menu'));
  };
  const _renderCode = renderCode;
  renderCode = function () { _renderCode(); codeTools(); };
  const _openProject = openProject;
  openProject = function (p) { _openProject(p); S.tool = 'teks'; S.selPlat = -1; S.selObj = -1; if (!p._bk) { p._bk = 1; backupNow('otomatis').catch(() => { }); } };
  const _showHome = showHome;
  showHome = async function () {
    await _showHome();
    const hh = $('.home-head'); if (hh && !$('[data-act="import-proj"]')) { const b = document.createElement('button'); b.className = 'btn'; b.dataset.act = 'import-proj'; b.textContent = 'Impor'; const t = $('[data-act="tutorial"]', hh); hh.insertBefore(b, t); }
  };
  const _drawStage = drawStage;
  drawStage = function (now) {
    _drawStage(now);
    if (S.tab === 'anim' && S.onion && ST && ST.w) {
      const an = curAnim(); if (!an || an.frames.length < 2) return;
      const idx = S.playing ? (S.shownIdx || 0) : S.frame, pi = (idx - 1 + an.frames.length) % an.frames.length, img = getImg(an.frames[pi]); if (!img.naturalWidth) return;
      const { ctx, w, h } = ST, pad = 26, k = Math.min((w - pad * 2) / img.naturalWidth, (h - pad * 2) / img.naturalHeight), dw = img.naturalWidth * k, dh = img.naturalHeight * k;
      ctx.save(); ctx.globalAlpha = 0.28; ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh); ctx.restore();
    }
  };

  function init() {
    document.addEventListener('input', onInput);
    document.addEventListener('keydown', autoIndent, true);
    // @mode (mode putar animasi)
    document.addEventListener('input', e => { if (e.target.dataset && e.target.dataset.sf === '@mode') { const an = curAnim(); if (an) { an.mode = e.target.value; dirty(); } } });
    $('#proj-in').addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { await importProjectText(await f.text()); } catch (er) { toast('Gagal impor: ' + er.message, 4000); } });
    Object.assign(ACTS, acts);
  }
  return { init, backupNow, TPL, saveBlobFile };
})();
