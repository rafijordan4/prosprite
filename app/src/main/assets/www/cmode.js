'use strict';
/* =====================================================================
   Cmode - bahasa pemrograman mini untuk ProSprite (file .cd)
   Sintaks mirip Python. Tidak memakai DOM, jadi aman dijalankan untuk game orang lain.
   ===================================================================== */
(function (G) {

class CmodeError extends Error {
  constructor(msg, line, file) { super(msg); this.cm = true; this.line = line || 0; this.file = file || ''; }
  pretty() { return (this.file ? this.file + ' ' : '') + (this.line ? 'baris ' + this.line + ': ' : '') + this.message; }
}

/* kata khusus berbahasa Indonesia -> kata khusus bawaan */
const ALIAS = { fungsi: 'def', jika: 'if', atau_jika: 'elif', lainnya: 'else', selama: 'while', untuk: 'for', dalam: 'in',
  kembali: 'return', lewati: 'pass', berhenti: 'break', lanjut: 'continue', dan: 'and', atau: 'or', bukan: 'not',
  benar: 'True', salah: 'False', kosong: 'None' };
const KW = new Set(['def', 'if', 'elif', 'else', 'while', 'for', 'in', 'return', 'pass', 'break', 'continue', 'and', 'or', 'not', 'True', 'False', 'None', 'kodule', 'impor']);
const ESC = { n: '\n', t: '\t', r: '\r', '0': '\0', '\\': '\\', '"': '"', "'": "'" };
const MAX_STEPS = 400000, MAX_DEPTH = 80;

/* hapus komentar: {-- ... --} (boleh banyak baris) dan # sampai akhir baris. Nomor baris dijaga. */
function strip(src, file) {
  let out = '', i = 0, line = 1, q = null;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (q) {
      if (c === '\\') { out += c + (src[i + 1] || ''); i += 2; continue; }
      if (c === q || c === '\n') q = null;
      if (c === '\n') line++;
      out += c; i++; continue;
    }
    if (c === '"' || c === "'") { q = c; out += c; i++; continue; }
    if (c === '#') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '{' && src[i + 1] === '-' && src[i + 2] === '-') {
      const e = src.indexOf('--}', i + 3);
      if (e < 0) throw new CmodeError('Komentar "{--" belum ditutup dengan "--}"', line, file);
      for (const ch of src.slice(i, e + 3)) { if (ch === '\n') { out += '\n'; line++; } }
      i = e + 3;
      // komentar di awal baris: buang spasi setelahnya supaya indentasi tidak bergeser
      if (!out.slice(out.lastIndexOf('\n') + 1).trim()) while (src[i] === ' ' || src[i] === '\t') i++;
      continue;
    }
    if (c === '\n') line++;
    out += c; i++;
  }
  return out;
}

function lex(src, file, baseLine) {
  const toks = [], n = src.length, ind = [0];
  let i = 0, line = baseLine || 1, depth = 0, bol = true;
  const err = m => { throw new CmodeError(m, line, file); };
  const push = (t, v, extra) => toks.push(Object.assign({ t, v, line }, extra || {}));
  const nameStart = ch => /[A-Za-z_À-￿]/.test(ch || '');
  const nameChar = ch => /[A-Za-z0-9_À-￿]/.test(ch || '');
  while (i < n) {
    if (bol && depth === 0) {
      let col = 0;
      while (i < n && (src[i] === ' ' || src[i] === '\t')) { col += src[i] === '\t' ? 4 - col % 4 : 1; i++; }
      if (i >= n) break;
      if (src[i] === '\r') { i++; continue; }
      if (src[i] === '\n') { i++; line++; continue; }
      if (col > ind[ind.length - 1]) { ind.push(col); push('INDENT'); }
      else {
        while (col < ind[ind.length - 1]) { ind.pop(); push('DEDENT'); }
        if (col !== ind[ind.length - 1]) err('Spasi di awal baris tidak rata dengan baris di atasnya (indentasi salah)');
      }
      bol = false;
    }
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '\n') { if (depth === 0) { push('NL'); bol = true; } i++; line++; continue; }
    if (c === '\\' && src[i + 1] === '\n') { i += 2; line++; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      let j = i;
      while (/[0-9_]/.test(src[j] || '')) j++;
      if (src[j] === '.' && /[0-9]/.test(src[j + 1] || '')) { j++; while (/[0-9]/.test(src[j] || '')) j++; }
      push('NUM', parseFloat(src.slice(i, j).replace(/_/g, ''))); i = j; continue;
    }
    const isF = c === 'f' && (src[i + 1] === '"' || src[i + 1] === "'");
    if (c === '"' || c === "'" || isF) {
      if (isF) i++;
      const q = src[i]; i++;
      let s = '';
      for (;;) {
        if (i >= n || src[i] === '\n') err('Teks belum ditutup: kurang tanda kutip ' + q);
        const ch = src[i];
        if (ch === q) { i++; break; }
        if (ch === '\\') { const e = src[i + 1]; s += ESC[e] !== undefined ? ESC[e] : e; i += 2; continue; }
        s += ch; i++;
      }
      push(isF ? 'FSTR' : 'STR', s); continue;
    }
    if (nameStart(c)) {
      let j = i + 1;
      while (nameChar(src[j])) j++;
      let w = src.slice(i, j);
      const prev = toks[toks.length - 1];
      const afterDot = prev && prev.t === 'OP' && prev.v === '.';
      if (!afterDot) { if (ALIAS[w]) w = ALIAS[w]; }
      push(!afterDot && KW.has(w) ? 'KW' : 'NAME', w); i = j; continue;
    }
    const two = src.substr(i, 2);
    if (['**', '//', '==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '%='].includes(two)) { push('OP', two); i += 2; continue; }
    if ('+-*/%<>=()[]{},:.'.includes(c)) {
      if ('([{'.includes(c)) depth++;
      if (')]}'.includes(c)) depth = Math.max(0, depth - 1);
      push('OP', c); i++; continue;
    }
    err('Karakter tidak dikenal: "' + c + '"');
  }
  if (toks.length && toks[toks.length - 1].t !== 'NL') push('NL');
  while (ind.length > 1) { ind.pop(); push('DEDENT'); }
  push('EOF');
  return toks;
}

const describe = t => t.t === 'NL' ? 'akhir baris' : t.t === 'EOF' ? 'akhir file' : t.t === 'INDENT' ? 'indentasi' : t.t === 'DEDENT' ? 'akhir blok' : '"' + t.v + '"';

class Parser {
  constructor(toks, file) { this.t = toks; this.p = 0; this.file = file; }
  peek() { return this.t[Math.min(this.p, this.t.length - 1)]; }
  err(msg, tok) { throw new CmodeError(msg, (tok || this.peek()).line, this.file); }
  isOp(v) { const t = this.peek(); return t.t === 'OP' && t.v === v; }
  isKw(v) { const t = this.peek(); return t.t === 'KW' && t.v === v; }
  acceptOp(v) { if (this.isOp(v)) { this.p++; return true; } return false; }
  expectOp(v, hint) { if (!this.acceptOp(v)) this.err('Seharusnya ada "' + v + '" tetapi ketemu ' + describe(this.peek()) + (hint ? ' ' + hint : '')); }
  name() { const t = this.peek(); if (t.t !== 'NAME') this.err('Seharusnya nama, tetapi ketemu ' + describe(t)); this.p++; return t.v; }

  program() {
    const body = [];
    while (this.peek().t !== 'EOF') {
      if (this.peek().t === 'NL') { this.p++; continue; }
      if (this.peek().t === 'INDENT') this.err('Baris ini menjorok ke dalam tanpa ada perintah pembuka (def/if/while/for) di atasnya');
      body.push(this.stmt());
    }
    return body;
  }
  endLine() {
    const t = this.peek();
    if (t.t === 'NL') { this.p++; return; }
    if (t.t === 'EOF' || t.t === 'DEDENT') return;
    this.err('Ada sisa yang tidak dikenali di akhir baris: ' + describe(t));
  }
  suite(kw) {
    this.expectOp(':', '(setelah "' + kw + '" harus ada titik dua)');
    if (this.peek().t === 'NL') {
      this.p++;
      while (this.peek().t === 'NL') this.p++;
      if (this.peek().t !== 'INDENT') this.err('Setelah "' + kw + ':" harus ada baris yang menjorok ke dalam (indentasi 4 spasi)');
      this.p++;
      const body = [];
      while (this.peek().t !== 'DEDENT' && this.peek().t !== 'EOF') {
        if (this.peek().t === 'NL') { this.p++; continue; }
        if (this.peek().t === 'INDENT') this.err('Indentasi tidak rata');
        body.push(this.stmt());
      }
      if (this.peek().t === 'DEDENT') this.p++;
      return body;
    }
    return [this.simple()];
  }
  stmt() {
    const t = this.peek();
    if (t.t === 'KW') {
      switch (t.v) {
        case 'def': return this.def();
        case 'if': return this.ifs();
        case 'while': { this.p++; const test = this.expr(); return { k: 'while', test, body: this.suite('while'), line: t.line }; }
        case 'for': {
          this.p++; const v = this.name();
          if (!this.isKw('in')) this.err('Perulangan for harus berbentuk: for nama in daftar:');
          this.p++; const it = this.expr();
          return { k: 'for', v, it, body: this.suite('for'), line: t.line };
        }
        case 'kodule': {
          this.p++; const name = this.name();
          if (this.isKw('impor')) this.p++;
          this.endLine(); return { k: 'import', name, line: t.line };
        }
        case 'return': {
          this.p++; let e = null;
          if (this.peek().t !== 'NL' && this.peek().t !== 'EOF' && this.peek().t !== 'DEDENT') e = this.expr();
          this.endLine(); return { k: 'return', e, line: t.line };
        }
        case 'pass': this.p++; this.endLine(); return { k: 'pass', line: t.line };
        case 'break': this.p++; this.endLine(); return { k: 'break', line: t.line };
        case 'continue': this.p++; this.endLine(); return { k: 'continue', line: t.line };
        case 'elif': case 'else': this.err('"' + t.v + '" tidak punya "if" di atasnya'); break;
        case 'impor': this.err('Penulisan yang benar: kodule nama impor'); break;
      }
    }
    return this.simple();
  }
  simple() {
    const t = this.peek();
    if (t.t === 'KW' && ['def', 'if', 'while', 'for', 'kodule', 'return', 'pass', 'break', 'continue'].includes(t.v)) return this.stmt();
    const e = this.expr();
    const o = this.peek();
    if (o.t === 'OP' && ['=', '+=', '-=', '*=', '/=', '%='].includes(o.v)) {
      this.p++;
      if (!['name', 'attr', 'index'].includes(e.k)) this.err('Sebelah kiri tanda "' + o.v + '" harus berupa nama variabel', o);
      const value = this.expr();
      this.endLine();
      return { k: 'assign', target: e, op: o.v, value, line: o.line };
    }
    this.endLine();
    return { k: 'expr', e, line: t.line };
  }
  def() {
    const line = this.peek().line; this.p++;
    const name = this.name();
    this.expectOp('(');
    const params = [];
    while (!this.isOp(')')) {
      const n = this.name(); let d = null;
      if (this.acceptOp('=')) d = this.expr();
      params.push({ n, d });
      if (!this.acceptOp(',')) break;
    }
    this.expectOp(')');
    return { k: 'def', name, params, body: this.suite('def'), line };
  }
  ifs() {
    const line = this.peek().line; this.p++;
    const tests = [this.expr()], blocks = [this.suite('if')];
    while (this.isKw('elif')) { this.p++; tests.push(this.expr()); blocks.push(this.suite('elif')); }
    let els = null;
    if (this.isKw('else')) { this.p++; els = this.suite('else'); }
    return { k: 'if', tests, blocks, els, line };
  }
  expr() {
    const a = this.orx();
    if (this.isKw('if')) {
      const line = this.peek().line; this.p++;
      const c = this.orx();
      if (!this.isKw('else')) this.err('Bentuk "x if kondisi else y" kurang "else"');
      this.p++;
      return { k: 'cond', c, a, b: this.expr(), line };
    }
    return a;
  }
  orx() { let a = this.andx(); while (this.isKw('or')) { const line = this.peek().line; this.p++; a = { k: 'or', a, b: this.andx(), line }; } return a; }
  andx() { let a = this.notx(); while (this.isKw('and')) { const line = this.peek().line; this.p++; a = { k: 'and', a, b: this.notx(), line }; } return a; }
  notx() { if (this.isKw('not')) { const line = this.peek().line; this.p++; return { k: 'not', a: this.notx(), line }; } return this.cmp(); }
  cmp() {
    const first = this.add(); const ops = [], items = [first]; let line = this.peek().line;
    for (;;) {
      const t = this.peek(); let op = null;
      if (t.t === 'OP' && ['==', '!=', '<', '>', '<=', '>='].includes(t.v)) { op = t.v; this.p++; }
      else if (this.isKw('in')) { op = 'in'; this.p++; }
      else if (this.isKw('not') && this.t[this.p + 1] && this.t[this.p + 1].t === 'KW' && this.t[this.p + 1].v === 'in') { op = 'not in'; this.p += 2; }
      else break;
      ops.push(op); items.push(this.add());
    }
    return ops.length ? { k: 'cmp', ops, items, line } : first;
  }
  add() {
    let a = this.mul();
    for (;;) { const t = this.peek(); if (t.t === 'OP' && (t.v === '+' || t.v === '-')) { this.p++; a = { k: 'bin', op: t.v, a, b: this.mul(), line: t.line }; } else return a; }
  }
  mul() {
    let a = this.unary();
    for (;;) { const t = this.peek(); if (t.t === 'OP' && ['*', '/', '//', '%'].includes(t.v)) { this.p++; a = { k: 'bin', op: t.v, a, b: this.unary(), line: t.line }; } else return a; }
  }
  unary() {
    const t = this.peek();
    if (t.t === 'OP' && (t.v === '-' || t.v === '+')) { this.p++; return { k: 'neg', op: t.v, a: this.unary(), line: t.line }; }
    return this.pow();
  }
  pow() {
    const a = this.postfix();
    const t = this.peek();
    if (t.t === 'OP' && t.v === '**') { this.p++; return { k: 'bin', op: '**', a, b: this.unary(), line: t.line }; }
    return a;
  }
  postfix() {
    let a = this.atom();
    for (;;) {
      const t = this.peek();
      if (t.t !== 'OP') return a;
      if (t.v === '(') {
        this.p++; const args = [];
        while (!this.isOp(')')) {
          args.push(this.expr());
          if (this.isOp('=')) this.err('Argumen bernama (nama=nilai) belum didukung, tulis nilainya berurutan');
          if (!this.acceptOp(',')) break;
        }
        this.expectOp(')', '(kurang kurung tutup)');
        a = { k: 'call', fn: a, args, line: t.line };
      } else if (t.v === '[') {
        this.p++; const idx = this.expr();
        if (this.isOp(':')) this.err('Potongan daftar a[1:3] belum didukung');
        this.expectOp(']');
        a = { k: 'index', o: a, i: idx, line: t.line };
      } else if (t.v === '.') {
        this.p++; a = { k: 'attr', o: a, n: this.name(), line: t.line };
      } else return a;
    }
  }
  atom() {
    const t = this.peek();
    switch (t.t) {
      case 'NUM': this.p++; return { k: 'const', v: t.v, line: t.line };
      case 'STR': this.p++; return { k: 'const', v: t.v, line: t.line };
      case 'FSTR': this.p++; return this.fstr(t);
      case 'KW':
        if (t.v === 'True') { this.p++; return { k: 'const', v: true, line: t.line }; }
        if (t.v === 'False') { this.p++; return { k: 'const', v: false, line: t.line }; }
        if (t.v === 'None') { this.p++; return { k: 'const', v: null, line: t.line }; }
        break;
      case 'NAME': this.p++; return { k: 'name', n: t.v, line: t.line };
      case 'OP':
        if (t.v === '(') {
          this.p++; const e = this.expr();
          if (this.isOp(',')) {
            const items = [e];
            while (this.acceptOp(',')) { if (this.isOp(')')) break; items.push(this.expr()); }
            this.expectOp(')'); return { k: 'list', items, line: t.line };
          }
          this.expectOp(')', '(kurang kurung tutup)'); return e;
        }
        if (t.v === '[') {
          this.p++; const items = [];
          while (!this.isOp(']')) { items.push(this.expr()); if (!this.acceptOp(',')) break; }
          this.expectOp(']'); return { k: 'list', items, line: t.line };
        }
        if (t.v === '{') {
          this.p++; const pairs = [];
          while (!this.isOp('}')) { const k = this.expr(); this.expectOp(':'); pairs.push([k, this.expr()]); if (!this.acceptOp(',')) break; }
          this.expectOp('}'); return { k: 'dict', pairs, line: t.line };
        }
        break;
    }
    this.err('Ekspresi tidak lengkap, ketemu ' + describe(t) + ' di tempat yang tidak semestinya');
  }
  fstr(t) {
    const s = t.v, parts = [];
    let buf = '', i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === '{' && s[i + 1] === '{') { buf += '{'; i += 2; continue; }
      if (c === '}' && s[i + 1] === '}') { buf += '}'; i += 2; continue; }
      if (c === '{') {
        let d = 1, j = i + 1, q = null;
        while (j < s.length && d > 0) {
          const ch = s[j];
          if (q) { if (ch === q) q = null; } else if (ch === '"' || ch === "'") q = ch; else if (ch === '{') d++; else if (ch === '}') d--;
          j++;
        }
        if (d) this.err('Tanda { di dalam teks f"..." belum ditutup', t);
        if (buf) { parts.push(buf); buf = ''; }
        parts.push(parseExprSource(s.slice(i + 1, j - 1), this.file, t.line));
        i = j; continue;
      }
      buf += c; i++;
    }
    if (buf) parts.push(buf);
    return { k: 'fstr', parts, line: t.line };
  }
}

function parseExprSource(code, file, line) {
  const p = new Parser(lex(strip(code, file), file, line), file);
  const e = p.expr();
  if (p.peek().t !== 'NL' && p.peek().t !== 'EOF') p.err('Ekspresi di dalam {} tidak dikenali');
  return e;
}

/* ------------------------- nilai & bantuan ------------------------- */
class CFunc { constructor(node, rt) { this.node = node; this.rt = rt; this.name = node.name; } }
class Sig { constructor(type, v) { this.type = type; this.v = v; } }
const BRK = new Sig('b'), CNT = new Sig('c');

const isNum = v => typeof v === 'number';
function truthy(v) {
  if (v === null || v === undefined || v === false || v === 0 || v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  if (v instanceof Map) return v.size > 0;
  return true;
}
function eq(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => eq(x, b[i]));
  return a === b || (a === undefined && b === null) || (a === null && b === undefined);
}
function repr(v) { return typeof v === 'string' ? JSON.stringify(v) : show(v); }
function show(v) {
  if (v === null || v === undefined) return 'None';
  if (v === true) return 'True';
  if (v === false) return 'False';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(+v.toFixed(6));
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return '[' + v.map(repr).join(', ') + ']';
  if (v instanceof Map) return '{' + [...v].map(([k, x]) => repr(k) + ': ' + repr(x)).join(', ') + '}';
  if (v instanceof CFunc) return '<fungsi ' + v.name + '>';
  if (typeof v === 'function') return '<fungsi bawaan>';
  return '<kodule>';
}
const typeName = v => v === null || v === undefined ? 'None' : isNum(v) ? 'angka' : typeof v === 'string' ? 'teks' : typeof v === 'boolean' ? 'True/False' : Array.isArray(v) ? 'daftar' : v instanceof Map ? 'kamus' : 'fungsi/kodule';

const ARR = {
  append: (s, x) => { s.push(x); return null; }, tambah: (s, x) => { s.push(x); return null; },
  pop: (s, i) => { if (!s.length) throw new Error('Daftar kosong, tidak ada yang bisa di-pop'); return i === undefined ? s.pop() : s.splice(i < 0 ? s.length + i : i, 1)[0]; },
  insert: (s, i, x) => { s.splice(i, 0, x); return null; },
  remove: (s, x) => { const i = s.findIndex(y => eq(x, y)); if (i >= 0) s.splice(i, 1); return null; },
  index: (s, x) => s.findIndex(y => eq(x, y)),
  count: (s, x) => s.filter(y => eq(x, y)).length,
  sort: s => { s.sort((a, b) => a < b ? -1 : a > b ? 1 : 0); return null; },
  reverse: s => { s.reverse(); return null; }
};
const STR = {
  upper: s => s.toUpperCase(), lower: s => s.toLowerCase(), strip: s => s.trim(),
  split: (s, d) => d === undefined ? s.split(/\s+/).filter(Boolean) : s.split(d),
  replace: (s, a, b) => s.split(a).join(b), startswith: (s, x) => s.startsWith(x), endswith: (s, x) => s.endsWith(x),
  find: (s, x) => s.indexOf(x), join: (s, arr) => arr.map(show).join(s)
};
const MAP = {
  get: (m, k, d) => m.has(k) ? m.get(k) : (d === undefined ? null : d),
  keys: m => [...m.keys()], values: m => [...m.values()], has: (m, k) => m.has(k)
};

const BUILTINS = {
  print: (...a) => { Cmode.print(a.map(show).join(' ')); return null; },
  len: x => { if (typeof x === 'string' || Array.isArray(x)) return x.length; if (x instanceof Map) return x.size; throw new Error('len() hanya untuk teks, daftar, atau kamus'); },
  str: x => show(x),
  int: x => { const n = typeof x === 'string' ? parseFloat(x) : Number(x); if (Number.isNaN(n)) throw new Error('Tidak bisa mengubah ' + repr(x) + ' jadi angka bulat'); return Math.trunc(n); },
  float: x => { const n = parseFloat(x); if (Number.isNaN(n)) throw new Error('Tidak bisa mengubah ' + repr(x) + ' jadi angka'); return n; },
  bool: x => truthy(x),
  abs: x => Math.abs(x),
  round: (x, d) => { const f = Math.pow(10, d || 0); return Math.round(x * f) / f; },
  min: (...a) => Math.min(...(a.length === 1 && Array.isArray(a[0]) ? a[0] : a)),
  max: (...a) => Math.max(...(a.length === 1 && Array.isArray(a[0]) ? a[0] : a)),
  sum: a => a.reduce((x, y) => x + y, 0),
  range: (a, b, c) => {
    let s = 0, e = a, st = 1;
    if (b !== undefined) { s = a; e = b; } if (c !== undefined) st = c;
    if (!st) throw new Error('Langkah range() tidak boleh 0');
    const out = [];
    for (let i = s; st > 0 ? i < e : i > e; i += st) { out.push(i); if (out.length > 200000) throw new Error('range() terlalu besar'); }
    return out;
  }
};
BUILTINS.cetak = BUILTINS.print; BUILTINS.panjang = BUILTINS.len; BUILTINS.teks_dari = BUILTINS.str;
BUILTINS.angka = BUILTINS.float; BUILTINS.bulat = BUILTINS.int; BUILTINS.jangkauan = BUILTINS.range;

/* ------------------------- penjalan program ------------------------- */
class Runtime {
  constructor(prog, host) {
    this.prog = prog; this.file = prog.file; this.host = host; this.g = new Map(); this.depth = 0;
  }
  err(msg, line) { return new CmodeError(msg, line, this.file); }
  enter(fn) {
    const prev = Cmode.cur;
    if (!prev) Cmode.steps = 0;
    Cmode.cur = this;
    try { return fn(); } finally { Cmode.cur = prev; this.depth = 0; }
  }
  run() { return this.enter(() => { this.block(this.prog.body, { loc: null }); }); }
  has(name) { return this.g.get(name) instanceof CFunc; }
  call(name, args) {
    const f = this.g.get(name);
    if (!(f instanceof CFunc)) return undefined;
    return this.enter(() => this.callFunc(f, args || [], f.node.line));
  }
  callValue(v, args) {
    return this.enter(() => {
      if (typeof v === 'string') { const f = this.g.get(v); if (!(f instanceof CFunc)) throw this.err('Fungsi "' + v + '" tidak ditemukan', 0); return this.callFunc(f, args || [], 0); }
      return this.invoke(v, args || [], 0);
    });
  }
  tick(line) { if (++Cmode.steps > MAX_STEPS) throw this.err('Program terlalu lama berjalan (kemungkinan perulangan tanpa akhir). Dihentikan.', line); }

  block(list, env) {
    for (const s of list) { const r = this.st(s, env); if (r) return r; }
    return undefined;
  }
  setName(name, v, env) {
    if (!env.loc) { this.g.set(name, v); return; }
    if (env.loc.has(name)) env.loc.set(name, v);
    else if (this.g.has(name)) this.g.set(name, v);
    else env.loc.set(name, v);
  }
  lookup(name, env, line) {
    if (env.loc && env.loc.has(name)) return env.loc.get(name);
    if (this.g.has(name)) return this.g.get(name);
    if (Object.prototype.hasOwnProperty.call(BUILTINS, name)) return BUILTINS[name];
    if (this.host.modules && this.host.modules[name]) throw this.err('Kodule "' + name + '" belum di-impor. Tulis di bagian atas file: kodule ' + name + ' impor', line);
    throw this.err('Nama "' + name + '" belum dibuat. Beri nilai dulu, misalnya: ' + name + ' = 0', line);
  }
  st(s, env) {
    this.tick(s.line);
    switch (s.k) {
      case 'expr': this.ev(s.e, env); return;
      case 'assign': {
        let v = this.ev(s.value, env);
        const t = s.target;
        if (s.op !== '=') v = this.binop(s.op.slice(0, -1), this.ev(t, env), v, s.line);
        if (t.k === 'name') this.setName(t.n, v, env);
        else if (t.k === 'attr') this.setAttr(this.ev(t.o, env), t.n, v, s.line);
        else this.setIndex(this.ev(t.o, env), this.ev(t.i, env), v, s.line);
        return;
      }
      case 'if':
        for (let i = 0; i < s.tests.length; i++) if (truthy(this.ev(s.tests[i], env))) return this.block(s.blocks[i], env);
        if (s.els) return this.block(s.els, env);
        return;
      case 'while':
        while (truthy(this.ev(s.test, env))) {
          this.tick(s.line);
          const r = this.block(s.body, env);
          if (r) { if (r === BRK) break; if (r === CNT) continue; return r; }
        }
        return;
      case 'for': {
        let it = this.ev(s.it, env);
        if (it instanceof Map) it = [...it.keys()]; else if (typeof it === 'string') it = [...it];
        if (!Array.isArray(it)) throw this.err('Setelah "in" harus berupa daftar, teks, atau range(...), bukan ' + typeName(it), s.line);
        for (const x of it.slice()) {
          this.tick(s.line);
          this.setName(s.v, x, env);
          const r = this.block(s.body, env);
          if (r) { if (r === BRK) break; if (r === CNT) continue; return r; }
        }
        return;
      }
      case 'def': this.setName(s.name, new CFunc(s, this), env); return;
      case 'return': return new Sig('r', s.e ? this.ev(s.e, env) : null);
      case 'pass': return;
      case 'break': return BRK;
      case 'continue': return CNT;
      case 'import': {
        const m = this.host.modules && this.host.modules[s.name];
        if (!m) {
          const names = Object.keys(this.host.modules || {});
          const near = names.filter(n => n.startsWith(s.name.slice(0, 2)) || s.name.startsWith(n.slice(0, 2))).slice(0, 5);
          throw this.err('Kodule "' + s.name + '" tidak ada.' + (near.length ? ' Mungkin maksudmu: ' + near.join(', ') : '') + ' (daftar lengkap ada di Tutorial)', s.line);
        }
        this.g.set(s.name, m); return;
      }
    }
  }
  callFunc(f, args, line) {
    if (++this.depth > MAX_DEPTH) { this.depth = 0; throw this.err('Fungsi memanggil dirinya terlalu dalam (rekursi tanpa akhir?)', line); }
    const ps = f.node.params;
    if (args.length > ps.length) throw this.err('Fungsi ' + f.name + ' menerima ' + ps.length + ' nilai, tapi diberi ' + args.length, line);
    const loc = new Map();
    for (let i = 0; i < ps.length; i++) {
      if (i < args.length) loc.set(ps[i].n, args[i]);
      else if (ps[i].d) loc.set(ps[i].n, this.ev(ps[i].d, { loc: null }));
      else throw this.err('Fungsi ' + f.name + ' butuh nilai untuk "' + ps[i].n + '"', line);
    }
    const r = this.block(f.node.body, { loc });
    this.depth--;
    return r && r.type === 'r' ? r.v : null;
  }
  invoke(fn, args, line) {
    if (fn instanceof CFunc) return fn.rt === this ? this.callFunc(fn, args, line) : fn.rt.enter(() => fn.rt.callFunc(fn, args, line));
    if (typeof fn === 'function') {
      try { const r = fn(...args); return r === undefined ? null : r; }
      catch (e) { if (e && e.cm) throw e; throw this.err(String(e && e.message || e), line); }
    }
    throw this.err('Ini bukan fungsi sehingga tidak bisa dipanggil: ' + show(fn), line);
  }
  getattr(o, n, line) {
    if (o !== null && typeof o === 'object' && Object.getPrototypeOf(o) === null) {
      if (n in o) return o[n];
      throw this.err('Kodule ini tidak punya "' + n + '". Fungsi yang ada: ' + Object.keys(o).slice(0, 14).join(', '), line);
    }
    let tbl = null;
    if (Array.isArray(o)) tbl = ARR; else if (typeof o === 'string') tbl = STR; else if (o instanceof Map) tbl = MAP;
    if (tbl && Object.prototype.hasOwnProperty.call(tbl, n)) return (...a) => tbl[n](o, ...a);
    throw this.err('"' + n + '" tidak ada pada ' + typeName(o), line);
  }
  setAttr(o, n, v, line) {
    if (o !== null && typeof o === 'object' && Object.getPrototypeOf(o) === null) {
      const d = Object.getOwnPropertyDescriptor(o, n);
      if (d && d.set) { o[n] = v; return; }
      throw this.err('"' + n + '" pada kodule ini tidak bisa diisi langsung', line);
    }
    throw this.err('Hanya properti kodule yang bisa diisi, misalnya idle.anim = "Diam"', line);
  }
  getindex(o, i, line) {
    if (Array.isArray(o) || typeof o === 'string') {
      if (!isNum(i)) throw this.err('Nomor urut harus angka', line);
      const k = i < 0 ? o.length + i : i;
      if (k < 0 || k >= o.length) throw this.err('Nomor urut ' + i + ' di luar jangkauan (panjangnya ' + o.length + ')', line);
      return o[k];
    }
    if (o instanceof Map) { if (!o.has(i)) throw this.err('Kunci ' + repr(i) + ' tidak ada di kamus', line); return o.get(i); }
    throw this.err('Tanda [ ] tidak bisa dipakai pada ' + typeName(o), line);
  }
  setIndex(o, i, v, line) {
    if (Array.isArray(o)) { const k = i < 0 ? o.length + i : i; if (!isNum(k) || k < 0 || k >= o.length) throw this.err('Nomor urut ' + i + ' di luar jangkauan', line); o[k] = v; return; }
    if (o instanceof Map) { o.set(i, v); return; }
    throw this.err('Isi lewat [ ] hanya untuk daftar dan kamus', line);
  }
  binop(op, a, b, line) {
    if (op === '+') {
      if (isNum(a) && isNum(b)) return a + b;
      if (typeof a === 'string' || typeof b === 'string') return show(a) + show(b);
      if (Array.isArray(a) && Array.isArray(b)) return a.concat(b);
    }
    if (op === '*') {
      if (isNum(a) && isNum(b)) return a * b;
      if (typeof a === 'string' && isNum(b)) return a.repeat(Math.max(0, Math.min(1000, b)));
      if (Array.isArray(a) && isNum(b)) { let o = []; for (let i = 0; i < Math.min(1000, b); i++) o = o.concat(a); return o; }
    }
    if (isNum(a) && isNum(b)) {
      switch (op) {
        case '-': return a - b;
        case '/': if (b === 0) throw this.err('Tidak bisa dibagi nol', line); return a / b;
        case '//': if (b === 0) throw this.err('Tidak bisa dibagi nol', line); return Math.floor(a / b);
        case '%': if (b === 0) throw this.err('Tidak bisa dibagi nol', line); return ((a % b) + b) % b;
        case '**': return Math.pow(a, b);
      }
    }
    throw this.err('Operasi "' + op + '" tidak bisa dipakai antara ' + typeName(a) + ' dan ' + typeName(b), line);
  }
  compare(op, a, b, line) {
    switch (op) {
      case '==': return eq(a, b);
      case '!=': return !eq(a, b);
      case 'in':
        if (Array.isArray(b)) return b.some(x => eq(a, x));
        if (typeof b === 'string') return b.includes(show(a));
        if (b instanceof Map) return b.has(a);
        throw this.err('"in" hanya untuk daftar, teks, atau kamus', line);
      case 'not in': return !this.compare('in', a, b, line);
    }
    if ((isNum(a) && isNum(b)) || (typeof a === 'string' && typeof b === 'string')) {
      return op === '<' ? a < b : op === '>' ? a > b : op === '<=' ? a <= b : a >= b;
    }
    throw this.err('Tidak bisa membandingkan ' + typeName(a) + ' dengan ' + typeName(b) + ' memakai "' + op + '"', line);
  }
  ev(n, env) {
    switch (n.k) {
      case 'const': return n.v;
      case 'name': return this.lookup(n.n, env, n.line);
      case 'fstr': return n.parts.map(p => typeof p === 'string' ? p : show(this.ev(p, env))).join('');
      case 'list': return n.items.map(x => this.ev(x, env));
      case 'dict': { const m = new Map(); for (const [k, v] of n.pairs) m.set(this.ev(k, env), this.ev(v, env)); return m; }
      case 'neg': { const v = this.ev(n.a, env); if (!isNum(v)) throw this.err('Tanda ' + n.op + ' hanya untuk angka', n.line); return n.op === '-' ? -v : v; }
      case 'not': return !truthy(this.ev(n.a, env));
      case 'and': { const a = this.ev(n.a, env); return truthy(a) ? this.ev(n.b, env) : a; }
      case 'or': { const a = this.ev(n.a, env); return truthy(a) ? a : this.ev(n.b, env); }
      case 'cond': return truthy(this.ev(n.c, env)) ? this.ev(n.a, env) : this.ev(n.b, env);
      case 'bin': return this.binop(n.op, this.ev(n.a, env), this.ev(n.b, env), n.line);
      case 'cmp': {
        let l = this.ev(n.items[0], env);
        for (let i = 0; i < n.ops.length; i++) {
          const r = this.ev(n.items[i + 1], env);
          if (!this.compare(n.ops[i], l, r, n.line)) return false;
          l = r;
        }
        return true;
      }
      case 'attr': return this.getattr(this.ev(n.o, env), n.n, n.line);
      case 'index': return this.getindex(this.ev(n.o, env), this.ev(n.i, env), n.line);
      case 'call': {
        this.tick(n.line);
        const fn = this.ev(n.fn, env);
        const args = n.args.map(a => this.ev(a, env));
        return this.invoke(fn, args, n.line);
      }
    }
    throw this.err('Kesalahan internal: ' + n.k, n.line);
  }
}

const Cmode = {
  CmodeError, Runtime, CFunc, show, truthy, cur: null, steps: 0,
  print: s => { if (G.console) console.log('[cmode]', s); },
  compile(src, file) {
    file = file || 'kode.cd';
    const body = new Parser(lex(strip(String(src), file), file), file).program();
    return { body, file };
  },
  /* untuk editor: kembalikan null kalau sintaks benar, atau {line, message} */
  check(src, file) {
    try { Cmode.compile(src, file); return null; }
    catch (e) { return e && e.cm ? { line: e.line, message: e.message } : { line: 0, message: String(e && e.message || e) }; }
  },
  /* bungkus nilai callback (fungsi Cmode atau nama fungsi) supaya bisa dipanggil nanti dari JS */
  cb(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'string') {
      const rt = Cmode.cur;
      if (!rt) throw new Error('Nama fungsi hanya bisa dipakai dari dalam program');
      return (...a) => rt.callValue(v, a);
    }
    if (v instanceof CFunc) return (...a) => v.rt.callValue(v, a);
    if (typeof v === 'function') return v;
    throw new Error('Butuh fungsi (atau nama fungsi dalam tanda kutip), bukan ' + typeName(v));
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = Cmode; else G.Cmode = Cmode;
})(typeof window !== 'undefined' ? window : globalThis);
