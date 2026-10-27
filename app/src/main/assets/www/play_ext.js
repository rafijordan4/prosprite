'use strict';
/* =====================================================================
   play_ext.js (v4): pengaturan game, objek editor, latar, siklus hari, cuaca, senter,
   debug, konsol, jeda, layar menang/kalah, tween, pencapaian, minimap, dll.
   Dipasang ke mode Coba lewat PlayExt.init(...) dari play.js
   ===================================================================== */

/* ---------- pustaka aset bawaan ---------- */
const Packs = {
  data: { sprites: [], bg: [], music: [], sfx: [] },
  ready: null,
  load() {
    if (!this.ready) this.ready = fetch('packs/packs.json').then(r => r.json()).then(d => { this.data = d; }).catch(() => { });
    return this.ready;
  },
  url(src) {
    if (typeof src !== 'string') return src;
    if (src.startsWith('pack:')) {
      const n = src.slice(5);
      if (this.data.music.some(m => m.name === n)) return 'packs/music/' + n + '.wav';
      return 'packs/sfx/' + n + '.wav';
    }
    return src;
  },
  has(name) { return this.data.music.some(m => m.name === name) || this.data.sfx.includes(name); },
  bgUrl(name) { return this.data.bg.some(b => b.name === name) ? 'packs/bg/' + name + '.jpg' : null; }
};
Packs.load();

const DEFAULT_SETTINGS = {
  gravity: 9.8, walk: 5, jump: 12, doubleJump: false, lives: 3, showLives: false, showScore: false,
  bg: '', zoom: 1, startX: 80, startY: 340, debug: false, console: false, stick: 132, jumpBtn: 92, ctlOpacity: 1, leftHand: false,
  pauseBtn: true, music: '', musicVol: 0.8, hari: false, hariJam: true, cuaca: ''
};
const getSettings = p => Object.assign({}, DEFAULT_SETTINGS, p.settings || {});

const PlayExt = (() => {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const EASE = {
    linear: t => t, masuk: t => t * t, keluar: t => 1 - (1 - t) * (1 - t), halus: t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    mantul: t => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + .75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + .9375; return n * (t -= 2.625 / d) * t + .984375; },
    elastis: t => t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (2 * Math.PI) / 3) + 1
  };
  const PHASE = {
    nama: ['Subuh', 'Pagi', 'Siang', 'Sore', 'Malam'], ikon: ['\u{1F304}', '\u{1F324}', '☀', '\u{1F307}', '\u{1F319}'],
    jam0: [4, 6, 11, 15, 18], jam1: [6, 11, 15, 18, 28],
    top: [[70, 60, 110], [70, 150, 230], [40, 120, 220], [230, 120, 70], [8, 10, 35]],
    bot: [[250, 170, 140], [190, 225, 250], [140, 200, 245], [250, 190, 110], [25, 30, 70]],
    tint: [[59, 58, 122, .30], [0, 0, 0, 0], [0, 0, 0, 0], [255, 138, 60, .16], [10, 16, 48, .52]]
  };
  const mixc = (a, b, p) => a.map((v, i) => Math.round(v + (b[i] - v) * p));

  function frameIdx(an, t, n) {
    if (n <= 1) return 0;
    const f = Math.floor(Math.max(0, t) * an.fps), m = an.mode;
    if (m === 'sekali') return Math.min(f, n - 1);
    if (m === 'pingpong') { const p = f % (2 * n - 2); return p < n ? p : 2 * n - 2 - p; }
    return f % n;
  }

  function init(a, E, Pro, P, project, opts, hooks) {
    const st = getSettings(project);
    a.settings = st;
    Object.assign(a, {
      logs: [], paused: false, debug: !!st.debug, tint: null, dark: null, floaters: [], tweens: [], portals: [], weather: null,
      hari: null, checkpoint: null, minimap: null, fps: 60, fpsAcc: 0, fpsN: 0, bgImg: null, bgName: '', achShown: [], console: null
    });
    E.project = project; E.hooks = hooks;

    /* ---- platform & objek dari editor ---- */
    if (Array.isArray(project.platforms) && project.platforms.length) Pro.platforms = project.platforms.map(p => Object.assign({}, p));
    const sx = clamp(+st.startX || 80, 0, 1800), sy = clamp(+st.startY || 340, -100, 340);
    a.start = { x: sx, y: sy }; P.x = sx; P.y = sy;
    const sc = a.scenes.get('utama'); sc.platforms = Pro.platforms; sc.start = a.start;
    const spawn = () => {
      for (const o of (project.objects || [])) {
        try {
          const kind = o.kind === 'musuh' || o.kind === 'item' ? o.kind : 'benda';
          const extra = kind === 'musuh' ? { patrol: { x0: o.x, range: o.range || 120, speed: o.speed || 60, dir: 1 } } : (o.physics ? { physics: true } : {});
          E.entAdd(kind, o.id || (kind + Math.random().toString(36).slice(2, 5)), o.anim, o.x, o.y, extra);
          if (o.portal) E.portalAdd(o.id, o.x, o.y, o.portal.scene, o.portal.x, o.portal.y);
        } catch (err) { E.log('Objek "' + (o.id || o.anim) + '": ' + err.message, 'err'); }
      }
    };

    /* ---- pengaturan fisika dll ---- */
    E.setGravity(clamp(+st.gravity || 9.8, 0.5, 40)); E.setWalk(clamp(+st.walk || 5, 0, 30)); E.setJump(clamp(+st.jump || 12, 1, 40));
    if (st.doubleJump) { a.maxJumps = 2; a.jumpsLeft = 1; }
    a.lives = a.livesMax = Math.max(1, Math.round(st.lives || 3)); a.hudLives = !!st.showLives; a.hudScore = !!st.showScore;
    a.zoom = clamp(+st.zoom || 1, 0.6, 1.6);
    E.refreshHud();

    /* ---- kontrol ---- */
    const css = ['.pj-stick{width:' + st.stick + 'px!important;height:' + st.stick + 'px!important;opacity:' + st.ctlOpacity + '}', '.pj-jump{width:' + st.jumpBtn + 'px!important;height:' + st.jumpBtn + 'px!important;opacity:' + st.ctlOpacity + '}'];
    if (st.leftHand) css.push('.pj-stick{left:auto!important;right:max(30px,env(safe-area-inset-right))!important}', '.pj-jump{right:auto!important;left:max(34px,env(safe-area-inset-left))!important}');
    const sty = document.createElement('style'); sty.dataset.pro = '1'; sty.textContent = css.join('\n'); document.head.appendChild(sty); a.styles.push(sty);

    /* ---- latar ---- */
    E.setBg = name => {
      if (!name) { a.bgImg = null; a.bgName = ''; return true; }
      const u = Packs.bgUrl(name); if (!u) throw new Error('Latar "' + name + '" tidak ada. Pilihan: ' + Packs.data.bg.map(b => b.name).join(', '));
      const im = new Image(); im.src = u; a.bgImg = im; a.bgName = name; return true;
    };
    if (st.bg) { try { E.setBg(st.bg); } catch (e) { E.log(e.message, 'err'); } }

    /* ---- log & konsol ---- */
    E.log = (msg, kind) => {
      a.logs.push({ msg: String(msg), kind: kind || 'log', t: a.clock || 0 }); if (a.logs.length > 60) a.logs.shift();
      if (a.console) renderConsole(a);
    };
    Cmode.print = s => { E.log(s, 'log'); if (a.debug && !a.console) toast(String(s).slice(0, 80), 1200); };
    a.restoreCmPrint = () => { Cmode.print = s => { if (window.console) console.log('[cmode]', s); }; };
    E.consoleToggle = on => {
      on = on === undefined ? !a.console : !!on;
      if (on && !a.console) { const el = document.createElement('div'); el.className = 'cm-console'; a.root.appendChild(el); a.console = el; renderConsole(a); }
      else if (!on && a.console) { a.console.remove(); a.console = null; }
    };
    E.debugToggle = on => { a.debug = on === undefined ? !a.debug : !!on; };
    if (st.console) E.consoleToggle(true);

    /* ---- jeda & menu ---- */
    E.pause = on => { a.paused = on === undefined ? !a.paused : !!on; };
    const menu = () => {
      if (a.menuEl) return;
      E.pause(true);
      const m = document.createElement('div'); m.className = 'pro-menu';
      m.innerHTML = '<div class="pm-card"><h3>Jeda</h3><button data-m="lanjut" class="btn primary">Lanjutkan</button><button data-m="ulang" class="btn">Ulangi dari awal</button>' +
        '<button data-m="debug" class="btn">Debug: ' + (a.debug ? 'ON' : 'OFF') + '</button><button data-m="konsol" class="btn">Konsol: ' + (a.console ? 'ON' : 'OFF') + '</button>' +
        '<button data-m="foto" class="btn">Foto layar</button><button data-m="keluar" class="btn danger">Keluar</button></div>';
      a.root.appendChild(m); a.menuEl = m;
      m.addEventListener('click', ev => {
        const b = ev.target.closest('[data-m]'); if (!b) return; const k = b.dataset.m;
        if (k === 'debug') { E.debugToggle(); b.textContent = 'Debug: ' + (a.debug ? 'ON' : 'OFF'); return; }
        if (k === 'konsol') { E.consoleToggle(); b.textContent = 'Konsol: ' + (a.console ? 'ON' : 'OFF'); return; }
        if (k === 'foto') { E.screenshot(); return; }
        m.remove(); a.menuEl = null;
        if (k === 'lanjut') E.pause(false); else if (k === 'ulang') hooks.restart(); else if (k === 'keluar') hooks.stop();
      });
    };
    if (st.pauseBtn) {
      const pb = document.createElement('button'); pb.className = 'pro-pause'; pb.innerHTML = '<span>⏸</span>'; a.root.appendChild(pb);
      pb.addEventListener('click', menu); pb.addEventListener('pointerdown', e => e.stopPropagation());
    }
    E.menu = menu;

    /* ---- layar menang / kalah ---- */
    E.gameEnd = (kind, title, msg) => {
      if (a.endEl) return; E.pause(true);
      Synth.play(kind === 'menang' ? 'menang' : 'kalah', 1);
      const m = document.createElement('div'); m.className = 'pro-menu end ' + kind;
      m.innerHTML = '<div class="pm-card"><div class="pm-big">' + (kind === 'menang' ? '\u{1F3C6}' : '\u{1F480}') + '</div><h3></h3><p class="small"></p><div class="pm-score">Skor ' + a.score + '</div><button data-m="ulang" class="btn primary">Main lagi</button><button data-m="keluar" class="btn">Keluar</button></div>';
      m.querySelector('h3').textContent = title || (kind === 'menang' ? 'Menang!' : 'Game over'); m.querySelector('p').textContent = msg || '';
      a.root.appendChild(m); a.endEl = m;
      m.addEventListener('click', ev => { const b = ev.target.closest('[data-m]'); if (!b) return; m.remove(); a.endEl = null; if (b.dataset.m === 'ulang') hooks.restart(); else hooks.stop(); });
    };

    /* ---- foto layar ---- */
    E.screenshot = () => {
      try {
        a.cv.toBlob(b => {
          if (!b) return toast('Gagal foto layar');
          const fr = new FileReader(); fr.onload = () => {
            const name = 'prosprite_' + Date.now() + '.png';
            if (window.Native && Native.saveFile) { Native.saveFile(name, String(fr.result).split(',')[1], 'image/png'); }
            else { const l = document.createElement('a'); l.href = fr.result; l.download = name; l.click(); }
          }; fr.readAsDataURL(b);
        }, 'image/png');
      } catch (e) { toast('Gagal foto layar: ' + e.message); }
    };

    /* ---- checkpoint ---- */
    const resetBase = E.resetPlayer;
    E.resetPlayer = () => { if (a.checkpoint && a.checkpoint.scene === a.sceneName) E.teleport(a.checkpoint.x, a.checkpoint.y); else resetBase(); };
    E.setCheckpoint = (x, y) => { a.checkpoint = { x, y, scene: a.sceneName }; };

    /* ---- pintu / portal ---- */
    E.portalAdd = (id, x, y, scene, tx, ty) => { a.portals = a.portals.filter(p => p.id !== id); a.portals.push({ id, x, y, scene: scene || '', tx: tx == null ? null : tx, ty: ty == null ? null : ty, cd: 0, scn: a.sceneName }); };
    E.portalRemove = id => { a.portals = a.portals.filter(p => p.id !== id); };

    /* ---- tween ---- */
    E.tweenAdd = (name, from, to, ms, easing, onUpd, onDone) => {
      a.tweens = a.tweens.filter(t => t.name !== name);
      if (!EASE[easing || 'linear']) throw new Error('Easing "' + easing + '" tidak dikenal. Pilihan: ' + Object.keys(EASE).join(', '));
      a.tweens.push({ name, from, to, dur: Math.max(10, ms) / 1000, t: 0, ease: EASE[easing || 'linear'], onUpd, onDone });
    };
    E.tweenStop = name => { a.tweens = a.tweens.filter(t => t.name !== name); };
    E.easings = () => Object.keys(EASE);

    /* ---- teks melayang ---- */
    E.floatText = (text, x, y, color, size) => { a.floaters.push({ text: String(text), x, y, color: color || '#fff', size: size || 20, life: 1.1, max: 1.1 }); if (a.floaters.length > 40) a.floaters.shift(); };

    /* ---- cuaca ---- */
    E.setWeather = (type, color) => {
      a.weather = null; E.setRain(false);
      if (!type || type === 'cerah') return true;
      if (type === 'hujan') { E.setRain(true, color); return true; }
      if (type === 'badai') { E.setRain(true, color); a.weather = { type: 'badai', next: 3 }; return true; }
      if (type === 'salju') { a.weather = { type: 'salju', drops: Array.from({ length: 110 }, () => ({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random(), p: Math.random() * 6 })) }; return true; }
      if (type === 'kabut') { a.weather = { type: 'kabut', color: color || '255,255,255' }; return true; }
      if (type === 'debu') { a.weather = { type: 'debu', drops: Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random(), s: 0.4 + Math.random(), p: Math.random() * 6 })) }; return true; }
      throw new Error('Cuaca "' + type + '" tidak dikenal. Pilihan: cerah, hujan, badai, salju, kabut, debu');
    };

    /* ---- senter (gelap + lingkaran cahaya) ---- */
    E.setDark = (alpha, radius) => { a.dark = alpha > 0 ? { alpha: clamp(alpha, 0, 1), radius: radius || 150 } : null; };

    /* ---- minimap ---- */
    E.minimapShow = on => {
      if (!on) { if (a.minimap) { a.minimap.el.remove(); a.minimap = null; } return; }
      if (a.minimap) return;
      const el = document.createElement('canvas'); el.className = 'cm-minimap'; el.width = 180; el.height = 40; a.layer.appendChild(el); a.minimap = { el, ctx: el.getContext('2d') };
    };

    /* ---- pencapaian ---- */
    E.achUnlock = (id, title) => {
      if (E.saveHas('__ach_' + id)) return false;
      E.saveSet('__ach_' + id, title || id);
      const el = document.createElement('div'); el.className = 'cm-ach'; el.innerHTML = '<span>\u{1F3C5}</span><div><b>Pencapaian!</b><div></div></div>'; el.querySelector('div div').textContent = title || id;
      a.layer.appendChild(el); Synth.play('level', 1); setTimeout(() => el.classList.add('out'), 2600); setTimeout(() => el.remove(), 3100);
      return true;
    };
    E.achList = () => Object.keys(localStorage).filter(k => k.startsWith('ps_save:' + a.gameId + ':__ach_')).map(k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return ''; } });

    /* ---- papan skor ---- */
    E.boardAdd = (nama, skor) => { const l = E.saveGet('__papan', []); l.push({ nama: String(nama).slice(0, 14), skor }); l.sort((x, y) => y.skor - x.skor); E.saveSet('__papan', l.slice(0, 10)); return l.findIndex(x => x.nama === String(nama).slice(0, 14) && x.skor === skor) + 1; };
    E.boardList = () => E.saveGet('__papan', []).map(x => x.nama + ': ' + x.skor);
    E.boardClear = () => E.saveDel('__papan');

    /* ---- siklus hari ---- */
    E.hariStart = (opt) => {
      a.hari = { dur: [50, 60, 60, 60, 90], fase: 1, t: 0, clock: true, lastPhase: -1, speed: 1, paused: false };
      if (opt) Object.assign(a.hari, opt);
      return true;
    };
    E.hariJam = () => {
      const h = a.hari; if (!h) return 0; const p = h.t / h.dur[h.fase];
      return (PHASE.jam0[h.fase] + (PHASE.jam1[h.fase] - PHASE.jam0[h.fase]) * p) % 24;
    };
    E.hariSetJam = j => {
      const h = a.hari; if (!h) return; j = ((j % 24) + 24) % 24; if (j < 4) j += 24;
      for (let i = 0; i < 5; i++) if (j >= PHASE.jam0[i] && j < PHASE.jam1[i]) { h.fase = i; h.t = (j - PHASE.jam0[i]) / (PHASE.jam1[i] - PHASE.jam0[i]) * h.dur[i]; return; }
    };
    const pad2 = n => (n < 10 ? '0' : '') + n;

    spawn();
    if (st.hari) E.hariStart({ clock: st.hariJam !== false });
    if (st.cuaca) { try { E.setWeather(st.cuaca); } catch (e) { E.log(e.message, 'err'); } }
    a.scenes.get('utama').entities = a.entities;
    if (st.music) { try { E.music(st.music, true, st.musicVol); } catch (e) { E.log(e.message, 'err'); } }
  }

  /* dipanggil tiap frame dari step() */
  function step(a, dt) {
    const E = a.E, P = a.P;
    // fps
    a.fpsAcc += dt; a.fpsN++; if (a.fpsAcc >= 0.5) { a.fps = Math.round(a.fpsN / a.fpsAcc); a.fpsAcc = 0; a.fpsN = 0; }
    // tween
    if (a.tweens.length) {
      for (const tw of a.tweens.slice()) {
        tw.t += dt; const k = Math.min(1, tw.t / tw.dur), v = tw.from + (tw.to - tw.from) * tw.ease(k);
        try { if (tw.onUpd) tw.onUpd(v); if (k >= 1) { a.tweens = a.tweens.filter(x => x !== tw); if (tw.onDone) tw.onDone(tw.name); } }
        catch (err) { a.tweens = a.tweens.filter(x => x !== tw); E.log(err && err.message || err, 'err'); }
      }
    }
    // teks melayang
    for (const f of a.floaters) { f.life -= dt; f.y -= 40 * dt; }
    if (a.floaters.length) a.floaters = a.floaters.filter(f => f.life > 0);
    // portal
    if (a.portals.length) {
      const ph = Math.max(20, a.dh * 0.85), pw = a.hw * 2;
      for (const pt of a.portals) {
        if (pt.scn !== a.sceneName || a.clock < pt.cd) continue;
        const e = a.entities.find(q => q.id === pt.id); const w = e ? e.dw * 0.5 : 40, h = e ? e.dh * 0.8 : 60;
        if (Math.abs(P.x - pt.x) < (pw + w) / 2 && P.y > pt.y - h && P.y - ph < pt.y) {
          pt.cd = a.clock + 1.2;
          if (!E.dispatch('masuk_pintu', [pt.id])) {
            E.sfx('buka', 0.8); E.flash('#ffffff', 300);
            if (pt.scene && pt.scene !== a.sceneName) E.sceneGo(pt.scene);
            if (pt.tx != null) E.teleport(pt.tx, pt.ty == null ? P.y : pt.ty);
          }
          break;
        }
      }
    }
    // cuaca badai
    if (a.weather && a.weather.type === 'badai') { a.weather.next -= dt; if (a.weather.next <= 0) { a.weather.next = 4 + Math.random() * 6; E.flash('#ffffff', 220); setTimeout(() => { try { Synth.play('ledak', 0.4); } catch (e) { /* abaikan */ } }, 400); } }
    // siklus hari
    const h = a.hari;
    if (h && !h.paused) {
      h.t += dt * (h.speed || 1);
      while (h.t >= h.dur[h.fase]) { h.t -= h.dur[h.fase]; h.fase = (h.fase + 1) % 5; }
    }
    if (h) {
      if (h.lastPhase !== h.fase) { if (h.lastPhase !== -1) E.dispatch('ganti_fase', [PHASE.nama[h.fase]]); h.lastPhase = h.fase; }
      const sisa = h.dur[h.fase] - h.t, p = sisa < 10 ? (10 - sisa) / 10 : 0, nx = (h.fase + 1) % 5;
      const top = mixc(PHASE.top[h.fase], PHASE.top[nx], p), bot = mixc(PHASE.bot[h.fase], PHASE.bot[nx], p);
      a.sky = ['rgb(' + top + ')', 'rgb(' + bot + ')'];
      const tn = mixc(PHASE.tint[h.fase].map(v => v * 100), PHASE.tint[nx].map(v => v * 100), p).map(v => v / 100);
      a.tint = tn[3] > 0.01 ? 'rgba(' + Math.round(tn[0]) + ',' + Math.round(tn[1]) + ',' + Math.round(tn[2]) + ',' + tn[3].toFixed(3) + ')' : null;
      if (h.clock) {
        const j = E.hariJam(), jj = Math.floor(j), mm = Math.floor((j - jj) * 60);
        E.hudText('__jam', PHASE.ikon[h.fase] + ' ' + (jj < 10 ? '0' : '') + jj + ':' + (mm < 10 ? '0' : '') + mm + '  ' + PHASE.nama[h.fase], 50, 7, 21, '#ffffff').classList.add('cm-clock');
      } else E.hudRemove('__jam');
    }
    // minimap
    if (a.minimap) {
      const m = a.minimap, c = m.ctx, W = 180, Hh = 40, k = W / World.W;
      c.clearRect(0, 0, W, Hh); c.fillStyle = 'rgba(8,12,28,.6)'; c.fillRect(0, 0, W, Hh);
      c.fillStyle = '#3ee8c8'; for (const pl of a.Pro.platforms) c.fillRect(pl.x * k, pl.y * Hh / World.H, Math.max(2, pl.w * k), pl.h >= 40 ? 3 : 2);
      for (const e of a.entities) { c.fillStyle = e.kind === 'musuh' ? '#ff5d73' : e.kind === 'item' ? '#ffd166' : '#8c97b8'; c.fillRect(e.x * k - 1, (e.y - 8) * Hh / World.H, 3, 3); }
      c.fillStyle = '#fff'; c.fillRect(P.x * k - 2, (P.y - 14) * Hh / World.H, 4, 4);
      c.strokeStyle = 'rgba(255,255,255,.5)'; const vw = (a.w / a.scale) * k; c.strokeRect(a.cam * k, 0, vw, Hh - 1);
    }
  }

  /* gambar ruang dunia (di dalam transform kamera) */
  function drawWorld(a, ctx) {
    for (const f of a.floaters) {
      ctx.globalAlpha = clamp(f.life / f.max * 1.5, 0, 1); ctx.font = '800 ' + f.size + 'px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.strokeText(f.text, f.x, f.y); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    if (a.debug) {
      ctx.lineWidth = 1.2; const P = a.P;
      const ph = Math.max(20, a.dh * 0.85), pw = a.hw * 2 * a.hitScale;
      ctx.strokeStyle = '#3ee8c8'; ctx.strokeRect(P.x - pw / 2, P.y - ph, pw, ph);
      ctx.fillStyle = '#3ee8c8'; ctx.fillRect(P.x - 2, P.y - 2, 4, 4);
      for (const e of a.entities) { ctx.strokeStyle = e.kind === 'musuh' ? '#ff5d73' : e.kind === 'item' ? '#ffd166' : '#aab'; ctx.strokeRect(e.x - e.dw * 0.3, e.y - e.dh * 0.8, e.dw * 0.6, e.dh * 0.8); }
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; for (const pl of a.Pro.platforms) ctx.strokeRect(pl.x, pl.y, pl.w, Math.min(pl.h, 60));
    }
  }

  /* gambar ruang layar (setelah dunia) */
  function drawScreen(a, ctx, w, h) {
    const wt = a.weather;
    if (wt && wt.type === 'salju') {
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      for (const d of wt.drops) { d.y += 0.0035 * d.s; d.p += 0.02; if (d.y > 1.03) { d.y = -0.03; d.x = Math.random(); } ctx.beginPath(); ctx.arc((d.x + Math.sin(d.p) * 0.012) * w, d.y * h, 1.4 + d.s * 1.6, 0, 7); ctx.fill(); }
    } else if (wt && wt.type === 'debu') {
      ctx.fillStyle = 'rgba(230,200,150,.5)';
      for (const d of wt.drops) { d.x += 0.0015 * d.s; d.p += 0.02; if (d.x > 1.03) { d.x = -0.03; d.y = Math.random(); } ctx.fillRect(d.x * w, (d.y + Math.sin(d.p) * 0.01) * h, 2, 2); }
    } else if (wt && wt.type === 'kabut') {
      const g = ctx.createLinearGradient(0, h * 0.35, 0, h); g.addColorStop(0, 'rgba(' + wt.color + ',0)'); g.addColorStop(1, 'rgba(' + wt.color + ',.55)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    if (a.tint) { ctx.fillStyle = a.tint; ctx.fillRect(0, 0, w, h); }
    if (a.dark) {
      const px = (a.P.x - a.cam) * a.scale, py = (a.P.y - a.dh * 0.5) * a.scale + a.offY, r = a.dark.radius * a.scale;
      const g = ctx.createRadialGradient(px, py, r * 0.15, px, py, r);
      g.addColorStop(0, 'rgba(0,0,10,0)'); g.addColorStop(1, 'rgba(0,0,10,' + a.dark.alpha + ')');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    if (a.debug) {
      ctx.font = '600 11px ui-monospace,monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      const P = a.P, lines = ['FPS ' + a.fps, 'x ' + Math.round(P.x) + '  y ' + Math.round(P.y), 'vx ' + Math.round(P.vx) + '  vy ' + Math.round(P.vy) + (P.onGround ? '  tanah' : ''), 'scene ' + a.sceneName + '  objek ' + a.entities.length, 'waktu ' + a.clock.toFixed(1) + 's'];
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(10, 96, 168, lines.length * 15 + 8); ctx.fillStyle = '#7dffe9';
      lines.forEach((l, i) => ctx.fillText(l, 16, 100 + i * 15));
    }
  }

  function renderConsole(a) {
    const el = a.console; if (!el) return;
    el.innerHTML = a.logs.slice(-9).map(l => '<div class="' + l.kind + '">' + String(l.msg).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])) + '</div>').join('') || '<div class="dim">Konsol kosong. Pakai print("...") di kode Cmode.</div>';
    el.scrollTop = el.scrollHeight;
  }

  function cleanup(a) {
    if (a.restoreCmPrint) a.restoreCmPrint();
    if (a.console) a.console.remove();
  }

  return { init, step, drawWorld, drawScreen, cleanup, frameIdx, EASE, PHASE };
})();
