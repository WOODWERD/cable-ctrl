// Cable Ctrl rules. No page code here: everything in this file is tested by CC-A ID.

export const PHI = 1.6180339887;
export const SHEET = { W: 90, H: 170 };
export const FLOOR_MM = 1.2; // provisional legibility floor (CC-R16, Q5)
export const MAX_LABELS = 500;
export const MAX_FILE = 5 * 1024 * 1024;

export const RANGES = {
  H: { min: 8, max: 24, name: 'Tab height' },
  d: { min: 2, max: 9, name: 'Max cable ⌀' },
  s: { min: 0, max: 4, name: 'Slack' },
  B: { min: 0, max: 3, name: 'Cut border' },
  G: { min: 1, max: 12, name: 'Space between cuts' },
};
export const DEFAULTS = { H: 10, d: 7, s: 1.5, B: 1.5, G: 4 };

export const PALETTE = [
  { name: 'Gold', hex: '#E3AE00' }, { name: 'Red', hex: '#D1492F' }, { name: 'Blue', hex: '#3A93C9' },
  { name: 'Green', hex: '#1F6B3F' }, { name: 'Purple', hex: '#7A4FA0' }, { name: 'Charcoal', hex: '#2B2D31' },
];
const hex = (n) => PALETTE.find((p) => p.name === n).hex;
const OTHER = 'other';

export const startTypes = () => [
  { id: 'usb', name: 'USB', color: hex('Gold') }, { id: 'ethernet', name: 'Ethernet', color: hex('Blue') },
  { id: 'hdmi', name: 'HDMI', color: hex('Purple') }, { id: 'power', name: 'Power', color: hex('Green') },
  { id: OTHER, name: 'Other', color: hex('Charcoal') },
];

// Generic on purpose: the repo is public (CC-R53)
export const exampleLabels = () => [
  { l1: 'USB · DOCK', l2: 'Dock → Laptop', typeId: 'usb', qty: 2 },
  { l1: 'ETH · DESK', l2: 'Router → Desk', typeId: 'ethernet', qty: 2 },
  { l1: 'ETH · TV', l2: 'Switch → TV', typeId: 'ethernet', qty: 2 },
  { l1: 'HDMI · TV', l2: 'Box → TV', typeId: 'hdmi', qty: 2 },
  { l1: 'PWR · DESK', l2: 'Strip → Monitor', typeId: 'power', qty: 2 },
  { l1: '', l2: '', typeId: OTHER, qty: 2 },
];

// ---------- geometry (CC-R03 to CC-R10) ----------
export function geom({ H, d, s }) {
  const P = H * PHI, N = H / PHI, W = Math.PI * d + s, L = 2 * P + W;
  return { H, d, P, N, W, L, T: Math.min(N, W * 0.4), band: 0.2 * H };
}

// Draws the outline through a canvas-like api. ins = inset in mm.
export function trace(api, g, ox, oy, k, ins = 0) {
  const h = g.H / 2 - ins, n = g.N / 2 - ins, a = g.P, b = g.P + g.W, R = Math.max(0.2, 0.15 * g.H - ins), T = g.T, t = T / 2;
  const X = (x) => ox + x * k, Y = (y) => oy + y * k;
  const M = (x, y) => api.moveTo(X(x), Y(y)), Ln = (x, y) => api.lineTo(X(x), Y(y));
  const Q = (cx, cy, x, y) => api.quadraticCurveTo(X(cx), Y(cy), X(x), Y(y));
  const C = (c1x, c1y, c2x, c2y, x, y) => api.bezierCurveTo(X(c1x), Y(c1y), X(c2x), Y(c2y), X(x), Y(y));
  const x0 = ins, L = g.L - ins;
  M(x0 + R, -h); Ln(a, -h); C(a + t, -h, a + t, -n, a + T, -n); Ln(b - T, -n); C(b - t, -n, b - t, -h, b, -h);
  Ln(L - R, -h); Q(L, -h, L, -h + R); Ln(L, h - R); Q(L, h, L - R, h);
  Ln(b, h); C(b - t, h, b - t, n, b - T, n); Ln(a + T, n); C(a + t, n, a + t, h, a, h);
  Ln(x0 + R, h); Q(x0, h, x0, h - R); Ln(x0, -h + R); Q(x0, -h, x0 + R, -h); api.closePath();
}

export function svgPath(g, ox, oy, k, ins = 0) {
  let d = ''; const f = (n) => n.toFixed(2);
  trace({
    moveTo: (x, y) => { d += `M${f(x)} ${f(y)}`; }, lineTo: (x, y) => { d += `L${f(x)} ${f(y)}`; },
    quadraticCurveTo: (a, b, x, y) => { d += `Q${f(a)} ${f(b)} ${f(x)} ${f(y)}`; },
    bezierCurveTo: (a, b, c, e, x, y) => { d += `C${f(a)} ${f(b)} ${f(c)} ${f(e)} ${f(x)} ${f(y)}`; },
    closePath: () => { d += 'Z'; },
  }, g, ox, oy, k, ins);
  return d;
}

// ---------- sheets (CC-R30 to CC-R33) ----------
export const margin = (B) => Math.max(2, B);

export function capacity(g, { B, G }) {
  const m = margin(B);
  const fit = (w, h) => {
    const cols = Math.max(0, Math.floor((SHEET.W - 2 * m + G) / (w + G)));
    const rows = Math.max(0, Math.floor((SHEET.H - 2 * m + G) / (h + G)));
    return { cols, rows, n: cols * rows, w, h };
  };
  const flat = fit(g.L, g.H), up = fit(g.H, g.L);
  return up.n > flat.n ? { ...up, rot: true } : { ...flat, rot: false };
}

export const clampQty = (q) => Math.max(0, Math.min(99, Math.round(+q || 0)));

export function tabList(labels) {
  const out = [];
  labels.forEach((l) => { for (let i = 0; i < clampQty(l.qty); i++) out.push(l); });
  return out;
}

// Sheet rows for the list: dividers, splits and the running total (CC-R33)
export function sheetMarks(labels, per) {
  const qs = labels.map((l) => clampQty(l.qty));
  const total = qs.reduce((a, b) => a + b, 0);
  const marks = labels.map(() => ({ before: '', split: '' }));
  if (!per || !total) return { marks, total, sheets: 0, open: 0 };
  let cum = 0, seen = 0;
  qs.forEach((q, i) => {
    if (!q) return;
    const start = cum, end = cum + q;
    if (start % per === 0) marks[i].before = `Sheet ${start / per + 1}`;
    const next = Math.ceil((start + 1) / per) * per;
    if (next < end) marks[i].split = `Splits onto sheet ${next / per + 1}: ${next - start} before, ${end - next} after`;
    cum = end; seen++;
  });
  const sheets = Math.ceil(total / per);
  return { marks, total, sheets, open: sheets * per - total };
}

// ---------- what can print (CC-R80 to CC-R85) ----------
const down = (n) => Math.floor(n * 10 + 1e-9) / 10;
const up = (n) => Math.ceil(n * 10 - 1e-9) / 10;

export function rangeError(key, raw) {
  const r = RANGES[key], v = parseFloat(raw);
  if (!isFinite(v) || v < r.min || v > r.max) return `${r.name} can't be ${String(raw).trim() || 'empty'}. Enter ${r.min} to ${r.max} mm.`;
  return '';
}

export const isDefault = (inputs) => Object.keys(DEFAULTS).every((k) => inputs[k] === DEFAULTS[k]);

export function checkDesign(inputs) {
  const g = geom(inputs), cap = capacity(g, inputs), { H, B, G } = inputs, limit = g.N / 2 - 0.5;
  const cant = [];
  if (cap.n === 0) cant.push('This tab is too long for the sheet. Lower Tab height or Max cable ⌀.');
  if (B > limit + 1e-9) {
    const raise = up(PHI * (2 * B + 1));
    cant.push(`With a ${B} mm border, ${[8, 11, 18].includes(Math.floor(H)) ? 'an' : 'a'} ${H} mm tab has no printed neck left. Lower Cut border to ${down(limit)}${raise <= RANGES.H.max ? `, or raise Tab height to ${raise}` : ''}.`);
  }
  const notes = [];
  if (G < 4) notes.push('Space between cuts is under the tested 4 mm. Raise it to 4, or print one sheet to check.');
  if (g.N < 6.18) notes.push('This neck is narrower than any test print. Raise Tab height to 10, or print one tab to check.');
  if (Math.abs(B - 1.5) > 1e-9) notes.push(`A ${B} mm cut border hasn't been test printed. Set it to 1.5, or print one tab to check.`);
  if (inputs.s < 1) notes.push('Slack under 1 mm makes the wrap tight. Raise it to 1.5, or print one tab to check.');
  if (H < inputs.d) notes.push(`This tab is narrower than the cable is thick. Raise Tab height to ${inputs.d}.`);
  if (g.N > g.W) notes.push(`This flag is big for a thin cable and may droop. Lower Tab height to ${down(PHI * g.W)}, or raise Max cable ⌀.`);
  const per = cap.n;
  const verdict = cant.length ? "Can't print" : notes.length ? `Prints · ${notes.length} note${notes.length === 1 ? '' : 's'}` : `Prints · ${per} per sheet`;
  return { g, cap, per, cant, notes, verdict, ok: !cant.length };
}

// ---------- text (CC-R14 to CC-R21) ----------
const SHORT = [[/<->/g, '↔'], [/->/g, '→'], [/<-/g, '←'], [/\*/g, '·']];
export const fixSymbols = (t) => SHORT.reduce((s, [re, ch]) => s.replace(re, ch), String(t));

export function faces(g, B) {
  const mg = 0.1 * g.H;
  return [[B + g.band + mg, g.P - mg], [g.P + g.W + mg, g.L - B - g.band - mg]];
}

// measure(text, weight) gives width in ems. Sizes are in mm.
export function textLayout(l1Raw, l2Raw, g, B, measure) {
  const l1 = String(l1Raw || '').trim().toUpperCase(), l2 = String(l2Raw || '').trim();
  const [[a, b]] = faces(g, B), wide = b - a, HP = g.H - 2 * B;
  const fit = (t, w, max) => Math.min(max, wide / (measure(t, w) || 1));
  const out = { l1, l2, s1: 0, s2: 0, y1: 0, y2: 0, small: '' };
  if (l1 && l2) {
    out.s1 = fit(l1, 700, 0.3 * HP); out.s2 = fit(l2, 600, 0.19 * HP);
    out.y1 = -0.02 * HP; out.y2 = 0.25 * HP;
  } else if (l1 || l2) {
    const t = l1 || l2, w = l1 ? 700 : 600, s = fit(t, w, 0.42 * HP);
    if (l1) { out.s1 = s; out.y1 = s * 0.36; } else { out.s2 = s; out.y2 = s * 0.36; }
  }
  if (l1 && out.s1 < FLOOR_MM) out.small = 'Line 1';
  else if (l2 && out.s2 < FLOOR_MM) out.small = 'Line 2';
  return out;
}

// ---------- types (CC-R24 to CC-R29) ----------
export const slug = () => 't' + Math.random().toString(36).slice(2, 9);

export function nextColour(types) {
  const used = new Set(types.map((t) => t.color.toUpperCase()));
  return (PALETTE.find((p) => !used.has(p.hex)) || PALETTE[5]).hex;
}

export function removeType(state, id) {
  if (id === OTHER) return 0;
  let moved = 0;
  state.labels.forEach((l) => { if (l.typeId === id) { l.typeId = OTHER; moved++; } });
  state.types = state.types.filter((t) => t.id !== id);
  return moved;
}

export const typeNameError = (types, name, id) => {
  const n = String(name).trim();
  if (!n) return 'A type needs a name.';
  if (n.length > 16) return 'A type name holds up to 16 characters.';
  if (types.some((t) => t.id !== id && t.name.toLowerCase() === n.toLowerCase())) return `There's already a type called ${n}.`;
  return '';
};

// ---------- numbered runs (CC-R60 to CC-R64) ----------
export function runNumbers(start, count) {
  const hi = start + count - 1, width = Math.max(2, String(hi).length);
  return Array.from({ length: count }, (_, i) => String(start + i).padStart(width, '0'));
}

export function nextStart(labels, prefix) {
  const p = prefix.toUpperCase(); let top = 0;
  labels.forEach((l) => {
    const t = (l.l1 || '').toUpperCase();
    if (t.startsWith(p)) { const m = t.slice(p.length).match(/^\d+$/); if (m) top = Math.max(top, +m[0]); }
  });
  return top + 1;
}

export function makeRun({ prefix, start, count, perNumber, typeId }) {
  return runNumbers(start, count).map((n) => ({ l1: `${prefix}${n}`, l2: '', typeId, qty: perNumber }));
}

export function runClashes(labels, run) {
  const have = new Set(labels.map((l) => (l.l1 || '').toUpperCase()));
  return run.filter((r) => have.has(r.l1.toUpperCase())).map((r) => r.l1);
}

// ---------- spreadsheets (CC-R65 to CC-R71) ----------
export function parseCsv(text) {
  const t = String(text).replace(/^﻿/, ''), rows = []; let row = [], cell = '', q = false;
  const delim = (t.split('\n')[0].match(/;/g) || []).length > (t.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export const BAD_COLUMNS = "That file has no Line 1 or Line 2 column.";

// Turns a table into candidate labels, skipping and naming rows that break a rule.
export function readTable(table) {
  const head = (table[0] || []).map((h) => String(h).trim().toLowerCase());
  const col = (n) => head.indexOf(n), c1 = col('line 1'), c2 = col('line 2'), ct = col('type'), cq = col('quantity');
  if (c1 < 0 && c2 < 0) return { error: BAD_COLUMNS, rows: [], skipped: [] };
  const rows = [], skipped = [];
  table.slice(1).forEach((r, i) => {
    const n = i + 2, get = (k) => (k < 0 ? '' : String(r[k] ?? '').trim());
    if (!r.some((v) => String(v ?? '').trim())) return;
    const l1 = fixSymbols(get(c1)), l2 = fixSymbols(get(c2)), type = get(ct), q = get(cq);
    if (l1.length > 24) return skipped.push(`Row ${n}: Line 1 is over 24 characters.`);
    if (l2.length > 36) return skipped.push(`Row ${n}: Line 2 is over 36 characters.`);
    if (type.length > 16) return skipped.push(`Row ${n}: Type is over 16 characters.`);
    const qty = q === '' ? 2 : Number(q);
    if (!Number.isInteger(qty) || qty < 0 || qty > 99) return skipped.push(`Row ${n}: Quantity must be a whole number from 0 to 99.`);
    rows.push({ l1, l2, type, qty });
  });
  return { rows, skipped };
}

// Works out the labels and any new types. Nothing changes until the result is applied.
export function planImport(state, read) {
  const types = state.types.map((t) => ({ ...t })), added = [];
  const labels = read.rows.map((r) => {
    let t = r.type ? types.find((x) => x.name.toLowerCase() === r.type.toLowerCase()) : types.find((x) => x.id === OTHER);
    if (!t) { t = { id: slug(), name: r.type, color: nextColour(types) }; types.push(t); added.push(t.name); }
    return { l1: r.l1, l2: r.l2, typeId: t.id, qty: r.qty };
  });
  return { labels, types, added, skipped: read.skipped };
}

// ---------- .xlsx, read locally with no library ----------
const decode = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

async function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzip(buf) {
  const v = new DataView(buf), u8 = new Uint8Array(buf); let e = buf.byteLength - 22;
  while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('not a zip');
  const count = v.getUint16(e + 10, true); let p = v.getUint32(e + 16, true);
  const files = new Map(), td = new TextDecoder();
  for (let i = 0; i < count; i++) {
    const method = v.getUint16(p + 10, true), size = v.getUint32(p + 20, true), nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), off = v.getUint32(p + 42, true);
    const name = td.decode(u8.subarray(p + 46, p + 46 + nl));
    const start = off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true);
    files.set(name, { method, data: u8.subarray(start, start + size) });
    p += 46 + nl + xl + cl;
  }
  return async (name) => {
    const f = files.get(name); if (!f) return '';
    return td.decode(f.method ? await inflate(f.data) : f.data);
  };
}

export const OLD_XLS = "That's an older or protected Excel file. Save it as .xlsx or .csv, then open it again.";

export async function readXlsx(buf) {
  const u8 = new Uint8Array(buf);
  if (u8[0] === 0xd0 && u8[1] === 0xcf) throw new Error(OLD_XLS);
  const get = await unzip(buf);
  const shared = [...(await get('xl/sharedStrings.xml')).matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map((m) => decode([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join('')));
  const book = await get('xl/workbook.xml'), rels = await get('xl/_rels/workbook.xml.rels');
  const rid = (book.match(/<sheet\b[^>]*r:id="([^"]+)"/) || [])[1];
  const rel = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => m[0]).find((r) => r.includes(`Id="${rid}"`)) || '';
  const target = (rel.match(/Target="([^"]+)"/) || [, 'worksheets/sheet1.xml'])[1].replace(/^\/?(xl\/)?/, '');
  const xml = await get('xl/' + target);
  const colIndex = (ref) => [...ref.replace(/\d/g, '')].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
  const table = [];
  for (const row of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const r = [];
    for (const c of row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = (c[1].match(/r="([A-Z]+\d+)"/) || [])[1], t = (c[1].match(/t="(\w+)"/) || [])[1], body = c[2] || '';
      if (!ref) continue;
      const v = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1], is = [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join('');
      r[colIndex(ref)] = t === 's' ? shared[+v] ?? '' : t === 'inlineStr' ? decode(is) : decode(v ?? '');
    }
    table.push(Array.from(r, (x) => x ?? ''));
  }
  return table;
}

// ---------- saved lists (CC-R50 to CC-R53) ----------
const OLD_COLOURS = { '#d9a30b': 'Gold', '#c8462c': 'Red', '#2f6f8f': 'Blue', '#3d7a4a': 'Green', '#7a4fa0': 'Purple', '#2b2d31': 'Charcoal' };

export function readList(o) {
  if (!o || typeof o !== 'object' || !Array.isArray(o.labels)) throw new Error('not a list');
  const num = (v, k) => { const f = parseFloat(v), r = RANGES[k]; return isFinite(f) && f >= r.min && f <= r.max ? f : DEFAULTS[k]; };
  const src = o.inputs || { H: o.H, d: o.d, s: o.slack, B: o.border, G: o.gap };
  const inputs = { H: num(src.H, 'H'), d: num(src.d, 'd'), s: num(src.s, 's'), B: num(src.B, 'B'), G: num(src.G, 'G') };
  const text = (v, n) => String(v ?? '').slice(0, n);
  if (Array.isArray(o.types)) {
    const types = o.types.map((t) => ({ id: text(t.id, 40) || slug(), name: text(t.name, 16), color: /^#[0-9a-f]{6}$/i.test(t.color) ? t.color : hex('Charcoal') }));
    if (!types.some((t) => t.id === OTHER)) types.push(startTypes()[4]);
    const ids = new Set(types.map((t) => t.id));
    return { inputs, types, labels: o.labels.map((l) => ({ l1: text(l.l1, 24), l2: text(l.l2, 36), typeId: ids.has(l.typeId) ? l.typeId : OTHER, qty: clampQty(l.qty) })) };
  }
  // The prototype had colours and no types: each colour in use becomes a type named after it (CC-R52)
  const types = [], other = startTypes()[4];
  const labels = o.labels.map((l) => {
    const name = OLD_COLOURS[String(l.color || '').toLowerCase()] || 'Charcoal', id = name.toLowerCase();
    if (!types.some((t) => t.id === id)) types.push({ id, name, color: hex(name) });
    return { l1: text(l.l1, 24), l2: text(l.l2, 36), typeId: id, qty: clampQty(l.qty) };
  });
  types.push(other);
  return { inputs, types, labels };
}

export const writeList = (s) => ({ version: 1, inputs: s.inputs, types: s.types, labels: s.labels });

// ---------- file names and zip (CC-R40, CC-R41) ----------
export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const sheetName = (i, n, d) => `cable-tabs-90x170-${localDate(d)}-sheet-${i + 1}-of-${n}.png`;
export const listName = (d) => `cable-tabs-list-${localDate(d)}.json`;
export const zipName = (d) => `cable-tabs-90x170-${localDate(d)}.zip`;

const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (u8) => { let c = 0xffffffff; for (const b of u8) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

// PNGs are already compressed, so the zip only stores them.
export function makeZip(files) {
  const te = new TextEncoder(), parts = [], central = []; let off = 0;
  const w = (n, ...vals) => { const b = new DataView(new ArrayBuffer(n)); let p = 0; for (const [v, s] of vals) { s === 2 ? b.setUint16(p, v, true) : b.setUint32(p, v, true); p += s; } return new Uint8Array(b.buffer); };
  for (const f of files) {
    const name = te.encode(f.name), crc = crc32(f.data), n = f.data.length;
    const head = w(30, [0x04034b50, 4], [20, 2], [0x0800, 2], [0, 2], [0, 2], [0x21, 2], [crc, 4], [n, 4], [n, 4], [name.length, 2], [0, 2]);
    parts.push(head, name, f.data);
    central.push(w(46, [0x02014b50, 4], [20, 2], [20, 2], [0x0800, 2], [0, 2], [0, 2], [0x21, 2], [crc, 4], [n, 4], [n, 4], [name.length, 2], [0, 2], [0, 2], [0, 2], [0, 2], [0, 4], [off, 4]), name);
    off += head.length + name.length + n;
  }
  const cdSize = central.reduce((a, b) => a + b.length, 0);
  const end = w(22, [0x06054b50, 4], [0, 2], [0, 2], [files.length, 2], [files.length, 2], [cdSize, 4], [off, 4], [0, 2]);
  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}
