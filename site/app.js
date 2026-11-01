// Cable Ctrl page. Rules live in core.js; this file draws them and handles input.
import * as c from './core.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const KEY = 'cablectrl.v1';
const X_ICON = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
const PLUS_ICON = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const POINTER = '<svg class="ic solid" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l10 7-10 7Z"/></svg>';

const S = { inputs: { ...c.DEFAULTS }, types: c.startTypes(), labels: c.exampleLabels(), sel: 0, examples: true, panel: null, plan: null, fileNote: '', stored: true, saving: false };
const bad = {}; // input key → message
let lastField = null;

// ---------- storage (CC-R50) ----------
function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ ...c.writeList(S), examples: S.examples })); S.stored = true; } catch { S.stored = false; }
}
function restore() {
  try {
    const t = localStorage.getItem(KEY);
    if (!t) { localStorage.setItem(KEY + '.probe', '1'); localStorage.removeItem(KEY + '.probe'); return; }
    const o = JSON.parse(t), r = c.readList(o);
    Object.assign(S, r, { examples: !!o.examples });
    if (!S.labels.length) S.labels = [blank()];
  } catch { S.stored = false; }
}
const typeOf = (id) => S.types.find((t) => t.id === id) || S.types.find((t) => t.id === 'other');
const blank = (typeId = 'other') => ({ l1: '', l2: '', typeId, qty: 2 });
function changed() { S.examples = false; S.fileNote = ''; S.undoTab = null; save(); refresh(); }

// ---------- text measuring ----------
const mctx = document.createElement('canvas').getContext('2d');
const measure = (t, w) => { mctx.font = `${w} 100px Inter`; return mctx.measureText(t).width / 100; };

// ---------- artwork (CC-R10 to CC-R17) ----------
function drawLabel(ctx, g, lab, ox, oy, k, outline) {
  const B = Math.min(S.inputs.B, g.N / 2 - 0.5), color = typeOf(lab.typeId).color, h = g.H / 2;
  ctx.save(); ctx.beginPath(); c.trace(ctx, g, ox, oy, k, B); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.clip();
  ctx.fillStyle = color;
  ctx.fillRect(ox + B * k, oy - h * k, g.band * k, g.H * k);
  ctx.fillRect(ox + (g.L - B - g.band) * k, oy - h * k, g.band * k, g.H * k);
  const tk = 0.14 * g.H, hi = h - B;
  ctx.strokeStyle = '#9a9a96'; ctx.lineWidth = 0.2 * k;
  [g.P, g.P + g.W].forEach((x) => {
    const X = ox + x * k; ctx.beginPath();
    ctx.moveTo(X, oy - hi * k); ctx.lineTo(X, oy - (hi - tk) * k); ctx.moveTo(X, oy + hi * k); ctx.lineTo(X, oy + (hi - tk) * k); ctx.stroke();
  });
  const X = ox + (g.P + g.W / 2) * k, r = S.inputs.d / 2 * k;
  ctx.fillStyle = '#e2e0da'; ctx.fillRect(X - r, oy - h * k, 2 * r, g.H * k);
  ctx.strokeStyle = '#7d7c76'; ctx.beginPath();
  ctx.moveTo(X - r, oy - h * k); ctx.lineTo(X - r, oy + h * k); ctx.moveTo(X + r, oy - h * k); ctx.lineTo(X + r, oy + h * k); ctx.stroke();
  ctx.strokeStyle = '#1f2124'; ctx.lineWidth = 0.3 * k; ctx.beginPath(); ctx.moveTo(X, oy - h * k); ctx.lineTo(X, oy + h * k); ctx.stroke();
  const t = c.textLayout(lab.l1, lab.l2, g, B, measure);
  ctx.fillStyle = '#1f2124'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  c.faces(g, B).forEach(([x0, x1]) => {
    const cx = ox + (x0 + x1) / 2 * k;
    if (t.l1) { ctx.font = `700 ${t.s1 * k}px Inter`; ctx.fillText(t.l1, cx, oy + t.y1 * k); }
    if (t.l2) { ctx.font = `600 ${t.s2 * k}px Inter`; ctx.fillText(t.l2, cx, oy + t.y2 * k); }
  });
  ctx.restore();
  if (outline) {
    ctx.save(); ctx.beginPath(); c.trace(ctx, g, ox, oy, k); ctx.setLineDash([0.8 * k, 0.6 * k]);
    ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--soft'); ctx.lineWidth = Math.max(1, 0.15 * k); ctx.stroke(); ctx.restore();
  }
}

function drawSheet(canvas, tabs, g, cap, k) {
  const { B, G } = S.inputs, ctx = canvas.getContext('2d');
  canvas.width = Math.round(c.SHEET.W * k); canvas.height = Math.round(c.SHEET.H * k);
  const bw = cap.cols * cap.w + (cap.cols - 1) * G, bh = cap.rows * cap.h + (cap.rows - 1) * G, x0 = (c.SHEET.W - bw) / 2, y0 = (c.SHEET.H - bh) / 2;
  tabs.forEach((lab, i) => {
    const r = Math.floor(i / cap.cols), q = i % cap.cols;
    ctx.save(); ctx.translate((x0 + q * (cap.w + G) + cap.w / 2) * k, (y0 + r * (cap.h + G) + cap.h / 2) * k);
    if (cap.rot) ctx.rotate(-Math.PI / 2);
    drawLabel(ctx, g, lab, -g.L / 2 * k, 0, k, false); ctx.restore();
  });
}

function renderDim(g) {
  const fs = Math.max(1.3, g.L / 42), f = (n) => n.toFixed(1), L = g.L, h = g.H / 2, top = -h - fs * 2.2, bot = h + fs * 1.8, rx = L + fs * 1.4;
  const tick = (x, y) => `M${x - .5} ${y + .5}L${x + .5} ${y - .5}`;
  const a = g.P, b = g.P + g.W, mid = (a + b) / 2;
  const svg = $('dim');
  svg.setAttribute('viewBox', `${-fs} ${top - fs * 2} ${L + fs * 7} ${bot - top + fs * 4.4}`);
  svg.setAttribute('aria-label', `Unfolded tab, ${f(L)} by ${f(g.H)} mm, faces ${f(g.P)}, wrap ${f(g.W)}, for cables up to ${f(g.d)} mm`);
  const label = (x, y, t, fill = 'var(--ink)', font = 'JetBrains Mono', anchor = 'middle') => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${fs}" fill="${fill}" font-family="${font}">${t}</text>`;
  svg.innerHTML = `<rect x="${mid - g.d / 2}" y="${-g.N / 2}" width="${g.d}" height="${g.N}" fill="var(--strong)"/>
    <path d="${c.svgPath(g, 0, 0, 1)}" fill="none" stroke="var(--ink)" stroke-width=".18"/>
    <path d="M${a} ${-h}V${h}M${b} ${-h}V${h}" fill="none" stroke="var(--soft)" stroke-width=".12" stroke-dasharray=".7 .5"/>
    <path d="M0 ${top}H${L}${tick(0, top)}${tick(L, top)}M0 ${bot}H${L}${tick(0, bot)}${tick(a, bot)}${tick(b, bot)}${tick(L, bot)}M${rx} ${-h}V${h}${tick(rx, -h)}${tick(rx, h)}" fill="none" stroke="var(--soft)" stroke-width=".12"/>
    ${label(a / 2, fs * .36, 'Face A', 'var(--soft)', 'Inter')}${label((b + L) / 2, fs * .36, 'Face B', 'var(--soft)', 'Inter')}
    ${label(mid, fs * .36, `Cable ⌀${f(g.d)}`, 'var(--soft)', 'Inter')}${label(L / 2, top - fs * .5, f(L))}${label(a / 2, bot + fs * 1.3, f(g.P))}
    ${label(mid, bot + fs * 1.3, f(g.W))}${label((b + L) / 2, bot + fs * 1.3, f(g.P))}${label(rx + fs * .6, fs * .36, f(g.H), 'var(--ink)', 'JetBrains Mono', 'start')}`;
}

function renderSide(color) {
  $('side').innerHTML = `<circle cx="9" cy="10" r="4.7" fill="var(--strong)"/>
    <path d="M16 9.6 L9 5.200 A5 5 0 1 0 9 14.800 L16 10.400 M16 9.6 H54 M16 10.400 H54" fill="none" stroke="var(--ink)" stroke-width=".5" stroke-linejoin="round"/>
    <path d="M52 10 H54" stroke="${color}" stroke-width="1.400"/>`;
}

function renderArt(g) {
  const lab = S.labels[S.sel], dpr = window.devicePixelRatio || 1, canvas = $('art'), k = Math.max(6, 560 / g.L) * dpr, m = 3 * dpr;
  canvas.width = Math.round(g.L * k + 2 * m); canvas.height = Math.round(g.H * k + 2 * m);
  drawLabel(canvas.getContext('2d'), g, lab, m, m + g.H / 2 * k, k, true);
  const t = c.textLayout(lab.l1, lab.l2, g, S.inputs.B, measure);
  $('artName').textContent = `${t.l1 || t.l2 || 'Blank tab'}, as printed`;
  renderSide(typeOf(lab.typeId).color);
}

// ---------- status ----------
function strip(kind, title, text, action) {
  const d = el('div', `health ${kind}`); d.setAttribute('role', kind === 'bad' ? 'alert' : 'status');
  d.append(el('b', '', title), el('span', '', text));
  if (action) { const b = el('button', 'key', action.label); b.type = 'button'; b.onclick = action.run; d.append(b); }
  return d;
}
function state(id, text, tone) { const e = $(id); e.textContent = text; e.className = `tier-s ${tone}`; }
function led(id, tone, blink) { $(id).className = `led${tone ? ` on-${tone}` : ''}${blink ? ' blink' : ''}`; }

// ---------- the list (CC-U26, CC-R22 to CC-R24, CC-R33) ----------
function select(i) {
  if (S.sel === i) return;
  S.sel = i;
  [...$('labels').querySelectorAll('.rowwrap')].forEach((r, j) => { r.classList.toggle('sel', j === i); r.querySelector('.pick').setAttribute('aria-current', String(j === i)); });
  refresh();
}

function typeSelect(value, onchange, label) {
  const wrap = el('span', 'tm'), sw = el('i', 'sw'), sel = el('select');
  sel.setAttribute('aria-label', label);
  const paint = () => { sw.style.background = typeOf(sel.value).color; };
  S.types.forEach((t) => { const o = el('option', '', t.name); o.value = t.id; sel.append(o); });
  sel.value = value; paint();
  sel.onchange = () => { paint(); onchange(sel.value); };
  wrap.append(sw, sel);
  return wrap;
}

function buildList() {
  if (!S.labels.length) S.labels.push(blank());
  S.sel = Math.min(S.sel, S.labels.length - 1);
  const box = $('labels'); box.textContent = '';
  S.labels.forEach((lab, i) => {
    const div = el('div', 'div'), row = el('div', `rowwrap${i === S.sel ? ' sel' : ''}`), pick = el('button', 'pick'), rowc = el('div', 'rowc'), grid = el('div', 'row'), notes = el('div', 'strips');
    pick.type = 'button'; pick.innerHTML = POINTER; pick.setAttribute('aria-current', String(i === S.sel));
    pick.setAttribute('aria-label', `Preview label ${i + 1}`); pick.onclick = () => select(i);
    const ty = typeSelect(lab.typeId, (v) => { lab.typeId = v; changed(); }, `Label ${i + 1} type`);
    const field = (key, max, hint, cls) => {
      const f = el('input', `in ${cls}`); f.value = lab[key]; f.maxLength = max; f.placeholder = hint; f.setAttribute('aria-label', `Label ${i + 1} ${hint}`);
      f.oninput = () => {
        const pos = f.selectionStart, before = f.value.slice(0, pos), after = f.value.slice(pos), nb = c.fixSymbols(before), na = c.fixSymbols(after);
        if (nb + na !== f.value) { f.value = (nb + na).slice(0, max); f.setSelectionRange(nb.length, nb.length); }
        lab[key] = f.value; changed();
      };
      f.onfocus = () => { lastField = f; };
      return f;
    };
    const q = el('input', 'in m'); q.value = lab.qty; q.type = 'number'; q.min = 0; q.max = 99; q.setAttribute('aria-label', `How many of label ${i + 1}`);
    q.oninput = () => { lab.qty = c.clampQty(q.value); changed(); };
    const x = el('button', 'key sq'); x.type = 'button'; x.innerHTML = X_ICON; x.setAttribute('aria-label', `Remove label ${i + 1}`);
    x.onclick = () => { S.labels.splice(i, 1); if (S.sel > i) S.sel--; buildList(); changed(); };
    grid.append(ty, field('l1', 24, 'Line 1', 't1'), field('l2', 36, 'Line 2', 't2'), q, x);
    rowc.append(grid, notes); row.append(pick, rowc);
    row.addEventListener('focusin', () => select(i)); row.addEventListener('click', () => select(i));
    box.append(div, row);
  });
}

function refreshList(check) {
  const g = check.g, per = check.ok ? check.per : 0, m = c.sheetMarks(S.labels, per);
  const rows = [...$('labels').querySelectorAll('.rowwrap')], divs = [...$('labels').querySelectorAll('.div')];
  let flagged = 0;
  S.labels.forEach((lab, i) => {
    const d = divs[i], mk = m.marks[i], notes = rows[i].querySelector('.strips');
    d.hidden = !mk.before; d.textContent = ''; if (mk.before) d.append(el('b', '', mk.before));
    const t = c.textLayout(lab.l1, lab.l2, g, Math.min(S.inputs.B, g.N / 2 - 0.5), measure);
    notes.textContent = '';
    if (t.small) { flagged++; notes.append(strip('warn', 'Text too small', `${t.small} is small. Shorten it or raise the tab height.`)); }
    if (mk.split) notes.append(el('span', 'small', mk.split));
  });
  $('fill').textContent = !check.ok ? `${m.total || c.tabList(S.labels).length} tabs waiting on the tab size`
    : m.total ? `${m.total} tabs on ${m.sheets} sheet${m.sheets === 1 ? '' : 's'} · ${m.open ? `${m.open} open spot${m.open === 1 ? '' : 's'} on sheet ${m.sheets}` : 'last sheet is full'}` : 'No tabs yet';
  return { total: c.tabList(S.labels).length, sheets: m.sheets, flagged };
}

// ---------- panels: one open at a time, and its action is the one filled action (CC-U16) ----------
function openPanel(name, data) { S.panel = name; S.plan = data || null; renderPanel(); refresh(); }
function closePanel() { S.panel = null; S.plan = null; renderPanel(); refresh(); }

function button(cls, text, run, html) {
  const b = el('button', cls, html ? null : text); b.type = 'button'; if (html) b.innerHTML = html + text; b.onclick = run; return b;
}

function renderPanel() {
  const p = $('panel'); p.textContent = ''; p.hidden = !S.panel; p.className = S.panel ? 'panel' : '';
  if (S.panel === 'types') typesPanel(p);
  if (S.panel === 'run') runPanel(p);
  if (S.panel === 'list') listPanel(p);
  if (S.panel === 'sheet') sheetPanel(p);
}

function typesPanel(p) {
  p.setAttribute('aria-label', 'Types');
  p.append(el('h3', '', 'Types'));
  const counts = (id) => S.labels.filter((l) => l.typeId === id).length, msg = el('div', 'strips');
  S.types.forEach((t) => {
    const row = el('div', 'tt'), name = el('input', 'in'), sws = el('div', 'sws'), n = counts(t.id);
    name.value = t.name; name.maxLength = 16; name.setAttribute('aria-label', 'Type name');
    name.onchange = () => {
      const e = c.typeNameError(S.types, name.value, t.id);
      msg.textContent = ''; if (e) { msg.append(strip('bad', 'Type name', e)); name.value = t.name; return; }
      t.name = name.value.trim(); buildList(); changed();
    };
    sws.setAttribute('role', 'group'); sws.setAttribute('aria-label', 'Band colour');
    c.PALETTE.forEach((k) => {
      const b = el('button', 'swb'), s = el('span'); b.type = 'button'; s.style.background = k.hex; b.append(s);
      b.title = k.name; b.setAttribute('aria-label', k.name); b.setAttribute('aria-pressed', String(k.hex.toUpperCase() === t.color.toUpperCase()));
      b.onclick = () => { t.color = k.hex; renderPanel(); buildList(); changed(); };
      sws.append(b);
    });
    const custom = !c.PALETTE.some((k) => k.hex.toUpperCase() === t.color.toUpperCase());
    const lab = el('label', `swc${custom ? ' on' : ''}`); lab.title = 'Custom colour'; lab.innerHTML = PLUS_ICON;
    const inp = el('input'); inp.type = 'color'; inp.value = t.color; inp.setAttribute('aria-label', `Custom colour for ${t.name}`);
    inp.onchange = () => { t.color = inp.value.toUpperCase(); renderPanel(); buildList(); changed(); };
    lab.append(inp); sws.append(lab);
    row.append(name, sws, el('span', 'small mono count', `${n} label${n === 1 ? '' : 's'}`));
    if (t.id !== 'other') {
      const x = el('button', 'key sq'); x.type = 'button'; x.innerHTML = X_ICON; x.setAttribute('aria-label', `Remove ${t.name}`);
      x.onclick = () => {
        const moved = c.removeType(S, t.id); renderPanel(); buildList(); changed();
        $('panel').querySelector('.strips').append(strip('ok', 'Type removed', `${moved} label${moved === 1 ? '' : 's'} moved to Other.`));
      };
      row.append(x);
    } else row.append(el('span'));
    p.append(row);
  });
  const note = el('p', 'small', 'Custom colours can shift in print. Print one tab to check.');
  const tools = el('div', 'tools'), sp = el('span', 'sp');
  tools.append(button('key', 'Add type', () => {
    let n = 1; while (S.types.some((t) => t.name === `Type ${n}`)) n++;
    S.types.splice(S.types.length - 1, 0, { id: c.slug(), name: `Type ${n}`, color: c.nextColour(S.types) });
    renderPanel(); buildList(); changed();
  }, PLUS_ICON), sp, button('key', 'Close', closePanel));
  p.append(msg, note, tools);
}

function runPanel(p) {
  p.setAttribute('aria-label', 'Numbered run');
  const sel = S.labels[S.sel], R = { prefix: 'ETH-', perNumber: 2, typeId: sel ? sel.typeId : 'other', touched: false };
  R.start = c.nextStart(S.labels, R.prefix); R.count = 24;
  p.append(el('h3', '', 'Add a numbered run'));
  const fields = el('div', 'fields');
  const field = (label, key, attrs) => {
    const f = el('label', 'f'), i = el('input', 'in m'); f.append(el('span', '', label), i); i.value = R[key]; Object.assign(i, attrs);
    i.oninput = () => {
      R[key] = key === 'prefix' ? i.value : i.value.trim() === '' ? NaN : Number(i.value);
      if (key === 'start') R.touched = true;
      if (key === 'prefix' && !R.touched) { R.start = c.nextStart(S.labels, R.prefix); fields.querySelector('#runStart').value = R.start; }
      update();
    };
    fields.append(f); return i;
  };
  field('Prefix', 'prefix', { maxLength: 12 }); field('Start at', 'start', { id: 'runStart', inputMode: 'numeric' }); field('How many', 'count', { inputMode: 'numeric' });
  const per = el('div', 'f'), seg = el('div', 'segc'); per.append(el('span', '', 'Tabs per number'), seg); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'Tabs per number');
  [1, 2].forEach((n) => {
    const b = el('button', '', String(n)); b.type = 'button'; b.setAttribute('aria-pressed', String(R.perNumber === n));
    b.onclick = () => { R.perNumber = n; seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); update(); };
    seg.append(b);
  });
  const ty = el('div', 'f'); ty.append(el('span', '', 'Type'), typeSelect(R.typeId, (v) => { R.typeId = v; }, 'Run type'));
  fields.append(per, ty);
  const result = el('p', 'mono small'), notes = el('div', 'strips'), go = button('key go', 'Add', () => {
    const run = c.makeRun(R);
    S.labels = S.examples ? run : S.labels.concat(run);
    S.sel = S.examples ? 0 : S.labels.length - run.length; S.examples = false; S.panel = null; renderPanel(); buildList(); changed();
  });
  const update = () => {
    notes.textContent = '';
    const okN = Number.isInteger(R.start) && R.start >= 0 && R.start <= 9999 && Number.isInteger(R.count) && R.count >= 1 && R.count <= 200 && R.prefix.length <= 12;
    go.disabled = !okN;
    if (!okN) { result.textContent = 'Start is 0 to 9999, and How many is 1 to 200.'; go.textContent = 'Add'; return; }
    const run = c.makeRun(R), tabs = R.count * R.perNumber, cap = checkNow().per, base = S.examples ? 0 : S.labels.length;
    result.textContent = `${run[0].l1} to ${run.at(-1).l1} · ${tabs} tabs · ${cap ? Math.ceil(tabs / cap) : 0} sheets`;
    go.textContent = `Add ${R.count} label${R.count === 1 ? '' : 's'}`;
    const clash = S.examples ? [] : c.runClashes(S.labels, run);
    if (clash.length) notes.append(strip('warn', 'Already in your list', `${clash.slice(0, 3).join(', ')}${clash.length > 3 ? ` and ${clash.length - 3} more` : ''}. You can still add them.`));
    if (base + R.count > c.MAX_LABELS) { go.disabled = true; notes.append(strip('bad', 'Too many labels', `The list holds up to ${c.MAX_LABELS}. This would make ${base + R.count}.`)); }
  };
  const tools = el('div', 'tools'); tools.append(go, button('key', 'Cancel', closePanel));
  p.append(fields, result, notes, tools); update();
}

function listPanel(p) {
  const r = S.plan, n = r.labels.length;
  p.setAttribute('role', 'alertdialog'); p.setAttribute('aria-label', 'Replace your list');
  const tools = el('div', 'tools');
  tools.append(button('key go', 'Replace list', () => {
    Object.assign(S, { inputs: r.inputs, types: r.types, labels: r.labels.length ? r.labels : [blank()], sel: 0, examples: false, panel: null, plan: null });
    syncInputs(); renderPanel(); buildList(); changed();
  }), button('key', 'Cancel', closePanel));
  p.append(el('h3', '', `Replace your list with ${n} label${n === 1 ? '' : 's'}?`), el('p', 'small', `From ${r.file}. Your current labels will be gone unless you export them first.`), tools);
}

function sheetPanel(p) {
  const r = S.plan, n = r.labels.length, base = S.examples ? 0 : S.labels.length, parts = [`${n} label${n === 1 ? '' : 's'}`];
  p.setAttribute('aria-label', 'Spreadsheet import');
  if (r.added.length) parts.push(`${r.added.length} new type${r.added.length === 1 ? '' : 's'}`);
  if (r.skipped.length) parts.push(`${r.skipped.length} row${r.skipped.length === 1 ? '' : 's'} skipped`);
  p.append(el('h3', '', parts.join(', ')), el('p', 'small', `From ${r.file}.${r.added.length ? ` New types: ${r.added.join(', ')}.` : ''}`));
  r.skipped.slice(0, 8).forEach((s) => { const [a, b] = s.split(': '); p.append(strip('warn', a, `${b} It wasn't added.`)); });
  if (r.skipped.length > 8) p.append(el('p', 'small', `And ${r.skipped.length - 8} more rows.`));
  const apply = (labels) => { Object.assign(S, { labels, types: r.types, sel: 0, examples: false, panel: null, plan: null }); renderPanel(); buildList(); changed(); };
  const tools = el('div', 'tools'), add = button('key go', 'Add to list', () => apply(S.examples ? r.labels : S.labels.concat(r.labels))), rep = button('key', 'Replace list', () => apply(r.labels));
  add.disabled = !n || base + n > c.MAX_LABELS; rep.disabled = !n || n > c.MAX_LABELS;
  tools.append(add, rep, button('key', 'Cancel', closePanel));
  if (n > c.MAX_LABELS || base + n > c.MAX_LABELS) p.append(strip('bad', 'Too many labels', `The list holds up to ${c.MAX_LABELS}. This would make ${Math.min(n, base + n) === n ? n : base + n}.`));
  p.append(tools);
}

// ---------- files ----------
function fileError(msg) { S.fileNote = msg; refresh(); }

async function openFile(file) {
  S.fileNote = '';
  if (!file) return;
  if (file.size > c.MAX_FILE) return fileError('That file is over 5 MB.');
  const name = file.name, lower = name.toLowerCase();
  try {
    if (lower.endsWith('.json')) {
      let r; try { r = c.readList(JSON.parse(await file.text())); } catch { return fileError("That file isn't a cable tab list."); }
      if (r.labels.length > c.MAX_LABELS) return fileError(`The list holds up to ${c.MAX_LABELS}. That file has ${r.labels.length}.`);
      return openPanel('list', { ...r, file: name });
    }
    if (!lower.endsWith('.xlsx') && !lower.endsWith('.csv') && !lower.endsWith('.xls')) return fileError('Open a .json list, an .xlsx file or a .csv file.');
    const table = lower.endsWith('.csv') ? c.parseCsv(await file.text()) : await c.readXlsx(await file.arrayBuffer());
    const read = c.readTable(table);
    if (read.error) return fileError(read.error);
    openPanel('sheet', { ...c.planImport(S, read), file: name });
  } catch (e) { fileError(e.message === c.OLD_XLS ? c.OLD_XLS : "That file couldn't be read. Save it again as .xlsx or .csv."); }
}

function download(blob, name) {
  const a = el('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ---------- saving (CC-R30, CC-R40, CC-R41) ----------
const sheetTabs = (per) => { const tabs = c.tabList(S.labels), out = []; for (let i = 0; i < tabs.length; i += per) out.push(tabs.slice(i, i + per)); return out; };

async function sheetBlob(tabs, check) {
  const canvas = document.createElement('canvas');
  drawSheet(canvas, tabs, check.g, check.cap, 300 / 25.4);
  return new Promise((r) => canvas.toBlob(r, 'image/png'));
}

async function saveSheets(which) {
  const check = checkNow(), groups = sheetTabs(check.per), n = groups.length, list = which ?? groups.map((_, i) => i), note = $('saveNote');
  if (!check.ok || !n || S.saving) return;
  S.saving = true; refresh();
  try {
    const files = [];
    for (const i of list) {
      note.textContent = `Saving sheet ${i + 1} of ${n}…`;
      await new Promise((r) => setTimeout(r));
      files.push({ name: c.sheetName(i, n), blob: await sheetBlob(groups[i], check) });
    }
    const phone = matchMedia('(pointer:coarse)').matches;
    if (phone && navigator.canShare && files.length) {
      const shared = files.map((f) => new File([f.blob], f.name, { type: 'image/png' }));
      if (navigator.canShare({ files: shared })) {
        try { await navigator.share({ files: shared }); note.textContent = `Saved ${files.length} sheet${files.length === 1 ? '' : 's'}.`; }
        catch (e) { note.textContent = e.name === 'AbortError' ? 'Not saved.' : "Couldn't share the sheets. Try again."; }
        return;
      }
    }
    if (files.length === 1) download(files[0].blob, files[0].name);
    else {
      const parts = await Promise.all(files.map(async (f) => ({ name: f.name, data: new Uint8Array(await f.blob.arrayBuffer()) })));
      download(c.makeZip(parts), c.zipName());
    }
    note.textContent = `Saved ${files.length} sheet${files.length === 1 ? '' : 's'}.`;
  } finally { S.saving = false; refresh(true); }
}

// ---------- refresh ----------
const checkNow = () => c.checkDesign(S.inputs);
let sheetTimer = 0;

function renderSheets(check) {
  const box = $('sheets'), groups = check.ok ? sheetTabs(check.per) : [];
  box.textContent = '';
  groups.slice(0, 24).forEach((tabs, i) => {
    const fig = el('figure', 'sheet'), canvas = el('canvas');
    canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `Sheet ${i + 1} of ${groups.length}, ${tabs.length} tabs`);
    drawSheet(canvas, tabs, check.g, check.cap, 340 / 90);
    fig.append(canvas, el('figcaption', 'small mono', `Sheet ${i + 1} of ${groups.length} · ${tabs.length} tabs`));
    if (groups.length > 1) fig.append(button('key', `Save sheet ${i + 1}`, () => saveSheets([i])));
    box.append(fig);
  });
  if (groups.length > 24) box.append(el('p', 'small', `And ${groups.length - 24} more sheets. Save includes them all.`));
}

function refresh(keepNote) {
  const check = checkNow(), g = check.g, a1 = $('a1Strips'), a2 = $('a2Strips');
  // Area 1: inputs, then what can print (CC-R80 to CC-R83)
  a1.textContent = '';
  const inputBad = Object.keys(bad).filter((k) => bad[k]);
  inputBad.forEach((k) => a1.append(strip('bad', c.RANGES[k].name, bad[k])));
  check.cant.forEach((m) => a1.append(strip('bad', "Can't print", m)));
  if (check.ok) check.notes.forEach((m) => a1.append(strip('warn', 'Note', m)));
  if (S.undoTab) a1.append(strip('ok', 'Done', 'Tab size is back to the defaults.', { label: 'Undo', run: undoReset }));
  $('resetTab').disabled = c.isDefault(S.inputs) && !inputBad.length;
  state('a1State', inputBad.length ? `${inputBad.length} field${inputBad.length === 1 ? '' : 's'} to fix` : check.verdict, inputBad.length || !check.ok ? 'bad' : check.notes.length ? 'warn' : 'ok');
  $('readout').innerHTML = [['Wrap length', `π·${S.inputs.d.toFixed(1)} + ${S.inputs.s} = ${g.W.toFixed(1)}`], ['Overall', g.L.toFixed(1)], ['Face', `${g.P.toFixed(1)} × ${g.H.toFixed(1)}`], ['Neck height', g.N.toFixed(1)]].map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
  renderDim(g); renderArt(g);
  // Area 2
  const list = refreshList(check);
  a2.textContent = '';
  if (!S.stored) a2.append(strip('warn', 'Not saving', "This browser isn't keeping your list. Export it before you close.", { label: 'Export list', run: exportList }));
  if (S.fileNote) a2.append(strip('bad', 'File', S.fileNote));
  $('examples').hidden = !S.examples;
  state('a2State', !S.stored ? 'Not saving' : list.flagged ? `${list.flagged} label${list.flagged === 1 ? '' : 's'} to check` : list.total ? `${list.total} tabs` : '0 tabs', !S.stored || list.flagged ? 'warn' : list.total ? 'ok' : 'idle');
  // Area 3
  const none = !list.total;
  $('borderOut').textContent = S.inputs.B.toFixed(1);
  const sn = $('sheetNote'); sn.hidden = check.ok && !none;
  sn.textContent = !check.ok ? "This design can't print yet. See Label Tab Design." : 'Set a quantity on at least one label to make a sheet.';
  const count = check.ok ? list.sheets : 0;
  state('a3State', S.saving ? 'Saving' : !check.ok ? "Can't print" : none ? 'Nothing to save yet' : `${count} sheet${count === 1 ? '' : 's'} ready`, S.saving ? 'busy' : !check.ok ? 'bad' : none ? 'idle' : 'ok');
  const go = $('save'); go.disabled = !check.ok || none || S.saving;
  go.className = S.panel === 'types' || !S.panel ? 'key go' : 'key'; // one filled action at a time (CC-U16)
  $('saveText').textContent = S.saving ? 'Saving…' : count > 1 ? `Save ${count} sheets` : count === 1 ? 'Save sheet' : 'Save sheets';
  if (!keepNote && !S.saving) $('saveNote').textContent = !check.ok ? 'Fix the size in Label Tab Design first.' : none ? 'Add a quantity in Label Information first.' : '';
  led('ledDesign', inputBad.length || !check.ok ? 'fault' : 'ok');
  led('ledLabels', !S.stored || list.flagged ? 'busy' : list.total ? 'ok' : '');
  led('ledSheets', S.saving ? 'busy' : !check.ok ? 'fault' : none ? '' : 'ok', S.saving);
  clearTimeout(sheetTimer); sheetTimer = setTimeout(() => renderSheets(checkNow()), 120);
}

function exportList() { download(new Blob([JSON.stringify(c.writeList(S), null, 2)], { type: 'application/json' }), c.listName()); }

// CC-R87: labels and types are never touched here
function resetTab() {
  const prev = { ...S.inputs };
  S.inputs = { ...c.DEFAULTS }; syncInputs(); S.fileNote = ''; save();
  S.undoTab = prev; refresh(); $('H').focus();
}
function undoReset() { S.inputs = S.undoTab; S.undoTab = null; syncInputs(); save(); refresh(); $('H').focus(); }

function syncInputs() { Object.keys(c.RANGES).forEach((k) => { $(k).value = S.inputs[k]; $(k).classList.remove('bad'); bad[k] = ''; }); }

// ---------- wiring ----------
Object.keys(c.RANGES).forEach((k) => {
  const f = $(k);
  f.oninput = () => {
    const e = c.rangeError(k, f.value); bad[k] = e; f.classList.toggle('bad', !!e);
    if (!e) { S.inputs[k] = parseFloat(f.value); changed(); } else refresh();
  };
});
$('add').onclick = () => {
  if (S.labels.length >= c.MAX_LABELS) return fileError(`The list holds up to ${c.MAX_LABELS} labels.`);
  S.labels.push(blank(S.labels[S.sel]?.typeId ?? 'other')); S.sel = S.labels.length - 1; buildList(); changed();
  $('labels').querySelectorAll('.t1')[S.sel].focus();
};
$('resetTab').onclick = resetTab;
$('openRun').onclick = () => (S.panel === 'run' ? closePanel() : openPanel('run'));
$('openTypes').onclick = () => (S.panel === 'types' ? closePanel() : openPanel('types'));
$('openFile').onclick = () => $('file').click();
$('file').onchange = (e) => { openFile(e.target.files[0]); e.target.value = ''; };
$('exportList').onclick = exportList;
$('save').onclick = () => saveSheets();
document.querySelectorAll('[data-sym]').forEach((b) => {
  b.onmousedown = (e) => e.preventDefault();
  b.onclick = () => {
    const f = lastField && document.contains(lastField) ? lastField : $('labels').querySelectorAll('.t2')[S.sel];
    if (!f) return;
    const st = f.selectionStart ?? f.value.length, en = f.selectionEnd ?? st; let ins = b.dataset.sym;
    if (st === 0 || /\s$/.test(f.value.slice(0, st))) ins = ins.trimStart();
    if (/^\s/.test(f.value.slice(en))) ins = ins.trimEnd();
    f.value = (f.value.slice(0, st) + ins + f.value.slice(en)).slice(0, f.maxLength); f.focus(); f.setSelectionRange(st + ins.length, st + ins.length); f.dispatchEvent(new Event('input'));
  };
});
const area = $('area2');
['dragenter', 'dragover'].forEach((t) => area.addEventListener(t, (e) => { e.preventDefault(); area.classList.add('over'); }));
['dragleave', 'drop'].forEach((t) => area.addEventListener(t, (e) => { e.preventDefault(); if (t === 'drop' || !area.contains(e.relatedTarget)) area.classList.remove('over'); }));
area.addEventListener('drop', (e) => openFile(e.dataTransfer.files[0]));
matchMedia('(prefers-color-scheme:dark)').addEventListener('change', () => refresh(true));
document.querySelectorAll('[data-theme-set]').forEach((b) => b.addEventListener('click', () => refresh(true)));

restore(); syncInputs(); buildList(); refresh();
Promise.all(['400 16px Inter', '600 16px Inter', '700 16px Inter'].map((f) => document.fonts.load(f, 'A→↔·'))).then(() => refresh()).catch(() => {});
