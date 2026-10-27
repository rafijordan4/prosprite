'use strict';
/* =====================================================================
   ProSprite - editor sprite + mode Coba platformer
   app.js: penyimpanan, UI beranda, editor, gambar, editor kode
   ===================================================================== */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const RE = { Idle: /^idle/i, Walk: /^(walk|moving|run)/i, Jump: /^jump/i };

/* ---------- ikon ---------- */
const ico = d => '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
const I = {
  back: ico('<path d="M15 18l-6-6 6-6"/>'),
  play: ico('<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>'),
  pause: ico('<path d="M8 5v14M16 5v14"/>'),
  plus: ico('<path d="M12 5v14M5 12h14"/>'),
  image: ico('<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 9"/>'),
  brush: ico('<path d="M3 21c3 0 5-1 5-4l9-9-1.5-1.5-9 9"/><path d="M14 6l4 4 2.5-2.5a1.9 1.9 0 0 0 0-2.7l-1.3-1.3a1.9 1.9 0 0 0-2.7 0z"/>'),
  trash: ico('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  copy: ico('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>'),
  code: ico('<path d="M8 8l-5 4 5 4M16 8l5 4-5 4M14 5l-4 14"/>'),
  left: ico('<path d="M15 6l-6 6 6 6"/>'),
  right: ico('<path d="M9 6l6 6-6 6"/>'),
  edit: ico('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
  undo: ico('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
  eraser: ico('<path d="M20 20H9L4 15l9-9 7 7-6 6"/>'),
  text: ico('<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'),
  x: ico('<path d="M6 6l12 12M18 6L6 18"/>'),
  check: ico('<path d="M5 13l4 4 10-10"/>'),
  upload: ico('<path d="M12 16V4M6 10l6-6 6 6M4 20h16"/>'),
  ghost: ico('<path d="M5 20V11a7 7 0 0 1 14 0v9l-3-2-2 2-2-2-2 2-2-2z"/><circle cx="9.5" cy="11" r=".6" fill="currentColor"/><circle cx="14.5" cy="11" r=".6" fill="currentColor"/>')
};

/* ---------- toast ---------- */
let toastT;
function toast(msg, ms = 2200) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms);
}

/* ---------- cache gambar ---------- */
const IMG = new Map();
function getImg(src) {
  let i = IMG.get(src);
  if (!i) { if (IMG.size > 400) IMG.clear(); i = new Image(); i.src = src; IMG.set(src, i); }
  return i;
}
const loadImage = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

/* ---------- IndexedDB ---------- */
const DB = (() => {
  let dbp;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('prosprite', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('projects', { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const tx = async (mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction('projects', mode);
      const rq = fn(t.objectStore('projects'));
      t.oncomplete = () => res(rq && rq.result);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  };
  return {
    all: () => tx('readonly', s => s.getAll()),
    get: id => tx('readonly', s => s.get(id)),
    put: p => tx('readwrite', s => s.put(p)),
    del: id => tx('readwrite', s => s.delete(id))
  };
})();

/* ---------- model ---------- */
const mkProject = name => ({ id: uid(), name, updated: Date.now(), sprites: [], texts: [], sounds: [], scripts: defaultScripts(), playerId: null });
const defaultScripts = () => [{ id: uid(), name: 'kontrol.js', code: DEFAULT_JS }, { id: uid(), name: 'kontrol.css', code: DEFAULT_CSS }, { id: uid(), name: 'utama.cd', code: DEFAULT_CD }];
const mkSprite = name => ({ id: uid(), name, scale: 1, anims: [] });
const mkAnim = name => ({ id: uid(), name, fps: 10, frames: [] });

const S = { view: 'home', project: null, spriteId: null, animId: null, frame: 0, tab: 'anim', textId: null, playing: true, fileId: null, camX: 0, animStart: 0, shownIdx: 0, raf: 0 };
const curSprite = () => (S.project && S.project.sprites.find(s => s.id === S.spriteId)) || null;
const curAnim = () => { const s = curSprite(); return (s && s.anims.find(a => a.id === S.animId)) || null; };
const curText = () => (S.project && S.project.texts.find(t => t.id === S.textId)) || null;

function findAnim(project, sprite, re) {
  const ok = a => re.test(a.name.trim()) && a.frames.length;
  let a = sprite && sprite.anims.find(ok);
  if (a) return a;
  for (const s of project.sprites) { a = s.anims.find(ok); if (a) return a; }
  return null;
}
function playerSprite(p) {
  return p.sprites.find(s => s.id === p.playerId) ||
    p.sprites.find(s => s.anims.some(a => a.frames.length && (RE.Idle.test(a.name) || RE.Walk.test(a.name) || RE.Jump.test(a.name)))) ||
    p.sprites[0] || null;
}
function spriteUnit(sp) {
  const a = sp.anims.find(a => RE.Idle.test(a.name) && a.frames.length) || sp.anims.find(a => a.frames.length);
  if (!a) return 0.3;
  const h = getImg(a.frames[0]).naturalHeight || 300;
  return (72 * (sp.scale || 1)) / h;
}

/* ---------- simpan otomatis ---------- */
let saveT;
function dirty(delay = 350) {
  if (!S.project) return;
  S.project.updated = Date.now();
  clearTimeout(saveT);
  saveT = setTimeout(() => DB.put(S.project).catch(e => toast('Gagal menyimpan: ' + e, 4000)), delay);
}
async function flush() { clearTimeout(saveT); if (S.project) { try { await DB.put(S.project); } catch (e) { console.error(e); } } }

/* ---------- modal ---------- */
function modal(html, cls = '') {
  const el = document.createElement('div');
  el.className = 'modal-back';
  el.innerHTML = '<div class="modal ' + cls + '">' + html + '</div>';
  $('#modal-root').appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  el.addEventListener('pointerdown', e => { if (e.target === el) el.dispatchEvent(new Event('dismiss')); });
  return { el, close() { el.classList.remove('in'); setTimeout(() => el.remove(), 170); }, $: s => $(s, el) };
}
function askText(title, value = '', ph = '') {
  return new Promise(res => {
    const m = modal('<h3>' + esc(title) + '</h3><input class="input" id="mt" value="' + esc(value) + '" placeholder="' + esc(ph) + '" maxlength="40"><div class="row end"><button class="btn" id="mc">Batal</button><button class="btn primary" id="mo">OK</button></div>');
    const inp = m.$('#mt'); setTimeout(() => { inp.focus(); inp.select(); }, 80);
    const done = v => { m.close(); res(v); };
    m.$('#mc').onclick = () => done(null);
    m.$('#mo').onclick = () => done(inp.value.trim() || null);
    inp.onkeydown = e => { if (e.key === 'Enter') done(inp.value.trim() || null); };
    m.el.addEventListener('dismiss', () => done(null));
  });
}
function askConfirm(msg, okLabel = 'Hapus') {
  return new Promise(res => {
    const m = modal('<p style="color:var(--text);font-size:14px;margin-bottom:4px">' + esc(msg) + '</p><div class="row end"><button class="btn" id="mc">Batal</button><button class="btn primary" id="mo">' + esc(okLabel) + '</button></div>');
    const done = v => { m.close(); res(v); };
    m.$('#mc').onclick = () => done(false);
    m.$('#mo').onclick = () => done(true);
    m.el.addEventListener('dismiss', () => done(false));
  });
}

/* ---------- proyek contoh ---------- */
const urlToDataURL = async u => {
  const b = await (await fetch(u)).blob();
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
};
async function seedExample() {
  const pad = n => String(n).padStart(2, '0');
  const load = async pre => { const o = []; for (let i = 0; i < 12; i++) o.push(await urlToDataURL('example/' + pre + '_' + pad(i) + '.png')); return o; };
  const p = mkProject('Contoh: Wraith'); p.id = 'example';
  const sp = mkSprite('Wraith'); sp.scale = 1.1;
  const idle = mkAnim('Idle'); idle.fps = 10; idle.frames = await load('idle');
  const walk = mkAnim('Walk'); walk.fps = 14; walk.frames = await load('walk');
  sp.anims.push(idle, walk); p.sprites.push(sp); p.playerId = sp.id;
  p.texts.push(
    { id: uid(), text: 'Geser joystick buat jalan', x: 190, y: 120, size: 22, color: '#ffffff' },
    { id: uid(), name: 'ketuk', text: 'Ketuk teks ini! \u{1F446}', x: 335, y: 238, size: 22, color: '#3ee8c8' },
    { id: uid(), text: 'Kamu sampai! \u{1F389}', x: 1550, y: 196, size: 26, color: '#ffd166' }
  );
  p.scripts.find(f => f.name === 'utama.cd').code = EXAMPLE_CD;
  return p;
}
const seededFlag = set => { try { if (set) localStorage.setItem('ps_seeded', '1'); return localStorage.getItem('ps_seeded') === '1'; } catch (e) { return false; } };

/* ---------- beranda ---------- */
function thumbOf(p) {
  const sp = playerSprite(p); if (!sp) return null;
  const a = sp.anims.find(a => RE.Idle.test(a.name) && a.frames.length) || sp.anims.find(a => a.frames.length);
  return a ? a.frames[0] : null;
}
async function showHome() {
  await flush();
  S.view = 'home'; S.project = null; stopStage();
  let list = [];
  try { list = (await DB.all()).sort((a, b) => b.updated - a.updated); } catch (e) { toast('Penyimpanan error: ' + e, 4000); }
  const cards = list.map(p => {
    const th = thumbOf(p);
    const fr = p.sprites.reduce((n, s) => n + s.anims.reduce((m, a) => m + a.frames.length, 0), 0);
    return '<div class="pcard">' + (p.id === 'example' ? '<span class="badge">CONTOH</span>' : '') +
      '<button class="pthumb" data-act="open-proj" data-id="' + p.id + '">' + (th ? '<img src="' + th + '">' : '<span class="empty">Kosong</span>') + '</button>' +
      '<button class="pinfo" data-act="open-proj" data-id="' + p.id + '"><b>' + esc(p.name) + '</b><span class="small">' + p.sprites.length + ' sprite · ' + fr + ' frame</span></button>' +
      '<div class="pacts"><button class="btn sm grow" data-act="ren-proj" data-id="' + p.id + '">Ubah nama</button>' +
      '<button class="icon-btn sm" data-act="dup-proj" data-id="' + p.id + '">' + I.copy + '</button>' +
      '<button class="icon-btn sm danger" data-act="del-proj" data-id="' + p.id + '">' + I.trash + '</button></div></div>';
  }).join('');
  const ht = S.homeTab || 'proj';
  const tabs = [['proj', 'Proyek'], ['game', 'Game'], ['akun', 'Akun']].map(t => '<button class="' + (ht === t[0] ? 'on' : '') + '" data-act="home-tab" data-t="' + t[0] + '">' + t[1] + '</button>').join('');
  $('#app').innerHTML = '<div class="home"><div class="home-head"><div class="logo">' + I.ghost + '</div><div><h1>ProSprite</h1><p>Bikin sprite, atur animasi, coba jadi game, lalu publish</p></div><div class="grow"></div><div class="tabs htabs">' + tabs + '</div><button class="btn" data-act="tutorial">Tutorial</button></div>' +
    '<div id="homebody">' + (ht === 'proj' ? '<div class="proj-grid"><button class="pcard newcard" data-act="new-proj"><div><div class="plus">' + I.plus + '</div><b>Proyek baru</b><div class="small">Kosong, siap diisi</div></div></button>' + cards + '</div>' : '') + '</div></div>';
  if (ht === 'game') Game.renderGame($('#homebody')); else if (ht === 'akun') Game.renderAkun($('#homebody'));
}

/* ---------- editor: render ---------- */
let ST = null, RO = null;

function openProject(p) {
  p.sprites = p.sprites || []; p.texts = p.texts || []; p.scripts = p.scripts || defaultScripts(); p.sounds = p.sounds || [];
  S.project = p; S.tab = 'anim'; S.textId = null; S.camX = 0; S.playing = true; S.frame = 0; S.fileId = null;
  const sp = playerSprite(p) || p.sprites[0];
  S.spriteId = sp ? sp.id : null;
  S.animId = sp && sp.anims[0] ? sp.anims[0].id : null;
  S.animStart = performance.now();
  renderEditor();
}

function renderEditor() {
  S.view = 'editor';
  const keepStrip = ($('#strip') || {}).scrollLeft || 0, keepLeft = ($('.left') || {}).scrollTop || 0;
  const p = S.project;
  const an = curAnim(); if (an) S.frame = clamp(S.frame, 0, Math.max(0, an.frames.length - 1));
  $('#app').innerHTML = '<div class="editor"><header class="topbar">' +
    '<button class="icon-btn" data-act="home">' + I.back + '</button>' +
    '<button class="proj-name" data-act="rename-proj">' + esc(p.name) + '</button><div class="grow"></div>' +
    '<button class="btn" data-act="code">' + I.code + '<span>Kode</span></button>' +
    '<button class="btn" data-act="publish">' + I.upload + '<span>Publish</span></button>' +
    '<button class="btn primary" data-act="play">' + I.play + '<span>Coba</span></button></header>' +
    '<div class="ed-main"><aside class="panel left">' + leftHTML() + '</aside><section class="center">' + centerHTML() + '</section><aside class="panel right">' + rightHTML() + '</aside></div></div>';
  const st = $('#strip'); if (st) st.scrollLeft = keepStrip;
  const lf = $('.left'); if (lf) lf.scrollTop = keepLeft;
  bindStage();
}
const renderRight = () => { const r = $('.right'); if (r) r.innerHTML = rightHTML(); };
const renderLeft = () => { const l = $('.left'); if (l) { const k = l.scrollTop; l.innerHTML = leftHTML(); l.scrollTop = k; } };

function leftHTML() {
  const p = S.project;
  const items = p.sprites.map(s => {
    const sel = s.id === S.spriteId;
    const fa = s.anims.find(a => a.frames.length), th = fa ? fa.frames[0] : null;
    let h = '<div class="sprite ' + (sel ? 'sel' : '') + '"><button class="sprite-head" data-act="sel-sprite" data-id="' + s.id + '"><span class="st">' + (th ? '<img src="' + th + '">' : '') + '</span><span><b data-nm="' + s.id + '">' + esc(s.name) + '</b><small class="small">' + s.anims.length + ' animasi' + (playerSprite(p) === s ? ' · <span class="player-tag">PEMAIN</span>' : '') + '</small></span></button>';
    if (sel) {
      h += '<div class="anims">' + s.anims.map(a => '<button class="anim ' + (a.id === S.animId ? 'on' : '') + '" data-act="sel-anim" data-id="' + a.id + '"><span data-nm="' + a.id + '">' + esc(a.name) + '</span><small>' + a.frames.length + '</small></button>').join('') +
        '<button class="anim add" data-act="add-anim">+ Animasi</button></div>';
    }
    return h + '</div>';
  }).join('');
  return '<div class="ph"><span>ProSprite</span><button class="icon-btn sm" data-act="add-sprite">' + I.plus + '</button></div>' +
    (items || '<div class="empty-hint">Belum ada ProSprite.<br>Tekan + buat bikin.</div>');
}

function centerHTML() {
  const an = curAnim(), isA = S.tab === 'anim';
  let top = '<div class="seg"><div class="tabs"><button class="' + (isA ? 'on' : '') + '" data-act="tab" data-tab="anim">Animasi</button><button class="' + (S.tab === 'stage' ? 'on' : '') + '" data-act="tab" data-tab="stage">Panggung</button><button class="' + (S.tab === 'sound' ? 'on' : '') + '" data-act="tab" data-tab="sound">Suara</button></div><div class="grow"></div>';
  if (isA) { if (an && an.frames.length > 1) top += '<button class="btn sm" data-act="toggle-play" id="playbtn">' + (S.playing ? I.pause + '<span>Jeda</span>' : I.play + '<span>Putar</span>') + '</button>'; }
  else if (S.tab === 'sound') top += '<button class="btn sm" data-act="add-sound">' + I.plus + '<span>Suara</span></button>';
  else top += '<button class="btn sm" data-act="add-text">' + I.text + '<span>Teks</span></button>';
  top += '</div>';
  if (S.tab === 'sound') return top + soundHTML();
  let wrap = '<div class="stage-wrap"><canvas id="stage"></canvas>';
  if (isA) {
    if (!an || !an.frames.length) {
      wrap += '<div class="stage-empty"><div>' + (an ? 'Belum ada frame.<br>Tekan <b>+ Frame</b> di bawah: ambil dari galeri atau gambar sendiri.' : 'Buat ProSprite dan animasi dulu di panel kiri,<br>atau langsung tekan <b>+ Frame</b>.') + '</div></div>';
    } else {
      wrap += '<div class="frame-actions"><button class="icon-btn sm" data-act="frame-left">' + I.left + '</button><button class="icon-btn sm" data-act="frame-right">' + I.right + '</button>' +
        '<button class="icon-btn sm" data-act="frame-edit">' + I.brush + '</button><button class="icon-btn sm" data-act="frame-dup">' + I.copy + '</button><button class="icon-btn sm danger" data-act="frame-del">' + I.trash + '</button></div>' +
        '<div class="frame-count" id="fcount">' + (S.frame + 1) + '/' + an.frames.length + '</div>';
    }
  }
  wrap += '</div>';
  let strip;
  if (isA) {
    strip = '<div class="strip" id="strip">' + (an ? an.frames.map((f, i) => '<button class="thumb ' + (i === S.frame && !S.playing ? 'sel' : '') + '" data-act="sel-frame" data-i="' + i + '"><img src="' + f + '"><i>' + (i + 1) + '</i></button>').join('') : '') +
      '<button class="thumb add" data-act="add-frames">' + I.plus + '<span>Frame</span></button></div>';
  } else {
    strip = '<div class="strip"><span class="hint">Seret teks buat memindah · geser area kosong buat menggeser panggung · karakter mulai di sisi kiri</span></div>';
  }
  return top + wrap + strip;
}

function soundHTML() {
  const L = S.project.sounds || [];
  const rows = L.map(x => '<div class="srow"><button class="icon-btn sm" data-act="play-sound" data-id="' + x.id + '">' + I.play + '</button><input class="input" data-f="snd-name" data-id="' + x.id + '" value="' + esc(x.name) + '" maxlength="20"><button class="icon-btn sm danger" data-act="del-sound" data-id="' + x.id + '">' + I.trash + '</button></div>').join('');
  const syn = (typeof Synth !== 'undefined' ? Synth.names : []).map(n => '<button class="chip" data-act="play-synth" data-n="' + n + '">' + n + '</button>').join('');
  return '<div class="soundwrap"><div class="small" style="margin-bottom:8px">Impor file suara (mp3/ogg/wav, maks 1,5 MB). Nama di sini dipakai di kode: <code>sfx.putar("nama")</code> atau <code>music.putar("nama")</code>.</div>' +
    (rows || '<div class="empty-hint">Belum ada suara.<br>Tekan <b>+ Suara</b> di atas.</div>') +
    '<div class="sep"></div><div class="small">Suara bawaan (tanpa file), ketuk buat dengar:</div><div class="chips">' + syn + '</div></div>';
}
function rightHTML() {
  if (S.tab === 'sound') return '<div class="empty-hint">Suara bisa dipakai lewat kode Cmode:<br><br><code>sfx.putar("lompat")</code><br><code>music.putar("latar")</code></div>';
  const sp = curSprite(), an = curAnim();
  if (S.tab === 'stage') {
    const t = curText();
    if (!t) return '<div class="empty-hint">Ketuk teks di panggung buat mengubahnya, atau tekan <b>Teks</b> buat nambah.<br><br>Di mode Coba, teks dan karakter bisa diklik lewat skrip.</div>';
    return '<label>ID untuk kode</label><input class="input" data-f="t-name" value="' + esc(t.name || '') + '" maxlength="20" placeholder="mis. ketuk">' +
      '<label>Isi teks</label><input class="input" data-f="t-text" value="' + esc(t.text) + '" maxlength="60">' +
      '<label>Ukuran <span class="val" id="v-tsize">' + t.size + '</span></label><input type="range" min="12" max="72" value="' + t.size + '" data-f="t-size">' +
      '<label>Warna</label><input type="color" value="' + t.color + '" data-f="t-color"><div class="sep"></div>' +
      '<button class="btn danger block" data-act="del-text">' + I.trash + '<span>Hapus teks</span></button>';
  }
  if (!sp) return '<div class="empty-hint">Pengaturan muncul di sini setelah kamu membuat ProSprite.</div>';
  let h = '';
  if (an) {
    h += '<label>Animasi</label><input class="input" data-f="a-name" value="' + esc(an.name) + '" maxlength="24"><div class="chips">' +
      ['Idle', 'Walk', 'Jump'].map(n => '<button class="chip ' + (RE[n].test(an.name.trim()) ? 'on' : '') + '" data-act="quick-name" data-n="' + n + '">' + n + '</button>').join('') + '</div>' +
      '<div class="small" style="margin-top:6px">Mode Coba mencari animasi bernama Idle, Walk, dan Jump.</div>' +
      '<label>Kecepatan <span class="val" id="v-fps">' + an.fps + ' fps</span></label><input type="range" min="1" max="30" value="' + an.fps + '" data-f="a-fps">' +
      '<button class="btn sm danger block" style="margin-top:8px" data-act="del-anim">Hapus animasi</button><div class="sep"></div>';
  }
  h += '<label>Sprite</label><input class="input" data-f="s-name" value="' + esc(sp.name) + '" maxlength="24">' +
    '<label>Ukuran di game <span class="val" id="v-scale">' + (sp.scale || 1).toFixed(1) + 'x</span></label><input type="range" min="0.4" max="3" step="0.1" value="' + (sp.scale || 1) + '" data-f="s-scale">' +
    '<div style="margin-top:10px"><button class="toggle ' + (S.project.playerId === sp.id ? 'on' : '') + '" data-act="set-player"><span>Jadi pemain</span><span class="sw"></span></button></div>' +
    '<button class="btn sm danger block" style="margin-top:8px" data-act="del-sprite">Hapus sprite</button>';
  return h;
}

/* ---------- editor: kanvas panggung ---------- */
function bindStage() {
  const cv = $('#stage');
  if (!cv) { ST = null; if (RO) RO.disconnect(); return; }
  ST = { cv, ctx: cv.getContext('2d'), w: 0, h: 0, dpr: Math.min(2, window.devicePixelRatio || 1) };
  const fit = () => {
    const r = cv.parentElement.getBoundingClientRect();
    ST.w = r.width; ST.h = r.height;
    cv.width = Math.max(1, Math.round(r.width * ST.dpr)); cv.height = Math.max(1, Math.round(r.height * ST.dpr));
  };
  fit();
  if (RO) RO.disconnect();
  RO = new ResizeObserver(fit); RO.observe(cv.parentElement);
  bindStagePointer(cv);
  startStage();
}
function startStage() { if (!S.raf) S.raf = requestAnimationFrame(stageTick); }
function stopStage() { if (S.raf) cancelAnimationFrame(S.raf); S.raf = 0; }
function stageTick(now) {
  S.raf = requestAnimationFrame(stageTick);
  if (S.view !== 'editor' || Play.active) return;
  try { drawStage(now); } catch (e) { console.error(e); }
}
function markFrame(idx) {
  const an = curAnim(); if (!an) return;
  $$('#strip .thumb[data-i]').forEach(b => {
    const on = +b.dataset.i === idx;
    b.classList.toggle('sel', on);
    if (on && !S.playing) b.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  });
  const c = $('#fcount'); if (c) c.textContent = (idx + 1) + '/' + an.frames.length;
}
function drawStage(now) {
  if (!ST || !ST.w) return;
  const { ctx, w, h, dpr } = ST;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  if (S.tab === 'stage') return drawScene(now);
  const an = curAnim(); if (!an || !an.frames.length) return;
  let idx = S.frame;
  if (S.playing) {
    idx = Math.max(0, Math.floor((now - S.animStart) / 1000 * an.fps) % an.frames.length);
    if (idx !== S.shownIdx) { S.shownIdx = idx; markFrame(idx); }
  }
  const img = getImg(an.frames[idx]); if (!img.complete || !img.naturalWidth) return;
  const pad = 26, k = Math.min((w - pad * 2) / img.naturalWidth, (h - pad * 2) / img.naturalHeight);
  const dw = img.naturalWidth * k, dh = img.naturalHeight * k;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}
function drawScene(now) {
  const { ctx, w, h } = ST, scale = h / World.H, vw = w / scale;
  S.camX = clamp(S.camX, 0, Math.max(0, World.W - vw));
  World.draw(ctx, w, h, S.camX, scale, S.project.texts, S.textId, World.defaultPlatforms);
  const sp = playerSprite(S.project); if (!sp) return;
  const an = sp.anims.find(a => RE.Idle.test(a.name) && a.frames.length) || sp.anims.find(a => a.frames.length); if (!an) return;
  const img = getImg(an.frames[Math.floor(now / 1000 * an.fps) % an.frames.length]); if (!img.naturalWidth) return;
  ctx.save(); ctx.translate(-S.camX * scale, 0); ctx.scale(scale, scale);
  World.drawPlayer(ctx, img, 80, World.groundY, spriteUnit(sp), 1);
  ctx.restore();
}
function bindStagePointer(cv) {
  let drag = null;
  const wpos = e => { const r = cv.getBoundingClientRect(), sc = ST.h / World.H; return { x: (e.clientX - r.left) / sc + S.camX, y: (e.clientY - r.top) / sc }; };
  cv.onpointerdown = e => {
    if (S.tab !== 'stage') return;
    cv.setPointerCapture(e.pointerId);
    const p = wpos(e), hit = World.hitText(S.project.texts, p.x, p.y);
    if (hit) { S.textId = hit.id; drag = { mode: 'text', t: hit, dx: hit.x - p.x, dy: hit.y - p.y, moved: false }; renderRight(); }
    else { drag = { mode: 'pan', sx: e.clientX, cam: S.camX, moved: false }; if (S.textId) { S.textId = null; renderRight(); } }
  };
  cv.onpointermove = e => {
    if (!drag) return;
    if (drag.mode === 'text') { const p = wpos(e); drag.t.x = Math.round(p.x + drag.dx); drag.t.y = Math.round(p.y + drag.dy); }
    else S.camX = drag.cam - (e.clientX - drag.sx) / (ST.h / World.H);
    drag.moved = true;
  };
  cv.onpointerup = cv.onpointercancel = () => { if (drag && drag.mode === 'text' && drag.moved) dirty(); drag = null; };
}

/* ---------- editor: aksi ---------- */
function ensureTarget() {
  const p = S.project;
  let sp = curSprite();
  if (!sp) { sp = mkSprite('Pemain'); p.sprites.push(sp); S.spriteId = sp.id; }
  let an = curAnim();
  if (!an) {
    an = mkAnim(sp.anims.some(a => RE.Idle.test(a.name)) ? 'Anim ' + (sp.anims.length + 1) : 'Idle');
    sp.anims.push(an); S.animId = an.id;
  }
  return an;
}
function addFrames(srcs) {
  const an = ensureTarget();
  for (const s of srcs) an.frames.push(s);
  S.frame = an.frames.length - 1; S.playing = true; S.animStart = performance.now(); S.tab = 'anim';
  dirty(); renderEditor(); toast(srcs.length + ' frame ditambahkan');
}
function pauseAt() { if (S.playing) { S.frame = S.shownIdx || 0; S.playing = false; } }
function syncPlayBtn() {
  const pb = $('#playbtn'); if (pb) pb.innerHTML = S.playing ? I.pause + '<span>Jeda</span>' : I.play + '<span>Putar</span>';
}
async function fileToDataURL(f, max = 1024) {
  const bmp = await createImageBitmap(f);
  let w = bmp.width, h = bmp.height; const k = Math.min(1, max / Math.max(w, h));
  w = Math.round(w * k); h = Math.round(h * k);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(bmp, 0, 0, w, h); if (bmp.close) bmp.close();
  return f.type === 'image/jpeg' ? c.toDataURL('image/jpeg', 0.92) : c.toDataURL('image/png');
}
async function importFiles(files) {
  const arr = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  toast('Memuat ' + arr.length + ' gambar...', 6000);
  const out = [];
  for (const f of arr) { try { out.push(await fileToDataURL(f)); } catch (e) { console.error(e); } }
  if (!out.length) return toast('Gambar tidak bisa dibaca');
  addFrames(out);
}
function askAnimName() {
  return new Promise(res => {
    const m = modal('<h3>Animasi baru</h3><div class="chips" style="margin:0 0 10px">' + ['Idle', 'Walk', 'Jump'].map(n => '<button class="chip" data-q="' + n + '">' + n + '</button>').join('') + '</div>' +
      '<input class="input" id="mt" placeholder="atau nama lain, mis. Attack" maxlength="24"><div class="row end"><button class="btn" id="mc">Batal</button><button class="btn primary" id="mo">Buat</button></div>');
    const done = v => { m.close(); res(v); };
    $$('[data-q]', m.el).forEach(b => b.onclick = () => done(b.dataset.q));
    m.$('#mc').onclick = () => done(null);
    m.$('#mo').onclick = () => done(m.$('#mt').value.trim() || null);
    m.$('#mt').onkeydown = e => { if (e.key === 'Enter') done(m.$('#mt').value.trim() || null); };
    m.el.addEventListener('dismiss', () => done(null));
  });
}
function frameMenu() {
  const m = modal('<h3>Tambah frame</h3><div class="pick"><button id="pg">' + I.image + '<span>Dari galeri</span><small>Pilih banyak gambar sekaligus, diurutkan sesuai nama file</small></button><button id="pd">' + I.brush + '<span>Gambar sendiri</span><small>Kanvas kosong, simpan jadi frame</small></button></div>');
  m.$('#pg').onclick = () => { m.close(); const inp = $('#file-in'); inp.value = ''; inp.click(); };
  m.$('#pd').onclick = async () => { m.close(); const src = await openDraw(null); if (src) addFrames([src]); };
}

const ACTS = {
  'new-proj': async () => {
    const n = await askText('Nama proyek', 'Proyek baru'); if (!n) return;
    const p = mkProject(n); await DB.put(p); openProject(p);
  },
  'open-proj': async b => { const p = await DB.get(b.dataset.id); if (p) openProject(p); },
  'ren-proj': async b => { const p = await DB.get(b.dataset.id); const n = await askText('Ubah nama proyek', p.name); if (n) { p.name = n; p.updated = Date.now(); await DB.put(p); showHome(); } },
  'dup-proj': async b => {
    const p = JSON.parse(JSON.stringify(await DB.get(b.dataset.id)));
    p.id = uid(); p.name += ' (salinan)'; p.updated = Date.now(); await DB.put(p); showHome(); toast('Proyek diduplikat');
  },
  'del-proj': async b => {
    const p = await DB.get(b.dataset.id);
    if (await askConfirm('Hapus proyek "' + p.name + '"? Tidak bisa dibalikin.')) { await DB.del(p.id); showHome(); }
  },
  home: () => showHome(),
  'home-tab': b => { S.homeTab = b.dataset.t; showHome(); },
  'rename-proj': async () => { const n = await askText('Nama proyek', S.project.name); if (n) { S.project.name = n; dirty(); $('.proj-name').textContent = n; } },
  tab: b => { S.tab = b.dataset.tab; S.textId = null; renderEditor(); },
  'add-sprite': async () => {
    const n = await askText('Nama ProSprite', S.project.sprites.length ? 'Sprite ' + (S.project.sprites.length + 1) : 'Pemain'); if (!n) return;
    const sp = mkSprite(n); S.project.sprites.push(sp); S.spriteId = sp.id; S.animId = null; S.frame = 0; S.tab = 'anim'; dirty(); renderEditor();
  },
  'sel-sprite': b => { const sp = S.project.sprites.find(s => s.id === b.dataset.id); S.spriteId = sp.id; S.animId = sp.anims[0] ? sp.anims[0].id : null; S.frame = 0; S.playing = true; S.animStart = performance.now(); S.tab = 'anim'; renderEditor(); },
  'add-anim': async () => {
    const sp = curSprite(); if (!sp) return;
    const n = await askAnimName(); if (!n) return;
    if (sp.anims.some(a => a.name.toLowerCase() === n.toLowerCase())) return toast('Sudah ada animasi bernama ' + n);
    const an = mkAnim(n); if (RE.Jump.test(n)) an.fps = 12; sp.anims.push(an); S.animId = an.id; S.frame = 0; S.tab = 'anim'; dirty(); renderEditor();
  },
  'sel-anim': b => { S.animId = b.dataset.id; S.frame = 0; S.playing = true; S.animStart = performance.now(); S.tab = 'anim'; renderEditor(); },
  'quick-name': b => { const an = curAnim(); an.name = b.dataset.n; dirty(); renderEditor(); },
  'toggle-play': () => {
    const an = curAnim(); if (!an) return;
    if (S.playing) pauseAt(); else { S.playing = true; S.animStart = performance.now() - S.frame / an.fps * 1000; }
    syncPlayBtn(); markFrame(S.playing ? S.shownIdx : S.frame);
  },
  'sel-frame': b => { S.frame = +b.dataset.i; S.playing = false; syncPlayBtn(); markFrame(S.frame); },
  'frame-left': () => { pauseAt(); const an = curAnim(), i = S.frame; if (i > 0) { [an.frames[i - 1], an.frames[i]] = [an.frames[i], an.frames[i - 1]]; S.frame--; dirty(); } renderEditor(); },
  'frame-right': () => { pauseAt(); const an = curAnim(), i = S.frame; if (i < an.frames.length - 1) { [an.frames[i + 1], an.frames[i]] = [an.frames[i], an.frames[i + 1]]; S.frame++; dirty(); } renderEditor(); },
  'frame-dup': () => { pauseAt(); const an = curAnim(); an.frames.splice(S.frame + 1, 0, an.frames[S.frame]); S.frame++; dirty(); renderEditor(); },
  'frame-del': () => { pauseAt(); const an = curAnim(); an.frames.splice(S.frame, 1); S.frame = clamp(S.frame, 0, Math.max(0, an.frames.length - 1)); dirty(); renderEditor(); },
  'frame-edit': async () => { pauseAt(); const an = curAnim(), i = S.frame; renderEditor(); const src = await openDraw(an.frames[i]); if (src) { an.frames[i] = src; dirty(); renderEditor(); } },
  'add-frames': () => frameMenu(),
  'set-player': () => { const sp = curSprite(); S.project.playerId = S.project.playerId === sp.id ? null : sp.id; dirty(); renderEditor(); },
  'del-anim': async () => { const sp = curSprite(), an = curAnim(); if (await askConfirm('Hapus animasi "' + an.name + '"?')) { sp.anims = sp.anims.filter(a => a !== an); S.animId = sp.anims[0] ? sp.anims[0].id : null; S.frame = 0; dirty(); renderEditor(); } },
  'del-sprite': async () => { const sp = curSprite(); if (await askConfirm('Hapus sprite "' + sp.name + '" beserta semua animasinya?')) { const p = S.project; p.sprites = p.sprites.filter(s => s !== sp); if (p.playerId === sp.id) p.playerId = null; const n = p.sprites[0]; S.spriteId = n ? n.id : null; S.animId = n && n.anims[0] ? n.anims[0].id : null; S.frame = 0; dirty(); renderEditor(); } },
  'add-text': () => {
    const t = { id: uid(), name: 'teks' + (S.project.texts.length + 1), text: 'Halo!', x: Math.round(S.camX + (ST ? ST.w / (ST.h / World.H) / 2 : 300)), y: 150, size: 28, color: '#ffffff' };
    S.project.texts.push(t); S.textId = t.id; dirty(); renderRight();
  },
  'del-text': () => { S.project.texts = S.project.texts.filter(t => t.id !== S.textId); S.textId = null; dirty(); renderRight(); },
  'add-sound': () => { const inp = $('#audio-in'); inp.value = ''; inp.click(); },
  'play-sound': b => { const x = S.project.sounds.find(q => q.id === b.dataset.id); if (x) { const a = new Audio(x.src); a.play().catch(() => toast('Tidak bisa diputar')); } },
  'play-synth': b => { if (typeof Synth !== 'undefined') Synth.play(b.dataset.n, 1); },
  'del-sound': async b => { const x = S.project.sounds.find(q => q.id === b.dataset.id); if (x && await askConfirm('Hapus suara "' + x.name + '"?')) { S.project.sounds = S.project.sounds.filter(q => q !== x); dirty(); renderEditor(); } },
  play: () => Play.start(S.project),
  publish: () => Game.publish(),
  tutorial: () => Tutorial.open(),
  'file-add-cd': () => addFile('cd'),
  'file-import': () => { const i = $('#code-in'); i.value = ''; i.click(); },
  code: () => showCode(),
  /* kode */
  'code-back': () => { renderEditor(); },
  'file-sel': b => { S.fileId = b.dataset.id; renderCode(); },
  'file-add-js': () => addFile('js'),
  'file-add-css': () => addFile('css'),
  'file-del': async () => { const f = curFile(); if (f && await askConfirm('Hapus file "' + f.name + '"?')) { S.project.scripts = S.project.scripts.filter(x => x !== f); S.fileId = null; dirty(); renderCode(); } },
  'file-reset': async () => {
    if (!await askConfirm('Pasang ulang kontrol bawaan (kontrol.js dan kontrol.css)? File dengan nama sama akan ditimpa.', 'Pasang')) return;
    const sc = S.project.scripts;
    for (const [name, code] of [['kontrol.js', DEFAULT_JS], ['kontrol.css', DEFAULT_CSS]]) {
      const ex = sc.find(x => x.name === name); if (ex) ex.code = code; else sc.push({ id: uid(), name, code });
    }
    dirty(); renderCode(); toast('Kontrol bawaan dipasang');
  },
  'code-help': () => {
    const m = modal('<h3>Pro API (untuk file .js)</h3><pre class="help">' + esc(HELP_TEXT) + '</pre><div class="row end"><button class="btn primary" id="mo">Tutup</button></div>', 'wide');
    m.$('#mo').onclick = () => m.close(); m.el.addEventListener('dismiss', () => m.close());
  }
};
const HELP_TEXT = [
  'Pro.input.x          -1..1  arah jalan (diisi joystick)',
  'Pro.input.jump       true/false  tombol lompat',
  'Pro.player           {x, y, vx, vy, onGround, facing}',
  'Pro.speed            kecepatan jalan (220)',
  'Pro.jumpPower        kekuatan lompat (640)',
  'Pro.gravity          gravitasi (1800)',
  'Pro.platforms        daftar {x, y, w, h}',
  'Pro.texts            daftar teks {text, x, y, size, color}',
  'Pro.ui               elemen DIV buat naruh tombol / HUD',
  '',
  'Pro.on("click", fn)   fn(e): e.type = "text" atau "sprite", e.target',
  'Pro.on("update", fn)  fn(dt) dipanggil tiap frame',
  'Pro.on("start", fn)   Pro.on("stop", fn)',
  '',
  'Pro.jump()            suruh karakter lompat',
  'Pro.say("teks", ms)   gelembung ucapan di atas karakter',
  'Pro.effect("Nama", x, y, ms, {anchor:"center"})',
  '                      tampilkan animasi lain (mis. "Startled") di posisi x,y',
  '                      selama ms; return null kalau animasinya tidak ada',
  'teks.visible = false  sembunyikan teks (true = tampil lagi)',
  'Pro.toast("teks")     pesan kecil di atas layar',
  'Pro.listen(window, "keydown", fn)',
  '                      pasang listener; otomatis dicabut saat keluar',
  'Pro.exit()            keluar dari mode Coba',
  '',
  'File .css otomatis dipasang saat Coba.',
  'Tombol Keluar selalu ada (tidak bisa dihapus).',
  'Karakter mencari animasi bernama Idle, Walk/Walking, dan Jump.',
  'Gambar aslinya harus menghadap kanan; saat jalan ke kiri otomatis dibalik.'
].join('\n');

/* ---------- editor kode ---------- */
const curFile = () => (S.project.scripts.find(f => f.id === S.fileId)) || null;
const isCss = f => /\.css$/i.test(f.name);
const isCd = f => /\.cd$/i.test(f.name);
function showCode() { stopStage(); renderCode(); }
function renderCode() {
  S.view = 'code';
  const p = S.project;
  let f = curFile() || p.scripts[0] || null; S.fileId = f ? f.id : null;
  const files = p.scripts.map(x => '<button class="file ' + (x === f ? 'on' : '') + '" data-act="file-sel" data-id="' + x.id + '"><span class="dot" style="background:' + (isCss(x) ? '#2bb3ff' : isCd(x) ? '#3ee8c8' : '#ffd166') + '"></span><span class="nm" data-nm="' + x.id + '">' + esc(x.name) + '</span></button>').join('');
  const keys = ['Tab', '{', '}', '(', ')', '[', ']', ';', '=', '"', "'", '<', '>', '/', '.', ',', ':', '!', '+', '-', '*', '&', '|'];
  $('#app').innerHTML = '<div class="codeview"><header class="topbar"><button class="icon-btn" data-act="code-back">' + I.back + '</button><b style="margin-left:4px">Kode</b><span class="small" style="margin-left:6px">JS + CSS proyek ini</span><div class="grow"></div>' +
    '<button class="btn" data-act="tutorial">Tutorial Cmode</button><button class="btn" data-act="code-help">API JS</button><button class="btn primary" data-act="play">' + I.play + '<span>Coba</span></button></header>' +
    '<div class="code-main"><aside class="panel"><div class="ph"><span>File</span></div>' + (files || '<div class="empty-hint">Belum ada file.</div>') +
    '<div class="sep"></div><div class="row"><button class="btn sm grow" data-act="file-add-js">+ JS</button><button class="btn sm grow" data-act="file-add-css">+ CSS</button><button class="btn sm grow" data-act="file-add-cd">+ CD</button></div><button class="btn sm block" style="margin-top:6px" data-act="file-import">Impor file (.cd .js .css)</button>' +
    '<button class="btn sm block" style="margin-top:6px" data-act="file-reset">Pasang kontrol bawaan</button></aside>' +
    '<section class="ecol">' + (f ? '<div class="fname"><input class="input" data-f="file-name" value="' + esc(f.name) + '" maxlength="32"><button class="icon-btn danger" data-act="file-del">' + I.trash + '</button></div>' +
      '<textarea id="code" data-f="code" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off">' + esc(f.code) + '</textarea>' +
      '<div id="cderr" class="cderr"></div><div class="keys">' + keys.map(k => '<button data-ins="' + esc(k) + '">' + esc(k) + '</button>').join('') + '</div>'
      : '<div class="empty-hint" style="margin:auto">Tidak ada file. Tambah file JS atau CSS di kiri.<br>Kalau kontrol bawaan dihapus, tombol "Pasang kontrol bawaan" bisa memasangnya lagi.</div>') +
    '</section></div></div>';
  checkCd();
}
function checkCd() {
  const el = $('#cderr'), f = curFile(); if (!el) return;
  if (!f || !isCd(f)) { el.style.display = 'none'; return; }
  el.style.display = '';
  const r = Cmode.check(f.code, f.name);
  el.className = 'cderr ' + (r ? 'bad' : 'ok'); el.textContent = r ? 'Baris ' + r.line + ': ' + r.message : 'Cmode OK: tidak ada kesalahan';
}
async function addFile(type) {
  const n = await askText('Nama file ' + type.toUpperCase(), type === 'js' ? 'skrip.js' : type === 'css' ? 'gaya.css' : 'level.cd'); if (!n) return;
  const name = new RegExp('\\.' + type + '$', 'i').test(n) ? n : n + '.' + type;
  const f = { id: uid(), name, code: type === 'js' ? '// Skrip tambahan\n// Pro.on("update", function (dt) { });\n' : type === 'css' ? '/* Gaya tambahan */\n' : '{-- Cmode --}\nkodule player impor\n\ndef mulai():\n    player.bicara("Halo!")\n' };
  S.project.scripts.push(f); S.fileId = f.id; dirty(); renderCode();
}
function insertAtCursor(text) {
  const ta = $('#code'); if (!ta) return;
  const a = ta.selectionStart, b = ta.selectionEnd;
  ta.setRangeText(text === 'Tab' ? '    ' : text, a, b, 'end');
  ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus();
}

/* ---------- gambar sendiri ---------- */
function openDraw(src) {
  return new Promise(async res => {
    let W = 512, H = 512, img = null;
    if (src) { try { img = await loadImage(src); W = img.naturalWidth; H = img.naturalHeight; } catch (e) { img = null; } }
    const colors = ['#111111', '#ffffff', '#ff5d73', '#ff9f43', '#ffd166', '#3ee8c8', '#2bb3ff', '#7c6cff', '#e96bd8', '#8b5e3c'];
    const el = document.createElement('div'); el.className = 'drawwrap';
    el.innerHTML = '<div class="dtools"><div class="panel"><div class="ph"><span>Warna</span></div><div class="swatches">' +
      colors.map((c, i) => '<button class="sw-c ' + (i === 0 ? 'on' : '') + '" data-c="' + c + '" style="background:' + c + '"></button>').join('') +
      '</div><input type="color" id="dcol" value="#111111" style="margin-top:8px"></div>' +
      '<div class="panel"><div class="ph"><span>Alat</span></div><div class="tool-row"><button class="icon-btn on" id="tpen">' + I.brush + '</button><button class="icon-btn" id="ters">' + I.eraser + '</button></div>' +
      '<div class="small" style="margin:10px 0 0">Ukuran <b id="dsv">10</b></div><input type="range" id="dsz" min="2" max="80" value="10">' +
      '<div class="tool-row" style="margin-top:6px"><button class="icon-btn" id="dund">' + I.undo + '</button><button class="icon-btn danger" id="dclr">' + I.trash + '</button></div></div></div>' +
      '<div class="board"><canvas id="dc" width="' + W + '" height="' + H + '"></canvas></div>' +
      '<div class="dside"><button class="btn primary block" id="dok">' + I.check + '<span>Simpan</span></button><button class="btn block" id="dno">' + I.x + '<span>Batal</span></button></div>';
    document.body.appendChild(el);
    const dc = $('#dc', el), ctx = dc.getContext('2d', { willReadFrequently: true }), board = $('.board', el);
    if (img) ctx.drawImage(img, 0, 0);
    const fit = () => { const r = board.getBoundingClientRect(), k = Math.min((r.width - 16) / W, (r.height - 16) / H); dc.style.width = Math.max(40, W * k) + 'px'; dc.style.height = Math.max(40, H * k) + 'px'; };
    fit(); const ro = new ResizeObserver(fit); ro.observe(board);
    let color = '#111111', size = 10, erase = false, last = null; const undo = [];
    const snap = () => { undo.push(ctx.getImageData(0, 0, W, H)); if (undo.length > 15) undo.shift(); };
    const pt = e => { const r = dc.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; };
    const setStroke = () => { ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over'; ctx.strokeStyle = ctx.fillStyle = color; ctx.lineWidth = size; ctx.lineCap = ctx.lineJoin = 'round'; };
    dc.onpointerdown = e => { dc.setPointerCapture(e.pointerId); snap(); last = pt(e); setStroke(); ctx.beginPath(); ctx.arc(last.x, last.y, size / 2, 0, 7); ctx.fill(); };
    dc.onpointermove = e => { if (!last) return; const p = pt(e); setStroke(); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p; };
    dc.onpointerup = dc.onpointercancel = () => { last = null; };
    $$('.sw-c', el).forEach(b => b.onclick = () => { color = b.dataset.c; $('#dcol', el).value = color; erase = false; sync(); $$('.sw-c', el).forEach(x => x.classList.toggle('on', x === b)); });
    $('#dcol', el).oninput = e => { color = e.target.value; erase = false; sync(); $$('.sw-c', el).forEach(x => x.classList.remove('on')); };
    $('#dsz', el).oninput = e => { size = +e.target.value; $('#dsv', el).textContent = size; };
    const sync = () => { $('#tpen', el).classList.toggle('on', !erase); $('#ters', el).classList.toggle('on', erase); };
    $('#tpen', el).onclick = () => { erase = false; sync(); };
    $('#ters', el).onclick = () => { erase = true; sync(); };
    $('#dund', el).onclick = () => { const s = undo.pop(); if (s) { ctx.globalCompositeOperation = 'source-over'; ctx.putImageData(s, 0, 0); } };
    $('#dclr', el).onclick = () => { snap(); ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, W, H); };
    const done = v => { ro.disconnect(); el.remove(); res(v); };
    $('#dok', el).onclick = () => done(dc.toDataURL('image/png'));
    $('#dno', el).onclick = () => done(null);
    el.addEventListener('dismiss', () => done(null));
  });
}

/* ---------- event global ---------- */
function onInput(e) {
  const t = e.target, f = t.dataset && t.dataset.f; if (!f || !S.project) return;
  const an = curAnim(), sp = curSprite(), tx = curText(), setNm = (id, v) => $$('[data-nm="' + id + '"]').forEach(x => x.textContent = v);
  switch (f) {
    case 'a-fps': an.fps = +t.value; $('#v-fps').textContent = an.fps + ' fps'; S.animStart = performance.now(); break;
    case 's-scale': sp.scale = +t.value; $('#v-scale').textContent = sp.scale.toFixed(1) + 'x'; break;
    case 'a-name': an.name = t.value.slice(0, 24); setNm(an.id, an.name || '...'); break;
    case 's-name': sp.name = t.value.slice(0, 24); setNm(sp.id, sp.name || '...'); break;
    case 't-text': tx.text = t.value; break;
    case 'snd-name': { const x = S.project.sounds.find(q => q.id === t.dataset.id); if (x) x.name = t.value.replace(/[^\w]/g, '').slice(0, 20); break; }
    case 't-name': tx.name = t.value.replace(/[^\w]/g, '').slice(0, 20); break;
    case 't-size': tx.size = +t.value; $('#v-tsize').textContent = tx.size; break;
    case 't-color': tx.color = t.value; break;
    case 'code': { const fl = curFile(); if (fl) fl.code = t.value; dirty(700); checkCd(); return; }
    case 'file-name': { const fl = curFile(); if (fl) { fl.name = t.value; setNm(fl.id, fl.name || '...'); } break; }
  }
  dirty();
}
function onClick(e) {
  const ins = e.target.closest('[data-ins]'); if (ins) { insertAtCursor(ins.dataset.ins); return; }
  const b = e.target.closest('[data-act]'); if (!b) return;
  const fn = ACTS[b.dataset.act]; if (fn) { try { const r = fn(b, e); if (r && r.catch) r.catch(err => { console.error(err); toast('Error: ' + err.message, 3500); }); } catch (err) { console.error(err); toast('Error: ' + err.message, 3500); } }
}
window.onAndroidBack = function () {
  if (Play.active) { Play.stop(); return true; }
  if (Tutorial.active) { Tutorial.close(); return true; }
  const dw = $('.drawwrap'); if (dw) { dw.dispatchEvent(new Event('dismiss')); return true; }
  const mods = $$('#modal-root .modal-back'); if (mods.length) { mods[mods.length - 1].dispatchEvent(new Event('dismiss')); return true; }
  if (S.view === 'code') { renderEditor(); return true; }
  if (S.view === 'editor') { showHome(); return true; }
  return false;
};

const App = {
  async boot() {
    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('contextmenu', e => { if (!/INPUT|TEXTAREA/.test(e.target.tagName)) e.preventDefault(); });
    document.addEventListener('pointerdown', e => { if (e.target.closest('.keys button')) e.preventDefault(); });
    document.addEventListener('keydown', e => { if (e.target.id === 'code' && e.key === 'Tab') { e.preventDefault(); insertAtCursor('Tab'); } });
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
    window.addEventListener('pagehide', flush);
    $('#file-in').addEventListener('change', e => { const fs = [...e.target.files]; e.target.value = ''; if (fs.length) importFiles(fs); });
    $('#code-in').addEventListener('change', async e => {
      const fs = [...e.target.files]; e.target.value = ''; if (!S.project) return;
      let n = 0;
      for (const f of fs) {
        if (!/\.(cd|js|css)$/i.test(f.name)) { toast(f.name + ' dilewati (harus .cd/.js/.css)', 3500); continue; }
        const code = await f.text(); const ex = S.project.scripts.find(x => x.name === f.name);
        if (ex) ex.code = code; else { const nf = { id: uid(), name: f.name, code }; S.project.scripts.push(nf); S.fileId = nf.id; }
        n++;
      }
      if (n) { dirty(); renderCode(); toast(n + ' file diimpor'); }
    });
    $('#audio-in').addEventListener('change', async e => {
      const fs = [...e.target.files]; e.target.value = ''; if (!S.project) return;
      for (const f of fs) {
        if (f.size > 1.5 * 1024 * 1024) { toast(f.name + ' kebesaran (maks 1,5 MB)', 3500); continue; }
        const src = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
        let nm = f.name.replace(/\.[^.]+$/, '').replace(/[^\w]/g, '').slice(0, 20) || 'suara'; const base = nm; let n = 2;
        while (S.project.sounds.some(q => q.name === nm)) nm = base + n++;
        S.project.sounds.push({ id: uid(), name: nm, src });
      }
      dirty(); renderEditor(); toast('Suara ditambahkan');
    });
    try {
      const all = await DB.all();
      if (!all.some(p => p.id === 'example') && !seededFlag()) { await DB.put(await seedExample()); seededFlag(true); }
    } catch (e) { console.error(e); toast('Penyimpanan error: ' + e.message, 4000); }
    showHome();
  },
  showHome
};
