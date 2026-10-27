'use strict';
/* =====================================================================
   play.js: dunia platformer + mode Coba + Pro API (JS) + jembatan ke Cmode
   ===================================================================== */

const World = {
  W: 1800, H: 400, groundY: 340,
  platforms() {
    return [
      { x: 0, y: 340, w: 1800, h: 60 },
      { x: 260, y: 270, w: 150, h: 16 },
      { x: 480, y: 202, w: 150, h: 16 },
      { x: 720, y: 272, w: 190, h: 16 },
      { x: 980, y: 206, w: 150, h: 16 },
      { x: 1230, y: 140, w: 150, h: 16 },
      { x: 1450, y: 236, w: 200, h: 16 }
    ];
  },
  _bb: new Map(),
  stars: Array.from({ length: 70 }, (_, i) => ({ x: (i * 97.13) % 1000, y: (i * 53.7) % 250, r: 0.6 + (i % 4) * 0.35, a: 0.35 + (i % 5) * 0.12 })),

  /* Gambar langit, bukit, platform dan teks. ctx sudah diskala dpr; cw/ch = ukuran CSS kanvas. */
  draw(ctx, cw, ch, camX, scale, texts, selId, platforms, offY, sky, bgImg) {
    offY = offY || 0;
    const useBg = bgImg && bgImg.naturalWidth;
    if (useBg) {
      const bh = ch, bw = bgImg.naturalWidth * bh / bgImg.naturalHeight, by = 0;
      const sx = -((camX * scale * 0.3) % bw);
      for (let x = sx; x < cw; x += bw) ctx.drawImage(bgImg, Math.floor(x), by, Math.ceil(bw) + 1, bh);
    }
    const g = ctx.createLinearGradient(0, 0, 0, ch);
    if (sky) { g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]); }
    else { g.addColorStop(0, '#0d1330'); g.addColorStop(0.62, '#1a1d4a'); g.addColorStop(1, '#2b2262'); }
    if (!useBg) { ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch); }
    if (!useBg) {
    const mx = cw * 0.8 - camX * scale * 0.04, my = ch * 0.2, mr = ch * 0.07;
    const mg = ctx.createRadialGradient(mx, my, mr * 0.3, mx, my, mr * 3.2);
    mg.addColorStop(0, 'rgba(160,255,238,.35)'); mg.addColorStop(1, 'rgba(160,255,238,0)');
    ctx.fillStyle = mg; ctx.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
    ctx.fillStyle = '#d9fff8'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, 7); ctx.fill();
    const span = cw + 40;
    for (const s of this.stars) {
      const x = (((s.x * scale * 1.6 - camX * scale * 0.12) % span) + span) % span - 20;
      ctx.fillStyle = 'rgba(255,255,255,' + s.a + ')'; ctx.beginPath(); ctx.arc(x, s.y * scale, s.r * Math.max(1, scale * 1.2), 0, 7); ctx.fill();
    }
    const hills = (color, base, amp, freq, par) => {
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, ch);
      for (let x = 0; x <= cw + 12; x += 12) {
        const wx = x / scale + camX * par;
        ctx.lineTo(x, (base + Math.sin(wx * freq) * amp + Math.sin(wx * freq * 2.3 + 1) * amp * 0.4) * scale + offY);
      }
      ctx.lineTo(cw, ch); ctx.fill();
    };
    hills('#171a45', 290, 26, 0.004, 0.25);
    hills('#12183c', 315, 18, 0.007, 0.5);
    }

    ctx.save(); ctx.translate(-camX * scale, offY); ctx.scale(scale, scale);
    for (const pl of (platforms || this.defaultPlatforms)) {
      if (pl.h >= 40) {
        const gg = ctx.createLinearGradient(0, pl.y, 0, pl.y + pl.h);
        gg.addColorStop(0, '#22305e'); gg.addColorStop(1, '#0f1530');
        ctx.fillStyle = gg; ctx.fillRect(pl.x, pl.y, pl.w, pl.h + 400);
        ctx.fillStyle = '#3ee8c8'; ctx.globalAlpha = 0.9; ctx.fillRect(pl.x, pl.y, pl.w, 3); ctx.globalAlpha = 1;
      } else {
        ctx.shadowColor = 'rgba(62,232,200,.45)'; ctx.shadowBlur = 14;
        ctx.fillStyle = '#2a3d78'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(pl.x, pl.y, pl.w, pl.h, 7); else ctx.rect(pl.x, pl.y, pl.w, pl.h); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#3ee8c8'; ctx.fillRect(pl.x + 6, pl.y, pl.w - 12, 3);
      }
    }
    for (const t of (texts || [])) {
      if (t.visible === false) { this._bb.delete(t.id); continue; }
      ctx.font = '700 ' + t.size + 'px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const tw = ctx.measureText(t.text).width;
      const bb = { x: t.x - tw / 2 - 10, y: t.y - t.size * 0.7, w: tw + 20, h: t.size * 1.4 };
      this._bb.set(t.id, bb);
      ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 6; ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y); ctx.shadowBlur = 0;
      if (t.id === selId) { ctx.strokeStyle = '#3ee8c8'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]); ctx.strokeRect(bb.x, bb.y, bb.w, bb.h); ctx.setLineDash([]); }
    }
    ctx.restore();
  },
  hitText(texts, x, y) {
    for (let i = texts.length - 1; i >= 0; i--) {
      if (texts[i].visible === false) continue;
      const b = this._bb.get(texts[i].id);
      if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return texts[i];
    }
    return null;
  },
  /* anchor: tengah-bawah gambar = kaki karakter. Gambar asli menghadap kanan. */
  drawPlayer(ctx, img, x, y, unit, facing) {
    const dw = img.naturalWidth * unit, dh = img.naturalHeight * unit;
    ctx.save(); ctx.translate(x, 0); ctx.scale(facing < 0 ? -1 : 1, 1);
    ctx.drawImage(img, -dw / 2, y - dh, dw, dh);
    ctx.restore();
    return { dw, dh };
  }
};
World.defaultPlatforms = World.platforms();

/* ---------- suara bawaan (tanpa file) ---------- */
const Synth = (() => {
  let ac = null;
  const ctx = () => {
    if (!ac) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ac = new C(); }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  };
  function tone(f0, f1, dur, type, vol, delay) {
    const c = ctx(); if (!c) return;
    const t0 = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    g.gain.setValueAtTime(Math.max(0.0002, vol), t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.03);
  }
  function noise(dur, vol, cutoff) {
    const c = ctx(); if (!c) return;
    const len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf; f.type = 'lowpass'; f.frequency.value = cutoff || 1200; g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(c.destination); s.start();
  }
  const P = {
    lompat: v => tone(280, 620, 0.16, 'square', 0.12 * v),
    koin: v => { tone(988, 988, 0.08, 'square', 0.1 * v); tone(1318, 1318, 0.18, 'square', 0.1 * v, 0.08); },
    ledak: v => { noise(0.45, 0.35 * v, 900); tone(140, 40, 0.4, 'sawtooth', 0.15 * v); },
    klik: v => tone(520, 380, 0.05, 'square', 0.08 * v),
    luka: v => tone(220, 70, 0.28, 'sawtooth', 0.14 * v),
    menang: v => [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.16, 'triangle', 0.14 * v, i * 0.12)),
    kalah: v => [392, 330, 262, 196].forEach((f, i) => tone(f, f, 0.2, 'triangle', 0.14 * v, i * 0.15)),
    bip: v => tone(660, 660, 0.1, 'square', 0.1 * v)
  };
  return { names: Object.keys(P), play(name, v) { const fn = P[name]; if (!fn) return false; try { fn(v == null ? 1 : v); } catch (e) { /* abaikan */ } return true; } };
})();

/* ---------- mode Coba ---------- */
const Play = (() => {
  let A = null;
  const lc = s => String(s).trim().toLowerCase();
  const hit = (ax, ay, aw, ah, bx, by, bw, bh) => Math.abs(ax - bx) < (aw + bw) / 2 && ay > by - bh && ay - ah < by;

  function findNamed(project, name, prefer) {
    let sname = null, an = String(name).trim();
    if (an.includes('/')) { const p = an.split('/'); sname = p[0].trim(); an = p.slice(1).join('/').trim(); }
    const ok = q => lc(q.name) === lc(an) && q.frames.length;
    let c = project.sprites.filter(s => (!sname || lc(s.name) === lc(sname)) && s.anims.some(ok));
    if (!c.length) return null;
    const s = c.find(x => x !== prefer) || c[0];
    return { sprite: s, anim: s.anims.find(ok) };
  }

  async function start(project, opts) {
    opts = opts || {};
    if (A) return;
    const sp = playerSprite(project);
    if (!sp) return toast('Belum ada ProSprite. Buat satu dulu dan isi animasi Idle / Walk / Jump.', 3600);
    const an = { idle: findAnim(project, sp, RE.Idle), walk: findAnim(project, sp, RE.Walk), jump: findAnim(project, sp, RE.Jump) };
    if (!an.idle) an.idle = an.walk || an.jump;
    if (!an.idle) return toast('Belum ada animasi bernama Idle, Walk, atau Jump yang ada framenya.', 4000);
    if (S.project === project) await flush();
    await Packs.ready;

    const imgs = [];
    for (const s of project.sprites) for (const q of s.anims) for (const f of q.frames) imgs.push(getImg(f));
    await Promise.all(imgs.map(i => (i.decode ? i.decode().catch(() => { }) : Promise.resolve())));
    if (A) return;

    const root = document.createElement('div'); root.id = 'play';
    root.innerHTML = '<canvas id="pc"></canvas><div id="pro-ui"></div><button class="pro-exit">' + I.x + '<span>Keluar</span></button><div class="pro-tag">' + (opts.trusted === false ? 'Game komunitas' : 'Mode Coba') + '</div>';
    document.body.appendChild(root);
    const cv = root.querySelector('#pc'), ui = root.querySelector('#pro-ui');
    const layer = document.createElement('div'); layer.className = 'cm-layer'; ui.appendChild(layer);

    const a = A = {
      root, cv, ctx: cv.getContext('2d'), w: 0, h: 0, dpr: Math.min(2, window.devicePixelRatio || 1), raf: 0, last: performance.now(),
      cam: 0, camFollow: true, camManual: 0, zoom: 1, shakeUntil: 0, shakeAmp: 0, scale: 1, offY: 0,
      cur: null, animT: 0, force: null, listeners: [], styles: [], handlers: { start: [], update: [], click: [], stop: [] },
      sprite: sp, an, unit: spriteUnit(sp), hw: 8, hitScale: 1, dw: 0, dh: 0,
      effects: [], entities: [], particles: [], rain: null, timers: [], timerId: 1, timeScale: 1, clock: 0,
      hud: new Map(), buttons: new Map(), layer, dialog: { open: false, el: null, done: null },
      scenes: new Map(), sceneName: 'utama', lives: 3, livesMax: 3, score: 0, hudLives: false, hudScore: false,
      jumpH: 12, walkU: 5, gravU: 9.8, maxJumps: 1, jumpsLeft: 1, prevJump: false, autoX: 0,
      canWalk: true, canJump: true, collide: true, gravityOn: true, hidden: false, sky: null, invuln: 0,
      programs: [], lastErr: '', audio: { music: null, vol: 1, sfxVol: 1, els: [] }, lastClick: { x: 0, y: 0 },
      gameId: opts.gameId || project.id, trusted: opts.trusted !== false, start: { x: 80, y: World.groundY }
    };
    const idleImg = getImg(an.idle.frames[0]);
    a.hw = Math.max(8, idleImg.naturalWidth * a.unit * 0.28);

    const P = { x: 80, y: World.groundY, vx: 0, vy: 0, onGround: true, facing: 1, say: null };
    const Pro = {
      input: { x: 0, jump: false },
      speed: 220, jumpPower: 640, gravity: 1800,
      player: P, platforms: World.platforms(),
      texts: project.texts.map(t => Object.assign({}, t)),
      ui, world: { width: World.W, height: World.H },
      on(ev, fn) { if (a.handlers[ev] && typeof fn === 'function') a.handlers[ev].push(fn); },
      jump() { E.doJump(true); },
      say(text, ms) { P.say = { text: String(text), until: performance.now() + (ms || 1500) }; },
      toast(msg, ms) { toast(String(msg), ms); },
      listen(target, type, fn, opt) { target.addEventListener(type, fn, opt); a.listeners.push([target, type, fn, opt]); },
      effect(name, x, y, ms, o) { return E.effect(name, x, y, ms, o); },
      exit() { stop(); }
    };
    a.Pro = Pro; a.P = P;
    window.Pro = Pro;
    a.scenes.set('utama', { platforms: Pro.platforms, texts: Pro.texts, entities: a.entities, start: { x: 80, y: World.groundY } });
    const E = makeEnv(a, Pro, P, project);
    a.E = E;
    PlayExt.init(a, E, Pro, P, project, opts, { stop, restart: () => { const pr = project, o = opts; stop(); setTimeout(() => start(pr, o), 60); } });

    root.querySelector('.pro-exit').addEventListener('click', stop);
    cv.addEventListener('pointerdown', e => {
      const r = cv.getBoundingClientRect();
      const x = (e.clientX - r.left) / a.scale + a.cam, y = (e.clientY - r.top - a.offY) / a.scale;
      a.lastClick = { x, y };
      const t = World.hitText(Pro.texts, x, y);
      if (t) { fire('click', { type: 'text', target: t, x, y }); E.dispatch('klik_teks', [t.name || t.id]); }
      else if (!a.hidden && x >= P.x - a.dw / 2 && x <= P.x + a.dw / 2 && y >= P.y - a.dh && y <= P.y) { fire('click', { type: 'sprite', target: P, x, y }); E.dispatch('klik_karakter', []); }
      else fire('click', { type: 'dunia', target: null, x, y });
      E.dispatch('klik', [Math.round(x), Math.round(y)]);
    });

    // skrip: proyek sendiri = JS + CSS + Cmode; game orang lain = hanya Cmode + kontrol bawaan aplikasi
    const own = a.trusted;
    const scripts = own ? project.scripts : [{ name: 'kontrol.css', code: DEFAULT_CSS }, { name: 'kontrol.js', code: DEFAULT_JS }].concat(project.scripts.filter(f => /\.cd$/i.test(f.name)));
    for (const f of scripts) {
      if (/\.css$/i.test(f.name)) { const st = document.createElement('style'); st.dataset.pro = '1'; st.textContent = f.code; document.head.appendChild(st); a.styles.push(st); }
    }
    for (const f of scripts) {
      if (!/\.js$/i.test(f.name)) continue;
      try { new Function('Pro', f.code)(Pro); } catch (err) { console.error(err); toast('Error di ' + f.name + ': ' + err.message, 4500); }
    }
    // Cmode
    const host = { modules: CModules.build(E) };
    for (const f of scripts) {
      if (!/\.cd$/i.test(f.name)) continue;
      try { const rt = new Cmode.Runtime(Cmode.compile(f.code, f.name), host); a.programs.push(rt); rt.run(); }
      catch (err) { report(a, err); }
    }
    if (A !== a) return;
    E.dispatch('mulai', []);
    fire('start');
    fit(a);
    a.raf = requestAnimationFrame(tick);
  }

  function report(a, err, tag) {
    const msg = err && err.cm ? err.pretty() : String(err && err.message || err);
    console.error(err);
    if (a.E && a.E.log) a.E.log(msg, 'err');
    if (a.lastErr !== msg) { a.lastErr = msg; toast((tag ? tag + ': ' : '') + msg, 5200); }
  }

  function fire(ev, arg) {
    const a = A; if (!a) return;
    for (const fn of a.handlers[ev].slice()) {
      try { fn(arg); } catch (err) { report(a, err, 'Skrip JS (' + ev + ')'); a.handlers[ev] = a.handlers[ev].filter(x => x !== fn); }
      if (A !== a) return;
    }
  }

  /* ----- lingkungan untuk modul Cmode ----- */
  function makeEnv(a, Pro, P, project) {
    const E = { a, Pro, P, project };
    const num = (v, w) => { if (typeof v !== 'number' || Number.isNaN(v)) throw new Error((w || 'Nilai') + ' harus berupa angka'); return v; };
    const text = (v, w) => { if (typeof v !== 'string') throw new Error((w || 'Nilai') + ' harus berupa teks (pakai tanda kutip)'); return v; };
    E.num = num; E.text = text; E.lc = lc;

    E.dispatch = (name, args) => {
      let handled = false;
      for (const rt of a.programs) {
        if (!rt.has(name) || (rt.dead && rt.dead.has(name))) continue;
        handled = true;
        try { rt.call(name, args); } catch (err) { report(a, err); (rt.dead || (rt.dead = new Set())).add(name); }
        if (A !== a) return true;
      }
      return handled;
    };
    E.safe = fn => (...args) => { try { return fn(...args); } catch (err) { report(a, err); } };

    /* pemain */
    E.recalcPlayer = () => {
      a.an = { idle: findAnim(project, a.sprite, RE.Idle), walk: findAnim(project, a.sprite, RE.Walk), jump: findAnim(project, a.sprite, RE.Jump) };
      if (!a.an.idle) a.an.idle = a.an.walk || a.an.jump;
      a.unit = spriteUnit(a.sprite);
      const im = getImg(a.an.idle.frames[0]);
      a.hw = Math.max(8, im.naturalWidth * a.unit * 0.28);
    };
    E.setPlayer = name => {
      const s = project.sprites.find(x => lc(x.name) === lc(name));
      if (!s || !s.anims.some(q => q.frames.length)) return false;
      a.sprite = s; E.recalcPlayer(); return true;
    };
    E.setScale = n => { a.sprite = Object.assign({}, a.sprite, { scale: n }); E.recalcPlayer(); };
    E.teleport = (x, y) => { P.x = x; P.y = y; P.vx = 0; P.vy = 0; };
    E.resetPlayer = () => E.teleport(a.start.x, a.start.y);
    E.useAnim = (kind, name) => {
      const f = findNamed(project, name, null);
      if (!f) throw new Error('Animasi "' + name + '" tidak ditemukan. Buat animasinya dulu di editor (nama harus sama persis).');
      const own = a.sprite.anims.find(q => lc(q.name) === lc(name) && q.frames.length);
      a.an[kind] = own || f.anim;
      if (kind === 'idle' && !a.an.walk) a.an.walk = a.an.idle;
    };
    E.animName = kind => (a.an[kind] ? a.an[kind].name : '');
    E.forceAnim = (anim, ms) => { a.force = { anim, until: a.clock + ms / 1000 }; a.animT = 0; };

    /* gerak & fisika */
    E.setWalk = u => { a.walkU = u; Pro.speed = u * 44; };
    E.setJump = h => { a.jumpH = h; Pro.jumpPower = Math.sqrt(2 * Pro.gravity * h * 9.5); };
    E.setGravity = g => { a.gravU = g; Pro.gravity = g * 183.67; Pro.jumpPower = Math.sqrt(2 * Pro.gravity * a.jumpH * 9.5); };
    E.doJump = air => {
      if (!a.canJump || !a.gravityOn || a.dialog.open) return false;
      if (P.onGround) { P.vy = -Pro.jumpPower; P.onGround = false; a.jumpsLeft = a.maxJumps - 1; return true; }
      if (air && a.jumpsLeft > 0) { P.vy = -Pro.jumpPower; a.jumpsLeft--; return true; }
      return false;
    };

    /* entitas, efek */
    E.findNamed = name => findNamed(project, name, a.sprite);
    E.effect = (name, x, y, ms, o) => {
      o = o || {};
      const f = findNamed(project, name, a.sprite);
      if (!f) return null;
      for (const fr of f.anim.frames) getImg(fr);
      const h0 = getImg(f.anim.frames[0]).naturalHeight || 300;
      const unit = o.height ? o.height / h0 : spriteUnit(f.sprite);
      const t0 = performance.now();
      const fx = { anim: f.anim, x, y, unit, anchor: o.anchor || 'bottom', flip: o.flip ? -1 : 1, t0, until: t0 + (ms || 2000) };
      a.effects.push(fx);
      return { remove() { fx.until = 0; } };
    };
    E.entAdd = (kind, id, animName, x, y, extra) => {
      const f = findNamed(project, animName, a.sprite);
      if (!f) throw new Error('Animasi "' + animName + '" tidak ditemukan. Buat animasinya dulu di editor (nama harus sama persis).');
      for (const fr of f.anim.frames) getImg(fr);
      id = String(id);
      a.entities = a.entities.filter(e => e.id !== id);
      const e = Object.assign({ id, kind, anim: f.anim, sprite: f.sprite, unit: spriteUnit(f.sprite), x, y, vx: 0, vy: 0, physics: kind === 'musuh', facing: 1, flip: false, hidden: false, t0: a.clock, dw: 0, dh: 0, patrol: null, cool: 0 }, extra || {});
      a.entities.push(e);
      return e;
    };
    E.ent = id => a.entities.find(e => e.id === String(id)) || null;
    E.entRemove = id => { const n = a.entities.length; a.entities = a.entities.filter(e => e.id !== String(id)); return a.entities.length < n; };
    const sc = a.scenes.get('utama'); // simpan referensi, diperbarui saat pindah scene

    /* waktu */
    E.timerAdd = (ms, fn, args, repeat) => { const id = a.timerId++; a.timers.push({ id, at: a.clock + ms / 1000, every: repeat ? ms / 1000 : 0, fn, args: args || [] }); return id; };
    E.timerClear = id => { a.timers = a.timers.filter(t => t.id !== id); };

    /* HUD, tombol, dialog */
    const esc2 = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    E.hudText = (id, txt, x, y, size, color) => {
      let el = a.hud.get(id);
      if (!el) { el = document.createElement('div'); el.className = 'cm-hud'; a.layer.appendChild(el); a.hud.set(id, el); }
      el.innerHTML = ''; el.textContent = txt; el.style.left = x + '%'; el.style.top = y + '%'; el.style.fontSize = (size || 18) + 'px'; el.style.color = color || '#fff'; el.style.display = '';
      return el;
    };
    E.hudGet = id => a.hud.get(id) || null;
    E.hudRemove = id => { const el = a.hud.get(id); if (el) { el.remove(); a.hud.delete(id); } };
    E.hudBar = (id, val, max, x, y, w, color) => {
      let el = a.hud.get(id);
      if (!el || !el.classList.contains('cm-bar')) { if (el) el.remove(); el = document.createElement('div'); el.className = 'cm-bar'; el.innerHTML = '<i></i>'; a.layer.appendChild(el); a.hud.set(id, el); }
      el.style.left = x + '%'; el.style.top = y + '%'; el.style.width = w + '%';
      el.firstChild.style.width = Math.max(0, Math.min(100, val / (max || 1) * 100)) + '%';
      if (color) el.firstChild.style.background = color;
    };
    E.button = (id, label, x, y, fn) => {
      let el = a.buttons.get(id);
      if (!el) { el = document.createElement('button'); el.className = 'cm-btn'; a.layer.appendChild(el); a.buttons.set(id, el); }
      el.textContent = label; el.style.left = x + '%'; el.style.top = y + '%'; el.disabled = false;
      el.onclick = ev => { ev.stopPropagation(); if (fn) E.safe(fn)(id); };
      el.onpointerdown = ev => ev.stopPropagation();
    };
    E.buttonRemove = id => { const el = a.buttons.get(id); if (el) { el.remove(); a.buttons.delete(id); } };
    E.dialogClose = () => {
      const d = a.dialog; if (!d.open) return;
      if (d.el) d.el.remove();
      a.dialog = { open: false, el: null, done: null };
      if (d.done) E.safe(d.done)();
    };
    E.dialog = (txt, who, done, choices) => {
      if (a.dialog.open) { if (a.dialog.el) a.dialog.el.remove(); }
      const el = document.createElement('div'); el.className = 'cm-dialog';
      el.innerHTML = (who ? '<b>' + esc2(who) + '</b>' : '') + '<p>' + esc2(txt) + '</p>' + (choices ? '<div class="cm-choices"></div>' : '<small>ketuk untuk lanjut</small>');
      a.layer.appendChild(el);
      a.dialog = { open: true, el, done: choices ? null : done };
      if (choices) {
        const box = el.querySelector('.cm-choices');
        choices.forEach((c, i) => { const b = document.createElement('button'); b.textContent = String(c); b.onclick = ev => { ev.stopPropagation(); const cb = done; E.dialogClose(); if (cb) E.safe(cb)(i, c); }; box.appendChild(b); });
      } else el.onclick = ev => { ev.stopPropagation(); E.dialogClose(); };
      el.onpointerdown = ev => ev.stopPropagation();
    };

    /* suara */
    const sound = name => {
      const s = (project.sounds || []).find(q => lc(q.name) === lc(name));
      if (s) return { name: s.name, src: Packs.url(s.src) };
      if (Packs.has(lc(name))) return { name: lc(name), src: Packs.url('pack:' + lc(name)) };
      return null;
    };
    E.soundNames = () => (project.sounds || []).map(s => s.name).concat(Packs.data.music.map(m => m.name), Packs.data.sfx);
    E.sfx = (name, vol) => {
      vol = vol == null ? 1 : vol;
      const s = sound(name);
      if (s) { const el = new Audio(s.src); el.volume = Math.max(0, Math.min(1, vol * a.audio.sfxVol)); el.play().catch(() => { }); a.audio.els.push(el); if (a.audio.els.length > 24) a.audio.els.shift(); return true; }
      if (Synth.play(lc(name), vol * a.audio.sfxVol)) return true;
      throw new Error('Suara "' + name + '" tidak ada. Tambahkan di tab Suara, atau pakai yang bawaan: ' + Synth.names.join(', '));
    };
    E.music = (name, loop, vol) => {
      const s = sound(name);
      if (!s) throw new Error('Musik "' + name + '" belum ada. Tambahkan file suara di tab Suara' + (E.soundNames().length ? ' (yang ada: ' + E.soundNames().join(', ') + ')' : ''));
      E.musicStop();
      const el = new Audio(s.src); el.loop = loop !== false; el.volume = Math.max(0, Math.min(1, (vol == null ? 1 : vol) * a.audio.vol));
      el.play().catch(() => { }); a.audio.music = el;
    };
    E.musicStop = () => { if (a.audio.music) { a.audio.music.pause(); a.audio.music = null; } };

    /* simpan */
    const key = k => 'ps_save:' + a.gameId + ':' + k;
    const ser = v => JSON.stringify(v, (k, x) => x instanceof Map ? { $m: [...x] } : x);
    const deser = s => JSON.parse(s, (k, x) => x && x.$m ? new Map(x.$m) : x);
    E.saveSet = (k, v) => { try { localStorage.setItem(key(k), ser(v)); } catch (e) { throw new Error('Penyimpanan penuh atau diblokir'); } };
    E.saveGet = (k, d) => { try { const s = localStorage.getItem(key(k)); return s === null ? d : deser(s); } catch (e) { return d; } };
    E.saveHas = k => { try { return localStorage.getItem(key(k)) !== null; } catch (e) { return false; } };
    E.saveDel = k => { try { localStorage.removeItem(key(k)); } catch (e) { /* abaikan */ } };
    E.saveClear = () => { try { const p = 'ps_save:' + a.gameId + ':'; Object.keys(localStorage).filter(k => k.startsWith(p)).forEach(k => localStorage.removeItem(k)); } catch (e) { /* abaikan */ } };

    /* scene */
    const keepScene = () => { const s = a.scenes.get(a.sceneName); if (s) { s.platforms = Pro.platforms; s.texts = Pro.texts; s.entities = a.entities; } };
    E.sceneCreate = name => {
      if (a.scenes.has(name)) return false;
      a.scenes.set(name, { platforms: [{ x: 0, y: 340, w: 1800, h: 60 }], texts: [], entities: [], start: { x: 80, y: World.groundY } });
      return true;
    };
    E.sceneGo = name => {
      const s = a.scenes.get(name);
      if (!s) throw new Error('Scene "' + name + '" belum dibuat. Buat dulu dengan scene.buat("' + name + '")');
      keepScene();
      a.sceneName = name; Pro.platforms = s.platforms; Pro.texts = s.texts; a.entities = s.entities; a.start = s.start;
      E.teleport(s.start.x, s.start.y); a.effects = []; a.particles = [];
      E.dispatch('scene_mulai', [name]);
      return true;
    };
    E.sceneName = () => a.sceneName;
    E.sceneList = () => [...a.scenes.keys()];

    /* teks dunia */
    E.textFind = id => Pro.texts.find(t => (t.name || t.id) === String(id)) || null;
    E.textNeed = id => { const t = E.textFind(id); if (!t) throw new Error('Teks dengan ID "' + id + '" tidak ada. Isi "ID untuk kode" di tab Panggung, atau buat dengan teks.tambah'); return t; };

    /* layar & efek */
    const flashEl = (color, ms, fadeIn) => {
      const el = document.createElement('div'); el.className = 'cm-flash'; el.style.background = color; el.style.opacity = fadeIn ? 0 : 0.85;
      a.layer.appendChild(el); void el.offsetWidth;
      el.style.transition = 'opacity ' + ms + 'ms ease'; el.style.opacity = fadeIn ? 1 : 0;
      return el;
    };
    E.flash = (color, ms) => { const el = flashEl(color, ms, false); setTimeout(() => el.remove(), ms + 60); };
    E.fade = (toDark, ms) => { const el = flashEl('#000', ms, toDark); if (!toDark) setTimeout(() => el.remove(), ms + 60); else { el.dataset.keep = '1'; a.fadeEl = el; } };
    E.unfade = ms => { if (a.fadeEl) { const el = a.fadeEl; a.fadeEl = null; el.style.transition = 'opacity ' + ms + 'ms ease'; el.style.opacity = 0; setTimeout(() => el.remove(), ms + 60); } };
    E.shake = (ms, amp) => { a.shakeUntil = a.clock + ms / 1000; a.shakeAmp = amp; };
    E.burst = (x, y, n, color) => {
      for (let i = 0; i < Math.min(200, n); i++) { const ang = Math.random() * 6.283, sp2 = 60 + Math.random() * 220; a.particles.push({ x, y, vx: Math.cos(ang) * sp2, vy: Math.sin(ang) * sp2 - 80, life: 0.5 + Math.random() * 0.5, max: 1, color: color || '#3ee8c8', size: 2 + Math.random() * 3 }); }
    };
    E.setRain = (on, color) => { a.rain = on ? { color: color || 'rgba(170,200,255,.55)', drops: Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.8 })) } : null; };

    /* nyawa, skor */
    E.refreshHud = () => {
      if (a.hudLives) E.hudText('__nyawa', '♥ ' + a.lives, 3, 14, 20, '#ff6b81'); else E.hudRemove('__nyawa');
      if (a.hudScore) E.hudText('__skor', 'Skor ' + a.score, 88, 14, 18, '#ffd166'); else E.hudRemove('__skor');
    };
    E.loseLife = n => {
      a.lives = Math.max(0, a.lives - n); E.refreshHud();
      if (a.lives <= 0) {
        if (!E.dispatch('mati', [])) { Synth.play('kalah', 1); Pro.say('Game over!', 1500); E.timerAdd(1500, () => { a.lives = a.livesMax; E.refreshHud(); E.resetPlayer(); }); }
      }
    };
    E.exit = () => stop();
    return E;
  }

  function fit(a) {
    a.w = a.root.clientWidth; a.h = a.root.clientHeight;
    a.cv.width = Math.round(a.w * a.dpr); a.cv.height = Math.round(a.h * a.dpr);
  }

  function tick(t) {
    const a = A; if (!a) return;
    a.raf = requestAnimationFrame(tick);
    const dt = Math.min(0.034, Math.max(0.001, (t - a.last) / 1000)); a.last = t;
    if (a.root.clientWidth !== a.w || a.root.clientHeight !== a.h) fit(a);
    if (!a.paused) { try { step(a, dt); } catch (err) { report(a, err, 'Mesin'); } }
    if (A !== a) return;
    draw(a, t);
  }

  function land(o, prevY, hw, plats) {
    for (const pl of plats) {
      if (o.vy >= 0 && prevY <= pl.y + 1 && o.y >= pl.y && o.x + hw > pl.x && o.x - hw < pl.x + pl.w) { o.y = pl.y; o.vy = 0; return true; }
    }
    return false;
  }

  function step(a, dt0) {
    const E = a.E, Pro = a.Pro, P = a.P, inp = Pro.input;
    const dt = dt0 * a.timeScale;
    a.clock += dt;

    // timer
    if (a.timers.length) {
      for (const tm of a.timers.slice()) {
        if (a.clock < tm.at) continue;
        if (tm.every) tm.at += tm.every; else a.timers = a.timers.filter(x => x !== tm);
        try { tm.fn(...tm.args); } catch (err) { report(a, err); a.timers = a.timers.filter(x => x !== tm); }
        if (A !== a) return;
      }
    }

    // input
    let ax = clamp((+inp.x || 0) + a.autoX, -1, 1); a.autoX = 0;
    if (a.dialog.open || !a.canWalk) ax = 0;
    P.vx = ax * Pro.speed;
    if (Math.abs(ax) > 0.1) P.facing = ax > 0 ? 1 : -1;
    const held = !!inp.jump && !a.dialog.open, edge = held && !a.prevJump; a.prevJump = held;
    if (edge) E.dispatch('tombol_lompat', []);
    if (held) E.doJump(edge);
    if (ax > 0.2) E.dispatch('tombol_kanan', []); else if (ax < -0.2) E.dispatch('tombol_kiri', []); else E.dispatch('diam', []);
    if (A !== a) return;

    // fisika pemain
    if (a.gravityOn) P.vy = Math.min(P.vy + Pro.gravity * dt, 1500); else P.vy = 0;
    const prevY = P.y;
    P.x = clamp(P.x + P.vx * dt, a.hw, World.W - a.hw);
    P.y += P.vy * dt;
    P.onGround = false;
    if (a.collide) { if (land(P, prevY, a.hw * a.hitScale, Pro.platforms)) { P.onGround = true; a.jumpsLeft = a.maxJumps - 1; } }
    else if (P.y > World.groundY) { P.y = World.groundY; P.vy = 0; P.onGround = true; }
    if (P.y > World.H + 400) E.resetPlayer();

    // entitas
    const ph = Math.max(20, a.dh * 0.85), pw = a.hw * 2 * a.hitScale;
    for (const e of a.entities.slice()) {
      const im = getImg(e.anim.frames[0]);
      if (im.naturalWidth) { e.dw = im.naturalWidth * e.unit; e.dh = im.naturalHeight * e.unit; }
      if (e.patrol) {
        e.x += e.patrol.dir * e.patrol.speed * dt;
        if (Math.abs(e.x - e.patrol.x0) > e.patrol.range) { e.patrol.dir *= -1; e.x = e.patrol.x0 + Math.sign(e.x - e.patrol.x0) * e.patrol.range; }
        e.facing = e.patrol.dir;
      }
      e.x += e.vx * dt;
      if (e.physics) { e.vy = Math.min(e.vy + Pro.gravity * dt, 1500); const py = e.y; e.y += e.vy * dt; land(e, py, Math.max(6, e.dw * 0.25), Pro.platforms); }
      else e.y += e.vy * dt;
      if (e.hidden || (e.kind !== 'item' && e.kind !== 'musuh')) continue;
      if (!hit(P.x, P.y, pw, ph, e.x, e.y, e.dw * 0.6, e.dh * 0.8)) continue;
      if (e.kind === 'item') {
        a.entities = a.entities.filter(x => x !== e);
        if (!E.dispatch('ambil_item', [e.id])) { a.score += 1; E.refreshHud(); Synth.play('koin', 1); E.burst(e.x, e.y - e.dh / 2, 10, '#ffd166'); }
      } else if (e.kind === 'musuh' && a.clock >= e.cool) {
        const stomp = P.vy > 60 && P.y < e.y - e.dh * 0.45;
        if (stomp) {
          if (!E.dispatch('injak_musuh', [e.id])) { a.entities = a.entities.filter(x => x !== e); P.vy = -Pro.jumpPower * 0.6; Synth.play('ledak', 0.7); E.burst(e.x, e.y - e.dh / 2, 16, '#ff9f43'); }
          else e.cool = a.clock + 0.6;
        } else if (a.clock >= a.invuln) {
          a.invuln = a.clock + 1.2; e.cool = a.clock + 0.3;
          if (!E.dispatch('kena_musuh', [e.id])) { P.vy = -320; P.x += (P.x < e.x ? -1 : 1) * 40; Synth.play('luka', 1); E.shake(250, 5); E.flash('#ff3b5c', 280); E.loseLife(1); }
        }
      }
    }
    // animasi pemain
    const moving = Math.abs(P.vx) > 8, an = a.an;
    let pick = !P.onGround ? (an.jump || (moving ? (an.walk || an.idle) : an.idle)) : (moving ? (an.walk || an.idle) : an.idle);
    if (a.force && a.clock < a.force.until) pick = a.force.anim; else a.force = null;
    if (pick !== a.cur) { a.cur = pick; a.animT = 0; } else a.animT += dt;

    // partikel
    for (const p of a.particles) { p.life -= dt; p.vy += 600 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    if (a.particles.length) a.particles = a.particles.filter(p => p.life > 0);

    PlayExt.step(a, dt);
    E.dispatch('update', [dt]);
    fire('update', dt);
  }

  function draw(a, now) {
    const { ctx, w, h, dpr } = a, Pro = a.Pro, P = a.P;
    const scale = (h / World.H) * a.zoom, vw = w / scale;
    const target = a.camFollow ? clamp(P.x - vw / 2, 0, Math.max(0, World.W - vw)) : a.camManual;
    a.cam += (target - a.cam) * 0.18;
    const worldPx = World.H * scale;
    let offY = worldPx <= h ? h - worldPx : clamp(h * 0.62 - P.y * scale, h - worldPx, 0);
    let camX = a.cam;
    if (a.clock < a.shakeUntil) { camX += (Math.random() - 0.5) * a.shakeAmp * 2 / scale; offY += (Math.random() - 0.5) * a.shakeAmp * 2; }
    a.scale = scale; a.offY = offY;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    World.draw(ctx, w, h, camX, scale, Pro.texts, null, Pro.platforms, offY, a.sky, a.bgImg);

    ctx.save(); ctx.translate(-camX * scale, offY); ctx.scale(scale, scale);
    // entitas
    for (const e of a.entities) {
      if (e.hidden) continue;
      const n = e.anim.frames.length, im = getImg(e.anim.frames[PlayExt.frameIdx(e.anim, a.clock - e.t0, n)]);
      if (!im.naturalWidth) continue;
      const dw = im.naturalWidth * e.unit, dh = im.naturalHeight * e.unit, fl = (e.facing < 0) !== !!e.flip ? -1 : 1;
      ctx.save(); ctx.translate(e.x, e.y); ctx.scale(fl, 1); ctx.drawImage(im, -dw / 2, -dh, dw, dh); ctx.restore();
    }
    // bayangan pemain
    if (!a.hidden) {
      let under = null;
      for (const pl of Pro.platforms) if (pl.y >= P.y - 1 && P.x > pl.x && P.x < pl.x + pl.w && (!under || pl.y < under.y)) under = pl;
      if (under) { const k = clamp(1 - (under.y - P.y) / 160, 0.15, 1); ctx.fillStyle = 'rgba(0,0,0,' + 0.35 * k + ')'; ctx.beginPath(); ctx.ellipse(P.x, under.y + 1, a.hw * 1.1 * k, 4 * k, 0, 0, 7); ctx.fill(); }
      const an = a.cur, n = an.frames.length, isJump = an === a.an.jump;
      const idx = isJump ? Math.min(Math.floor(a.animT * an.fps), n - 1) : PlayExt.frameIdx(an, a.animT, n);
      const img = getImg(an.frames[idx]);
      if (img.naturalWidth) {
        const blink = a.clock < a.invuln && Math.floor(a.clock * 14) % 2 === 0;
        if (blink) ctx.globalAlpha = 0.35;
        const d = World.drawPlayer(ctx, img, P.x, P.y, a.unit, P.facing); a.dw = d.dw; a.dh = d.dh;
        ctx.globalAlpha = 1;
      }
    }
    // efek animasi
    const pn = performance.now();
    a.effects = a.effects.filter(fx => fx.until > pn);
    for (const fx of a.effects) {
      const age = Math.max(0, pn - fx.t0), n = fx.anim.frames.length;
      const im = getImg(fx.anim.frames[Math.floor(age / 1000 * fx.anim.fps) % n]);
      if (!im.naturalWidth) continue;
      const dw = im.naturalWidth * fx.unit, dh = im.naturalHeight * fx.unit, k = 0.6 + 0.4 * Math.min(1, age / 160);
      const cy = fx.anchor === 'center' ? fx.y : fx.y - dh / 2;
      ctx.save(); ctx.translate(fx.x, cy); ctx.scale(fx.flip * k, k); ctx.drawImage(im, -dw / 2, -dh / 2, dw, dh); ctx.restore();
    }
    // partikel
    for (const p of a.particles) { ctx.globalAlpha = clamp(p.life / 0.6, 0, 1); ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
    ctx.globalAlpha = 1;
    if (!a.hidden && P.say && pn < P.say.until) {
      ctx.font = '700 15px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const tw = ctx.measureText(P.say.text).width + 22, bx = P.x - tw / 2, by = P.y - a.dh - 38;
      ctx.fillStyle = 'rgba(255,255,255,.96)'; ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, tw, 28, 14); else ctx.rect(bx, by, tw, 28);
      ctx.moveTo(P.x - 6, by + 27); ctx.lineTo(P.x, by + 36); ctx.lineTo(P.x + 6, by + 27); ctx.fill();
      ctx.fillStyle = '#10162a'; ctx.fillText(P.say.text, P.x, by + 14.5);
    } else if (P.say && pn >= P.say.until) P.say = null;
    PlayExt.drawWorld(a, ctx);
    ctx.restore();

    // hujan (di ruang layar)
    if (a.rain) {
      ctx.strokeStyle = a.rain.color; ctx.lineWidth = 1.2; ctx.beginPath();
      for (const d of a.rain.drops) { d.y += 0.016 * 1.8 * d.s; d.x -= 0.004 * d.s; if (d.y > 1.05) { d.y = -0.05; d.x = Math.random() * 1.1; } const x = d.x * w, y = d.y * h; ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 14 * d.s); }
      ctx.stroke();
    }
    PlayExt.drawScreen(a, ctx, w, h);
  }

  function stop() {
    const a = A; if (!a) return; A = null;
    cancelAnimationFrame(a.raf);
    PlayExt.cleanup(a);
    for (const fn of a.handlers.stop.slice()) { try { fn(); } catch (e) { console.error(e); } }
    for (const [t, ty, fn, o] of a.listeners) t.removeEventListener(ty, fn, o);
    for (const s of a.styles) s.remove();
    if (a.audio.music) a.audio.music.pause();
    for (const el of a.audio.els) { try { el.pause(); } catch (e) { /* abaikan */ } }
    a.root.remove();
    try { delete window.Pro; } catch (e) { window.Pro = undefined; }
    if (typeof Play.onStop === 'function') Play.onStop();
  }

  return { start, stop, onStop: null, get active() { return !!A; } };
})();
