'use strict';
/* =====================================================================
   play.js: dunia platformer + mode Coba + Pro API untuk skrip proyek
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
  draw(ctx, cw, ch, camX, scale, texts, selId, platforms) {
    const g = ctx.createLinearGradient(0, 0, 0, ch);
    g.addColorStop(0, '#0d1330'); g.addColorStop(0.62, '#1a1d4a'); g.addColorStop(1, '#2b2262');
    ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
    // bulan
    const mx = cw * 0.8 - camX * scale * 0.04, my = ch * 0.2, mr = ch * 0.07;
    const mg = ctx.createRadialGradient(mx, my, mr * 0.3, mx, my, mr * 3.2);
    mg.addColorStop(0, 'rgba(160,255,238,.35)'); mg.addColorStop(1, 'rgba(160,255,238,0)');
    ctx.fillStyle = mg; ctx.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
    ctx.fillStyle = '#d9fff8'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, 7); ctx.fill();
    // bintang
    const span = cw + 40;
    for (const s of this.stars) {
      const x = (((s.x * scale * 1.6 - camX * scale * 0.12) % span) + span) % span - 20;
      ctx.fillStyle = 'rgba(255,255,255,' + s.a + ')'; ctx.beginPath(); ctx.arc(x, s.y * scale, s.r * Math.max(1, scale * 1.2), 0, 7); ctx.fill();
    }
    // bukit berlapis
    const hills = (color, base, amp, freq, par) => {
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, ch);
      for (let x = 0; x <= cw + 12; x += 12) {
        const wx = x / scale + camX * par;
        ctx.lineTo(x, (base + Math.sin(wx * freq) * amp + Math.sin(wx * freq * 2.3 + 1) * amp * 0.4) * scale);
      }
      ctx.lineTo(cw, ch); ctx.fill();
    };
    hills('#171a45', 290, 26, 0.004, 0.25);
    hills('#12183c', 315, 18, 0.007, 0.5);

    ctx.save(); ctx.translate(-camX * scale, 0); ctx.scale(scale, scale);
    for (const pl of (platforms || this.defaultPlatforms)) {
      if (pl.h >= 40) {
        const gg = ctx.createLinearGradient(0, pl.y, 0, pl.y + pl.h);
        gg.addColorStop(0, '#22305e'); gg.addColorStop(1, '#0f1530');
        ctx.fillStyle = gg; ctx.fillRect(pl.x, pl.y, pl.w, pl.h + 200);
        ctx.fillStyle = '#3ee8c8'; ctx.globalAlpha = 0.9; ctx.fillRect(pl.x, pl.y, pl.w, 3); ctx.globalAlpha = 1;
      } else {
        ctx.shadowColor = 'rgba(62,232,200,.45)'; ctx.shadowBlur = 14;
        ctx.fillStyle = '#2a3d78'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(pl.x, pl.y, pl.w, pl.h, 7) : ctx.rect(pl.x, pl.y, pl.w, pl.h); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#3ee8c8'; ctx.fillRect(pl.x + 6, pl.y, pl.w - 12, 3);
      }
    }
    for (const t of (texts || [])) {
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

const Play = (() => {
  let A = null;

  async function start(project) {
    if (A) return;
    const sp = playerSprite(project);
    if (!sp) return toast('Belum ada ProSprite. Buat satu dulu dan isi animasi Idle / Walk / Jump.', 3600);
    const an = { idle: findAnim(project, sp, RE.Idle), walk: findAnim(project, sp, RE.Walk), jump: findAnim(project, sp, RE.Jump) };
    if (!an.idle) an.idle = an.walk || an.jump;
    if (!an.idle) return toast('Belum ada animasi bernama Idle, Walk, atau Jump yang ada framenya.', 4000);
    await flush();

    // pre-load semua frame biar tidak kedip
    const imgs = [];
    for (const k of ['idle', 'walk', 'jump']) if (an[k]) for (const f of an[k].frames) imgs.push(getImg(f));
    await Promise.all(imgs.map(i => (i.decode ? i.decode().catch(() => { }) : Promise.resolve())));
    if (A) return;

    const root = document.createElement('div'); root.id = 'play';
    root.innerHTML = '<canvas id="pc"></canvas><div id="pro-ui"></div><button class="pro-exit">' + I.x + '<span>Keluar</span></button><div class="pro-tag">Mode Coba</div>';
    document.body.appendChild(root);
    const cv = root.querySelector('#pc');
    const unit = spriteUnit(sp);
    const idleImg = getImg(an.idle.frames[0]);
    const hw = Math.max(8, idleImg.naturalWidth * unit * 0.28);

    const a = A = { root, cv, ctx: cv.getContext('2d'), w: 0, h: 0, dpr: Math.min(2, window.devicePixelRatio || 1), raf: 0, last: performance.now(),
      cam: 0, cur: null, animT: 0, listeners: [], styles: [], hw, unit, an, handlers: { start: [], update: [], click: [], stop: [] }, dw: 0, dh: 0 };

    const P = { x: 80, y: World.groundY, vx: 0, vy: 0, onGround: true, facing: 1, say: null };
    const Pro = {
      input: { x: 0, jump: false },
      speed: 220, jumpPower: 640, gravity: 1800,
      player: P,
      platforms: World.platforms(),
      texts: project.texts.map(t => Object.assign({}, t)),
      ui: root.querySelector('#pro-ui'),
      world: { width: World.W, height: World.H },
      on(ev, fn) { if (a.handlers[ev] && typeof fn === 'function') a.handlers[ev].push(fn); },
      jump() { if (P.onGround) { P.vy = -Pro.jumpPower; P.onGround = false; } },
      say(text, ms) { P.say = { text: String(text), until: performance.now() + (ms || 1500) }; },
      toast(msg, ms) { toast(String(msg), ms); },
      listen(target, type, fn, opt) { target.addEventListener(type, fn, opt); a.listeners.push([target, type, fn, opt]); },
      exit() { stop(); }
    };
    a.Pro = Pro;
    window.Pro = Pro;

    root.querySelector('.pro-exit').addEventListener('click', stop);
    cv.addEventListener('pointerdown', e => {
      const r = cv.getBoundingClientRect(), sc = a.h / World.H;
      const x = (e.clientX - r.left) / sc + a.cam, y = (e.clientY - r.top) / sc;
      const t = World.hitText(Pro.texts, x, y);
      let ev = null;
      if (t) ev = { type: 'text', target: t, x, y };
      else if (x >= P.x - a.dw / 2 && x <= P.x + a.dw / 2 && y >= P.y - a.dh && y <= P.y) ev = { type: 'sprite', target: P, x, y };
      if (ev) fire('click', ev);
    });

    // CSS lalu JS dari proyek
    for (const f of project.scripts) {
      if (/\.css$/i.test(f.name)) { const st = document.createElement('style'); st.dataset.pro = '1'; st.textContent = f.code; document.head.appendChild(st); a.styles.push(st); }
    }
    for (const f of project.scripts) {
      if (!/\.js$/i.test(f.name)) continue;
      try { new Function('Pro', f.code)(Pro); } catch (err) { console.error(err); toast('Error di ' + f.name + ': ' + err.message, 4500); }
    }
    fire('start');
    fit(a);
    a.raf = requestAnimationFrame(tick);
  }

  function fire(ev, arg) {
    const a = A; if (!a) return;
    for (const fn of a.handlers[ev].slice()) {
      try { fn(arg); } catch (err) { console.error(err); toast('Error di skrip (' + ev + '): ' + err.message, 4000); a.handlers[ev] = a.handlers[ev].filter(x => x !== fn); }
      if (A !== a) return;
    }
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
    step(a, dt); if (A !== a) return;
    draw(a, t);
  }

  function step(a, dt) {
    const Pro = a.Pro, P = Pro.player, inp = Pro.input;
    const ax = clamp(+inp.x || 0, -1, 1);
    P.vx = ax * Pro.speed;
    if (Math.abs(ax) > 0.1) P.facing = ax > 0 ? 1 : -1;
    if (inp.jump) Pro.jump();
    P.vy = Math.min(P.vy + Pro.gravity * dt, 1500);
    const prevY = P.y;
    P.x = clamp(P.x + P.vx * dt, a.hw, World.W - a.hw);
    P.y += P.vy * dt;
    P.onGround = false;
    for (const pl of Pro.platforms) {
      if (P.vy >= 0 && prevY <= pl.y + 1 && P.y >= pl.y && P.x + a.hw > pl.x && P.x - a.hw < pl.x + pl.w) { P.y = pl.y; P.vy = 0; P.onGround = true; }
    }
    if (P.y > World.H + 400) { P.x = 80; P.y = World.groundY - 2; P.vy = 0; }
    // pilih animasi
    const moving = Math.abs(P.vx) > 8, an = a.an;
    const pick = !P.onGround ? (an.jump || (moving ? (an.walk || an.idle) : an.idle)) : (moving ? (an.walk || an.idle) : an.idle);
    if (pick !== a.cur) { a.cur = pick; a.animT = 0; } else a.animT += dt;
    fire('update', dt);
  }

  function draw(a, now) {
    const { ctx, w, h, dpr } = a, Pro = a.Pro, P = Pro.player;
    const scale = h / World.H, vw = w / scale;
    const target = clamp(P.x - vw / 2, 0, Math.max(0, World.W - vw));
    a.cam += (target - a.cam) * 0.18;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    World.draw(ctx, w, h, a.cam, scale, Pro.texts, null, Pro.platforms);

    ctx.save(); ctx.translate(-a.cam * scale, 0); ctx.scale(scale, scale);
    // bayangan di platform terdekat di bawah
    let under = null;
    for (const pl of Pro.platforms) if (pl.y >= P.y - 1 && P.x > pl.x && P.x < pl.x + pl.w && (!under || pl.y < under.y)) under = pl;
    if (under) {
      const k = clamp(1 - (under.y - P.y) / 160, 0.15, 1);
      ctx.fillStyle = 'rgba(0,0,0,' + 0.35 * k + ')'; ctx.beginPath(); ctx.ellipse(P.x, under.y + 1, a.hw * 1.1 * k, 4 * k, 0, 0, 7); ctx.fill();
    }
    const an = a.cur, n = an.frames.length;
    const isJump = an === a.an.jump;
    const idx = isJump ? Math.min(Math.floor(a.animT * an.fps), n - 1) : Math.floor(a.animT * an.fps) % n;
    const img = getImg(an.frames[idx]);
    if (img.naturalWidth) { const d = World.drawPlayer(ctx, img, P.x, P.y, a.unit, P.facing); a.dw = d.dw; a.dh = d.dh; }
    if (P.say && now < P.say.until) {
      ctx.font = '700 15px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const tw = ctx.measureText(P.say.text).width + 22, bx = P.x - tw / 2, by = P.y - a.dh - 38;
      ctx.fillStyle = 'rgba(255,255,255,.96)'; ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, tw, 28, 14); else ctx.rect(bx, by, tw, 28);
      ctx.moveTo(P.x - 6, by + 27); ctx.lineTo(P.x, by + 36); ctx.lineTo(P.x + 6, by + 27); ctx.fill();
      ctx.fillStyle = '#10162a'; ctx.fillText(P.say.text, P.x, by + 14.5);
    } else P.say = null;
    ctx.restore();
  }

  function stop() {
    const a = A; if (!a) return; A = null;
    cancelAnimationFrame(a.raf);
    for (const fn of a.handlers.stop.slice()) { try { fn(); } catch (e) { console.error(e); } }
    for (const [t, ty, fn, o] of a.listeners) t.removeEventListener(ty, fn, o);
    for (const s of a.styles) s.remove();
    a.root.remove();
    try { delete window.Pro; } catch (e) { window.Pro = undefined; }
  }

  return { start, stop, get active() { return !!A; } };
})();
