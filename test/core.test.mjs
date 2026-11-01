// Run: node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as c from '../site/core.js';

const near = (a, b, e = 0.05) => assert.ok(Math.abs(a - b) <= e, `${a} is not near ${b}`);
const inputs = (o = {}) => ({ ...c.DEFAULTS, ...o });
const emWidth = (t) => t.length * 0.55; // stands in for canvas text measuring

test('CC-A01 default readout', () => {
  const g = c.geom(inputs());
  near(g.W, 23.5); near(g.L, 55.9); near(g.P, 16.2); near(g.N, 6.2);
});

test('CC-A02 default sheet holds 12 flat tabs', () => {
  const cap = c.capacity(c.geom(inputs()), inputs());
  assert.equal(cap.n, 12); assert.equal(cap.rot, false);
});

test('CC-A04 file name uses the local date', () => {
  const evening = new Date(2026, 10, 1, 21, 0);
  assert.equal(c.sheetName(0, 2, evening), 'cable-tabs-90x170-2026-11-01-sheet-1-of-2.png');
});

test('CC-A05 13 tabs at 12 per sheet', () => {
  const labels = [{ qty: 12 }, { qty: 1 }];
  const s = c.sheetMarks(labels, 12);
  assert.equal(s.marks[1].before, 'Sheet 2'); assert.equal(s.open, 11); assert.equal(s.sheets, 2);
});

test('CC-A06 CC-E01 largest tab turns, 3 per sheet', () => {
  const cap = c.capacity(c.geom(inputs({ H: 24, d: 9 })), inputs({ H: 24, d: 9 }));
  assert.equal(cap.rot, true); assert.equal(cap.n, 3);
  near(c.geom(inputs({ H: 24, d: 9 })).L, 107.4);
});

test('CC-A07 no quantities means no sheets', () => {
  assert.equal(c.sheetMarks([{ qty: 0 }, { qty: 0 }], 12).total, 0);
});

test('CC-A08 long line 2 flags Line 2', () => {
  const g = c.geom(inputs());
  assert.equal(c.textLayout('ETH', 'Router 2.5G port → Studio desk hub', g, 1.5, emWidth).small, 'Line 2');
  assert.equal(c.textLayout('ETH', 'Short', g, 1.5, emWidth).small, '');
});

test('CC-A09 typed symbols', () => {
  assert.equal(c.fixSymbols('ETH * MAC -> HUB'), 'ETH · MAC → HUB');
  assert.equal(c.fixSymbols('A <-> B <- C'), 'A ↔ B ← C');
});

test('CC-A10 a list survives export and import', () => {
  const s = { inputs: inputs({ H: 12 }), types: c.startTypes(), labels: c.exampleLabels() };
  assert.deepEqual(c.readList(JSON.parse(JSON.stringify(c.writeList(s)))), { inputs: s.inputs, types: s.types, labels: s.labels });
});

test('CC-A11 prototype list imports with one type per colour', () => {
  const r = c.readList({ H: 10, d: 7, slack: 1.5, border: 1.5, gap: 4, labels: [
    { l1: 'ETH · LAN', l2: 'Office', color: '#7a4fa0', qty: 2 }, { l1: 'PWR', l2: '', color: '#3d7a4a', qty: 2 }, { l1: 'ETH 2', l2: '', color: '#7a4fa0', qty: 1 }] });
  assert.deepEqual(r.types.map((t) => t.name), ['Purple', 'Green', 'Other']);
  assert.equal(r.labels[2].typeId, 'purple'); assert.equal(r.labels[0].l1, 'ETH · LAN');
});

test('CC-A12 a non-list file is refused', () => {
  assert.throws(() => c.readList({ hello: 1 })); assert.throws(() => c.readList(null));
});

test('CC-A27 recolouring is by type: labels hold no colour', () => {
  const l = c.exampleLabels();
  assert.ok(l.every((x) => !('color' in x)));
});

test('CC-A28 CC-A29 removing a type moves labels to Other; Other stays', () => {
  const s = { types: c.startTypes(), labels: [{ typeId: 'hdmi' }, { typeId: 'hdmi' }, { typeId: 'hdmi' }, { typeId: 'usb' }] };
  assert.equal(c.removeType(s, 'hdmi'), 3);
  assert.equal(s.labels[0].typeId, 'other'); assert.ok(!s.types.some((t) => t.id === 'hdmi'));
  assert.equal(c.removeType(s, 'other'), 0); assert.ok(s.types.some((t) => t.id === 'other'));
});

test('CC-A32 numbered run', () => {
  const r = c.makeRun({ prefix: 'ETH-', start: 1, count: 24, perNumber: 2, typeId: 'ethernet' });
  assert.equal(r.length, 24); assert.equal(r[0].l1, 'ETH-01'); assert.equal(r[23].l1, 'ETH-24'); assert.equal(r[0].qty, 2); assert.equal(r[0].l2, '');
});

test('CC-A33 start picks up after the last number', () => {
  const r = c.makeRun({ prefix: 'ETH-', start: 1, count: 24, perNumber: 2, typeId: 'ethernet' });
  assert.equal(c.nextStart(r, 'ETH-'), 25);
});

test('CC-A34 numbers pad to the highest', () => {
  assert.deepEqual(c.runNumbers(95, 10).slice(0, 1).concat(c.runNumbers(95, 10).slice(-1)), ['095', '104']);
});

test('CC-R64 clashes are found', () => {
  const have = [{ l1: 'ETH-03' }];
  assert.deepEqual(c.runClashes(have, c.makeRun({ prefix: 'ETH-', start: 1, count: 4, perNumber: 2, typeId: 'x' })), ['ETH-03']);
});

const state = () => ({ types: c.startTypes(), labels: [] });

test('CC-A35 the template reads correctly', async () => {
  const buf = readFileSync(new URL('../site/cable-ctrl-template.xlsx', import.meta.url));
  const table = await c.readXlsx(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
  assert.deepEqual(table[0], ['Line 1', 'Line 2', 'Type', 'Quantity']);
  const plan = c.planImport(state(), c.readTable(table));
  assert.equal(plan.skipped.length, 0); assert.ok(plan.labels.length >= 3);
  assert.equal(plan.labels[0].l2, 'Dock → Laptop');
});

test('CC-A36 columns in any order', () => {
  const r = c.readTable(c.parseCsv('quantity,TYPE,Line 2,Line 1\n3,USB,"Dock, left",USB · A\n'));
  assert.deepEqual(r.rows[0], { l1: 'USB · A', l2: 'Dock, left', type: 'USB', qty: 3 });
});

test('CC-A37 a bad row is skipped and named', () => {
  const r = c.readTable([['Line 1'], ['X'.repeat(30)], ['OK']]);
  assert.deepEqual(r.skipped, ['Row 2: Line 1 is over 24 characters.']); assert.equal(r.rows.length, 1);
});

test('CC-A38 an unknown type is created with an unused colour', () => {
  const plan = c.planImport(state(), c.readTable([['Line 1', 'Type'], ['A', 'Fiber']]));
  assert.deepEqual(plan.added, ['Fiber']);
  assert.equal(plan.types.at(-1).color, '#D1492F'); // Red is the one unused start colour
});

test('CC-A39 blank quantity is 2', () => {
  assert.equal(c.readTable([['Line 1', 'Quantity'], ['A', '']]).rows[0].qty, 2);
});

test('CC-A41 an old xls is refused with a fix', async () => {
  await assert.rejects(c.readXlsx(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]).buffer), { message: c.OLD_XLS });
});

test('bad columns are named', () => {
  assert.equal(c.readTable([['Name', 'Thing'], ['a', 'b']]).error, c.BAD_COLUMNS);
});

test('CC-A44 CC-A45 cant print names a fix that passes', () => {
  const r = c.checkDesign(inputs({ H: 8, B: 3 }));
  assert.equal(r.verdict, "Can't print");
  assert.equal(r.cant[0], 'With a 3 mm border, an 8 mm tab has no printed neck left. Lower Cut border to 1.9, or raise Tab height to 11.4.');
  assert.ok(c.checkDesign(inputs({ H: 8, B: 1.9 })).ok); assert.ok(c.checkDesign(inputs({ H: 11.4, B: 3 })).ok);
});

test('CC-A46 close spacing is a note', () => {
  const r = c.checkDesign(inputs({ G: 2 }));
  assert.equal(r.verdict, 'Prints · 1 note'); assert.ok(r.ok);
});

test('CC-A47 margin grows with the border', () => {
  const i = inputs({ B: 3, H: 12 });
  assert.equal(c.margin(i.B), 3); assert.ok(c.capacity(c.geom(i), i).n > 0); assert.ok(c.checkDesign(i).ok);
});

test('CC-A56 defaults are recognised', () => {
  assert.ok(c.isDefault(inputs())); assert.ok(!c.isDefault(inputs({ H: 12 })));
});

test('CC-A57 big flag on a thin cable', () => {
  const r = c.checkDesign(inputs({ H: 16, d: 2 }));
  assert.equal(r.verdict, 'Prints · 1 note');
  assert.equal(r.notes[0], 'This flag is big for a thin cable and may droop. Lower Tab height to 12.5, or raise Max cable ⌀.');
  assert.deepEqual(c.checkDesign(inputs({ H: 12.5, d: 2 })).notes, []);
});

test('CC-A58 tab narrower than the cable', () => {
  const r = c.checkDesign(inputs({ H: 8, d: 9 }));
  assert.ok(r.notes.includes('This tab is narrower than the cable is thick. Raise Tab height to 9.'));
});

test('CC-A59 tight slack is a note', () => {
  const r = c.checkDesign(inputs({ s: 0.5 }));
  assert.equal(r.notes[0], 'Slack under 1 mm makes the wrap tight. Raise it to 1.5, or print one tab to check.'); assert.ok(r.ok);
});

test('CC-R80 default verdict', () => {
  assert.equal(c.checkDesign(inputs()).verdict, 'Prints · 12 per sheet');
});

test('CC-R02 ranges', () => {
  assert.equal(c.rangeError('H', 30), "Tab height can't be 30. Enter 8 to 24 mm.");
  assert.equal(c.rangeError('H', 10), '');
});

test('CC-R41 zip is a readable archive', async () => {
  const blob = c.makeZip([{ name: 'a.png', data: new Uint8Array([1, 2, 3]) }]);
  const u8 = new Uint8Array(await blob.arrayBuffer());
  assert.equal(new DataView(u8.buffer).getUint32(0, true), 0x04034b50);
});
