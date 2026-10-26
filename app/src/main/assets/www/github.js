'use strict';
/* Game: login GitHub (Device Flow), publish, jelajah game, akun */
const Game = (() => {
  const TOPIC = 'prosprite-game';
  const LS = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* abaikan */ } }, del(k) { try { localStorage.removeItem(k); } catch (e) { /* abaikan */ } } };
  const getCid = () => LS.get('ps_cid') || '';
  const getLogin = () => { try { return JSON.parse(LS.get('ps_gh') || 'null'); } catch (e) { return null; } };
  const setLogin = v => { if (v) LS.set('ps_gh', JSON.stringify(v)); else LS.del('ps_gh'); };

  /* ---- HTTP: lewat jembatan native (untuk github.com yang tanpa CORS) atau fetch ---- */
  const pend = new Map(); let seq = 1;
  window.__nativeHttp = (id, status, text) => { const r = pend.get(id); if (r) { pend.delete(id); r({ status, text }); } };
  function nativeHttp(method, url, headers, body) {
    return new Promise((res, rej) => {
      if (window.Native && Native.http) { const id = 'h' + (seq++); pend.set(id, res); try { Native.http(id, method, url, JSON.stringify(headers || {}), body || ''); } catch (e) { pend.delete(id); rej(e); } setTimeout(() => { if (pend.has(id)) { pend.delete(id); rej(new Error('Waktu habis')); } }, 30000); }
      else fetch(url, { method, headers, body: body || undefined }).then(async r => res({ status: r.status, text: await r.text() })).catch(rej);
    });
  }
  async function api(path, o = {}) {
    const lg = getLogin();
    const h = Object.assign({ Accept: 'application/vnd.github+json' }, o.headers || {});
    if (lg && lg.token && !o.anon) h.Authorization = 'Bearer ' + lg.token;
    if (o.body) h['Content-Type'] = 'application/json';
    const r = await fetch('https://api.github.com' + path, { method: o.method || 'GET', headers: h, body: o.body ? JSON.stringify(o.body) : undefined });
    const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { /* bukan json */ }
    if (r.status === 401) { setLogin(null); throw new Error('Sesi GitHub habis, login lagi'); }
    if (!r.ok && !(o.okStatus || []).includes(r.status)) throw new Error((j && j.message) || ('GitHub error ' + r.status));
    return { status: r.status, data: j };
  }
  const b64 = str => { const u = new TextEncoder().encode(str); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };

  /* ---- login ---- */
  function loginModal() {
    return new Promise(res => {
      const lg = getLogin();
      if (lg) return res(lg);
      const m = modal('<h3>Login GitHub</h3><p class="small">Dibutuhkan sebelum publish dan buat melihat akunmu. Pilih salah satu cara.</p>' +
        '<label>Client ID aplikasi OAuth kamu</label><input class="input" id="gcid" placeholder="mis. Ov23li..." value="' + esc(getCid()) + '">' +
        '<div class="row end" style="margin-top:8px"><button class="btn primary" id="gdev">Login dengan GitHub</button></div>' +
        '<div class="sep"></div><label>Atau tempel token (Personal Access Token, centang <b>public_repo</b>)</label><input class="input" id="gpat" placeholder="ghp_... / github_pat_..." autocapitalize="off" autocomplete="off">' +
        '<div class="row end" style="margin-top:8px"><button class="btn" id="gcancel">Batal</button><button class="btn" id="gtok">Pakai token</button></div><div class="small" id="gmsg" style="margin-top:6px"></div>');
      let polling = false, done = false;
      const fin = v => { if (done) return; done = true; polling = false; m.close(); res(v); };
      const msg = t => { m.$('#gmsg').textContent = t; };
      m.$('#gcancel').onclick = () => fin(null); m.el.addEventListener('dismiss', () => fin(null));
      const finish = async token => {
        msg('Mengambil data akun...');
        const r = await fetch('https://api.github.com/user', { headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' } });
        if (!r.ok) throw new Error('Token ditolak GitHub (' + r.status + ')');
        const u = await r.json(); const v = { token, user: { login: u.login, avatar: u.avatar_url, name: u.name || u.login } };
        setLogin(v); toast('Login sebagai ' + u.login); fin(v);
      };
      m.$('#gtok').onclick = async () => { const t = m.$('#gpat').value.trim(); if (!t) return msg('Tempel tokennya dulu'); try { await finish(t); } catch (e) { msg(e.message); } };
      m.$('#gdev').onclick = async () => {
        const cid = m.$('#gcid').value.trim(); if (!cid) return msg('Isi Client ID dulu (lihat panduan)');
        LS.set('ps_cid', cid); msg('Meminta kode...');
        try {
          const r = await nativeHttp('POST', 'https://github.com/login/device/code', { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, 'client_id=' + encodeURIComponent(cid) + '&scope=public_repo');
          const j = JSON.parse(r.text); if (!j.device_code) throw new Error(j.error_description || j.error || 'Gagal meminta kode');
          m.$('.modal') ? 0 : 0;
          m.el.querySelector('#gdev').parentElement.innerHTML = '<div style="text-align:center;width:100%"><div class="small">Masukkan kode ini di GitHub:</div><div class="ucode">' + esc(j.user_code) + '</div><button class="btn" id="gcopy">Salin kode</button> <button class="btn primary" id="gopen">Buka GitHub</button></div>';
          m.$('#gcopy').onclick = () => { try { navigator.clipboard.writeText(j.user_code); toast('Kode disalin'); } catch (e) { /* abaikan */ } };
          m.$('#gopen').onclick = () => { const u = j.verification_uri || 'https://github.com/login/device'; if (window.Native && Native.openUrl) Native.openUrl(u); else window.open(u, '_blank'); };
          msg('Menunggu kamu menyetujui di GitHub...'); polling = true; let wait = (j.interval || 5) * 1000;
          while (polling) {
            await new Promise(z => setTimeout(z, wait)); if (!polling) break;
            const p = await nativeHttp('POST', 'https://github.com/login/oauth/access_token', { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, 'client_id=' + encodeURIComponent(cid) + '&device_code=' + encodeURIComponent(j.device_code) + '&grant_type=urn:ietf:params:oauth:grant-type:device_code');
            const q = JSON.parse(p.text);
            if (q.access_token) { await finish(q.access_token); break; }
            if (q.error === 'slow_down') wait += 5000;
            else if (q.error && q.error !== 'authorization_pending') throw new Error(q.error_description || q.error);
          }
        } catch (e) { msg('Gagal: ' + e.message); }
      };
    });
  }
  function logout() { setLogin(null); toast('Sudah keluar'); }

  /* ---- publish ---- */
  const slug = s => (s || 'game').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'game';
  function packProject(p) {
    return {
      v: 1, name: p.name, playerId: p.playerId,
      sprites: p.sprites, texts: p.texts, sounds: p.sounds || [],
      scripts: p.scripts.filter(f => /\.cd$/i.test(f.name)).map(f => ({ name: f.name, code: f.code }))
    };
  }
  async function putFile(owner, repo, path, content64, msg) {
    let sha; const ex = await api('/repos/' + owner + '/' + repo + '/contents/' + path, { okStatus: [404] });
    if (ex.status === 200 && ex.data && ex.data.sha) sha = ex.data.sha;
    return api('/repos/' + owner + '/' + repo + '/contents/' + path, { method: 'PUT', body: { message: msg, content: content64, sha } });
  }
  async function publish() {
    const p = S.project; if (!p) return;
    if (!p.scripts.some(f => /\.cd$/i.test(f.name))) return toast('Game butuh minimal satu file .cd di tab Kode', 3500);
    let lg = getLogin(); if (!lg) { lg = await loginModal(); if (!lg) return; }
    const upd = p.published && p.published.repo && p.published.repo.startsWith(lg.user.login + '/');
    const ok = await askConfirm((upd ? 'Perbarui game "' : 'Publish "') + p.name + '" ke GitHub-mu sebagai repo PUBLIK? Semua orang bisa melihat sprite, suara, dan kode .cd-nya. File JS/CSS tidak ikut.', upd ? 'Perbarui' : 'Publish');
    if (!ok) return;
    const t = toast.bind(null); t('Mengunggah...', 60000);
    try {
      await flush();
      const json = JSON.stringify(packProject(p));
      if (json.length > 30 * 1024 * 1024) throw new Error('Proyek terlalu besar (' + Math.round(json.length / 1048576) + ' MB, maks 30 MB). Kecilkan jumlah frame / suara.');
      let owner = lg.user.login, repo;
      if (upd) repo = p.published.repo.split('/')[1];
      else {
        repo = 'prosprite-' + slug(p.name) + '-' + Math.random().toString(36).slice(2, 6);
        await api('/user/repos', { method: 'POST', body: { name: repo, description: 'Game ProSprite: ' + p.name, homepage: '', private: false } });
        await new Promise(z => setTimeout(z, 1200));
      }
      await putFile(owner, repo, 'game.json', b64(json), 'Publish game');
      const th = thumbOf(p);
      if (th && th.startsWith('data:image/png')) { try { await putFile(owner, repo, 'cover.png', th.split(',')[1], 'Cover'); } catch (e) { console.warn(e); } }
      await putFile(owner, repo, 'README.md', b64('# ' + p.name + '\n\nGame dibuat dengan **ProSprite** (Cmode).\n\nBuka aplikasi ProSprite, tab Game, cari "' + p.name + '" lalu tekan Main.\n'), 'README');
      await api('/repos/' + owner + '/' + repo + '/topics', { method: 'PUT', body: { names: [TOPIC] } });
      p.published = { repo: owner + '/' + repo, at: Date.now() }; dirty(); await flush();
      toast('Terpublish! github.com/' + owner + '/' + repo, 5000);
    } catch (e) { console.error(e); toast('Gagal publish: ' + e.message, 6000); }
  }

  /* ---- sanitasi game orang lain ---- */
  const IMG_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, AUD_RE = /^data:audio\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/i;
  const str = (v, n) => String(v == null ? '' : v).slice(0, n);
  const num = (v, a, b, d) => (typeof v === 'number' && isFinite(v) ? Math.max(a, Math.min(b, v)) : d);
  function sanitize(g, full) {
    if (!g || typeof g !== 'object') throw new Error('Data game rusak');
    const p = { id: 'remote_' + slug(full), name: str(g.name, 40) || 'Game', updated: Date.now(), sprites: [], texts: [], sounds: [], scripts: [], playerId: null };
    for (const s of (Array.isArray(g.sprites) ? g.sprites : []).slice(0, 20)) {
      const sp = { id: str(s.id, 24), name: str(s.name, 24), scale: num(s.scale, 0.2, 5, 1), anims: [] };
      for (const a of (Array.isArray(s.anims) ? s.anims : []).slice(0, 30)) {
        const an = { id: str(a.id, 24), name: str(a.name, 24), fps: num(a.fps, 1, 60, 10), frames: [] };
        for (const f of (Array.isArray(a.frames) ? a.frames : []).slice(0, 80)) if (typeof f === 'string' && f.length < 4e6 && IMG_RE.test(f)) an.frames.push(f);
        sp.anims.push(an);
      }
      p.sprites.push(sp);
    }
    p.playerId = g.playerId ? str(g.playerId, 24) : null;
    for (const t of (Array.isArray(g.texts) ? g.texts : []).slice(0, 100)) p.texts.push({ id: str(t.id, 24) || uid(), name: str(t.name, 20).replace(/[^\w]/g, ''), text: str(t.text, 80), x: num(t.x, -500, 3000, 0), y: num(t.y, -200, 600, 0), size: num(t.size, 8, 120, 24), color: /^#[0-9a-fA-F]{3,8}$/.test(t.color) ? t.color : '#ffffff' });
    for (const s of (Array.isArray(g.sounds) ? g.sounds : []).slice(0, 30)) if (typeof s.src === 'string' && s.src.length < 3e6 && AUD_RE.test(s.src)) p.sounds.push({ id: str(s.id, 24), name: str(s.name, 20).replace(/[^\w]/g, ''), src: s.src });
    for (const f of (Array.isArray(g.scripts) ? g.scripts : []).slice(0, 20)) if (/^[\w.-]{1,32}\.cd$/i.test(f.name || '') && typeof f.code === 'string' && f.code.length < 200000) p.scripts.push({ id: uid(), name: f.name, code: f.code });
    if (!p.scripts.length) throw new Error('Game ini tidak punya kode Cmode');
    return p;
  }
  async function playRemote(full, branch) {
    toast('Memuat game...', 30000);
    try {
      const r = await fetch('https://raw.githubusercontent.com/' + full + '/' + (branch || 'HEAD') + '/game.json', { cache: 'no-cache' });
      if (!r.ok) throw new Error('game.json tidak ditemukan (' + r.status + ')');
      const p = sanitize(await r.json(), full);
      toast('Memuat game...', 300);
      Play.start(p, { trusted: false, gameId: 'remote:' + full });
    } catch (e) { toast('Gagal: ' + e.message, 5000); }
  }

  /* ---- beranda Game & Akun ---- */
  const cover = r => 'https://raw.githubusercontent.com/' + r.full_name + '/' + (r.default_branch || 'main') + '/cover.png';
  const card = (r, mine) => '<div class="pcard gcard"><button class="pthumb" data-act="g-play" data-full="' + esc(r.full_name) + '" data-br="' + esc(r.default_branch || 'HEAD') + '"><img src="' + esc(cover(r)) + '" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'empty\',textContent:\'Tanpa cover\'}))"></button>' +
    '<div class="pinfo"><b>' + esc((r.description || r.name).replace(/^Game ProSprite: /, '')) + '</b><span class="small">oleh ' + esc(r.owner.login) + '</span></div>' +
    '<div class="pacts"><button class="btn sm primary grow" data-act="g-play" data-full="' + esc(r.full_name) + '" data-br="' + esc(r.default_branch || 'HEAD') + '">Main</button>' + (mine ? '<button class="icon-btn sm danger" data-act="g-unlist" data-full="' + esc(r.full_name) + '">' + I.trash + '</button>' : '') + '</div></div>';
  const needLogin = () => '<div class="gate"><div class="logo">' + I.ghost + '</div><b>Login GitHub dulu</b><p class="small">Beranda Game dan Akun butuh login GitHub.</p><button class="btn primary" data-act="g-login">Login GitHub</button></div>';

  async function renderGame(host) {
    if (!getLogin()) { host.innerHTML = needLogin(); return; }
    host.innerHTML = '<div class="small" style="padding:20px">Memuat daftar game...</div>';
    try {
      const r = await api('/search/repositories?q=' + encodeURIComponent('topic:' + TOPIC) + '&sort=updated&per_page=40');
      const items = (r.data && r.data.items) || [];
      host.innerHTML = '<div class="proj-grid">' + (items.length ? items.map(i => card(i, false)).join('') : '<div class="empty-hint" style="grid-column:1/-1">Belum ada game dipublish. Jadilah yang pertama!</div>') + '</div>';
    } catch (e) { host.innerHTML = '<div class="gate"><b>Gagal memuat</b><p class="small">' + esc(e.message) + '</p><button class="btn" data-act="g-reload">Coba lagi</button></div>'; }
  }
  async function renderAkun(host) {
    const lg = getLogin(); if (!lg) { host.innerHTML = needLogin(); return; }
    host.innerHTML = '<div class="acct"><img class="avatar" src="' + esc(lg.user.avatar) + '"><div><b>' + esc(lg.user.name) + '</b><div class="small">@' + esc(lg.user.login) + '</div></div><div class="grow"></div><button class="btn danger" data-act="g-logout">Keluar</button></div><h3 style="margin:16px 4px 8px">Game saya</h3><div id="mygames" class="small" style="padding:8px">Memuat...</div>';
    try {
      const r = await api('/user/repos?per_page=100&sort=updated&affiliation=owner');
      const mine = (r.data || []).filter(x => (x.topics || []).includes(TOPIC));
      $('#mygames').outerHTML = '<div class="proj-grid" id="mygames">' + (mine.length ? mine.map(i => card(i, true)).join('') : '<div class="empty-hint" style="grid-column:1/-1">Belum ada. Buka proyek lalu tekan Publish.</div>') + '</div>';
    } catch (e) { const el = $('#mygames'); if (el) el.textContent = 'Gagal: ' + e.message; }
  }

  const acts = {
    'g-login': async () => { await loginModal(); showHome(); },
    'g-logout': async () => { if (await askConfirm('Keluar dari GitHub di aplikasi ini?', 'Keluar')) { logout(); S.homeTab = 'proj'; showHome(); } },
    'g-play': b => playRemote(b.dataset.full, b.dataset.br),
    'g-reload': () => showHome(),
    'g-unlist': async b => {
      if (!await askConfirm('Hapus dari daftar Game? Repo di GitHub tetap ada (bisa kamu hapus sendiri di GitHub).', 'Hapus dari daftar')) return;
      try { const [o, r] = b.dataset.full.split('/'); await api('/repos/' + o + '/' + r + '/topics', { method: 'PUT', body: { names: [] } }); toast('Dihapus dari daftar'); showHome(); } catch (e) { toast('Gagal: ' + e.message, 4000); }
    }
  };
  return { login: loginModal, publish, renderGame, renderAkun, acts, getLogin, sanitize, packProject };
})();
Object.assign(ACTS, Game.acts);
