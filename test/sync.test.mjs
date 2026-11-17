// GitHub storage against a fake GitHub (CC-A74 to CC-A81). No real repo or token is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as c from '../site/core.js';
import { client, fromB64, LIST_PATH, README_PATH, repoError } from '../site/github.js';
import { syncOnce, waiting } from '../site/sync.js';

const TOKEN = 'test-token-not-real';
const REPO = 'someone/ctrl-data';

// A small stand-in for api.github.com: one repo, files with shas, a token that can be revoked
function fakeGitHub({ isPrivate = true } = {}) {
  const files = new Map(); let n = 0; const calls = [], commits = [];
  const gh = { files, calls, commits, token: TOKEN, isPrivate, canWrite: true, down: false };
  gh.fetch = async (url, opts = {}) => {
    calls.push({ url, method: opts.method || 'GET', auth: opts.headers?.Authorization });
    if (gh.down) throw new TypeError('offline');
    const ok = (status, body) => ({ status, json: async () => body });
    if (opts.headers?.Authorization !== `Bearer ${gh.token}`) return ok(401, { message: 'Bad credentials' });
    const u = new URL(url);
    if (u.origin !== 'https://api.github.com') return ok(400, {});
    const path = u.pathname.replace(`/repos/${REPO}`, '');
    if (path === '') return ok(200, { full_name: REPO, private: gh.isPrivate, permissions: { push: gh.canWrite } });
    const file = path.replace('/contents/', '');
    if (!opts.method || opts.method === 'GET') {
      if (file === '') return files.size ? ok(200, [...files].map(([name, f]) => ({ name, sha: f.sha }))) : ok(404, {});
      const f = files.get(file);
      return f ? ok(200, { sha: f.sha, content: f.b64, encoding: 'base64' }) : ok(404, { message: 'Not Found' });
    }
    if (!gh.canWrite) return ok(403, { message: 'Resource not accessible' });
    const body = JSON.parse(opts.body), cur = files.get(file);
    if ((cur && body.sha !== cur.sha) || (!cur && body.sha)) return ok(409, { message: 'sha does not match' });
    const sha = `sha${++n}`;
    files.set(file, { sha, b64: body.content, message: body.message }); commits.push(body.message);
    return ok(cur ? 200 : 201, { content: { sha } });
  };
  return gh;
}
const text = (gh, f) => fromB64(gh.files.get(f).b64);
const listOn = (gh) => JSON.parse(text(gh, LIST_PATH));
const clone = (x) => JSON.parse(JSON.stringify(x));
const device = () => c.listDoc({ inputs: { ...c.DEFAULTS }, types: c.startTypes(), labels: c.exampleLabels().slice(0, 3) });
const sync = (gh, local, base = null, sha = null) => syncOnce({ gh: client(REPO, TOKEN, gh.fetch), repo: REPO, local, base, sha });

test('CC-A74: the app pages make no requests except through github.js', () => {
  for (const f of ['app.js', 'core.js', 'sync.js', 'chrome.js']) {
    const s = readFileSync(new URL(`../site/${f}`, import.meta.url), 'utf8');
    assert.ok(!/\bfetch\s*\(/.test(s.replace(/fetchFn|fetch:\s*\w+/g, '')) || f === 'chrome.js', `${f} calls fetch`);
    assert.ok(!/api\.github\.com/.test(s), `${f} names api.github.com`);
  }
  const g = readFileSync(new URL('../site/github.js', import.meta.url), 'utf8');
  assert.deepEqual([...new Set(g.match(/https:\/\/api\.[a-z.]+/g))], ['https://api.github.com']);
});

test('CC-A76: a public repo is refused and nothing is written', async () => {
  const gh = fakeGitHub({ isPrivate: false });
  const r = await client(REPO, TOKEN, gh.fetch).check();
  assert.equal(r.private, false);
  assert.equal(gh.calls.filter((x) => x.method !== 'GET').length, 0);
  assert.ok(repoError('not a repo')); assert.equal(repoError(REPO), '');
});

test('CC-A77: an empty private repo gets cable-ctrl.json and a README, and nothing else', async () => {
  const gh = fakeGitHub(), local = device();
  const r = await sync(gh, local);
  assert.equal(r.status, 'synced'); assert.ok(r.wrote);
  assert.deepEqual([...gh.files.keys()].sort(), [README_PATH, LIST_PATH].sort());
  assert.deepEqual(gh.commits, ['Cable Ctrl: first list', 'Cable Ctrl: README']);
  assert.deepEqual(listOn(gh), local);
  assert.ok(local.labels.every((l) => /^[a-z0-9]{8,24}$/.test(l.k)));
});

test('CC-A77: an existing README is left alone', async () => {
  const gh = fakeGitHub();
  gh.files.set(README_PATH, { sha: 'r1', b64: Buffer.from('# mine').toString('base64') });
  await sync(gh, device());
  assert.equal(text(gh, README_PATH), '# mine');
  assert.deepEqual(gh.commits, ['Cable Ctrl: first list']);
});

test('CC-A78: one device adds a label, the other recolours a type, both end up with both', async () => {
  const gh = fakeGitHub();
  const first = await sync(gh, device());
  const a = clone(first.list), b = clone(first.list);
  a.labels.push({ l1: 'ETH-04', l2: 'Office', typeId: 'ethernet', qty: 1, k: c.labelKey() });
  b.types.find((t) => t.id === 'usb').color = '#3A93C9';
  const ra = await sync(gh, a, first.base, first.sha);
  assert.equal(ra.status, 'synced'); assert.match(ra.message, /ETH-04 added/);
  const rb = await sync(gh, b, first.base, first.sha); // stale: merges
  assert.equal(rb.status, 'synced');
  assert.ok(rb.list.labels.some((l) => l.l1 === 'ETH-04'));
  assert.equal(rb.list.types.find((t) => t.id === 'usb').color, '#3A93C9');
  const ra2 = await sync(gh, ra.list, ra.base, ra.sha);
  assert.deepEqual(ra2.list, rb.list);
  assert.deepEqual(listOn(gh), rb.list);
});

test('CC-A79: both change the same Line 1, the person picks, and the pick is kept on both', async () => {
  const gh = fakeGitHub();
  const first = await sync(gh, device());
  const a = clone(first.list), b = clone(first.list), k = a.labels[0].k;
  a.labels[0].l1 = 'FROM-A'; b.labels[0].l1 = 'FROM-B';
  const ra = await sync(gh, a, first.base, first.sha);
  const rb = await sync(gh, b, first.base, first.sha);
  assert.equal(rb.status, 'conflict');
  assert.equal(rb.conflicts.length, 1);
  assert.deepEqual([rb.conflicts[0].local, rb.conflicts[0].remote, rb.conflicts[0].field], ['FROM-B', 'FROM-A', 'l1']);
  assert.match(rb.conflicts[0].label, /Line 1/); assert.ok(!/FROM-/.test(rb.conflicts[0].label)); // named by the last synced text
  c.resolveListConflict(rb.merged, rb.conflicts[0], 'remote');
  const done = await sync(gh, rb.merged, rb.remote, rb.remoteSha);
  assert.equal(done.status, 'synced');
  assert.equal(listOn(gh).labels.find((l) => l.k === k).l1, 'FROM-A');
  const back = await sync(gh, ra.list, ra.base, ra.sha);
  assert.equal(back.list.labels.find((l) => l.k === k).l1, 'FROM-A');
});

test('CC-A79: the tab size merges field by field', () => {
  const base = device(), l = clone(base), r = clone(base);
  l.inputs.H = 12; r.inputs.d = 5;
  const m = c.mergeLists(base, l, r);
  assert.equal(m.conflicts.length, 0);
  assert.deepEqual([m.list.inputs.H, m.list.inputs.d], [12, 5]);
  r.inputs.H = 14;
  const m2 = c.mergeLists(base, l, r);
  assert.equal(m2.conflicts[0].label, 'Tab size · Tab height');
});

test('a type removed on one side moves its labels to Other, and Other always stays', () => {
  const base = device(), l = clone(base), r = clone(base);
  r.types = r.types.filter((t) => t.id !== l.labels[0].typeId && t.id !== 'other');
  const m = c.mergeLists(base, l, r);
  assert.ok(m.list.types.some((t) => t.id === 'other'));
  const ids = new Set(m.list.types.map((t) => t.id));
  assert.ok(m.list.labels.every((x) => ids.has(x.typeId)));
});

test('CC-A80: offline, a new label waits and the count says 1; back online it syncs', async () => {
  const gh = fakeGitHub();
  const first = await sync(gh, device());
  const local = clone(first.list);
  local.labels.push({ l1: 'NEW', l2: '', typeId: 'other', qty: 1, k: c.labelKey() });
  assert.equal(waiting(first.base, local), 1);
  gh.down = true;
  const off = await sync(gh, local, first.base, first.sha);
  assert.equal(off.status, 'error'); assert.equal(off.error.kind, 'offline');
  gh.down = false;
  const on = await sync(gh, local, first.base, first.sha);
  assert.equal(on.status, 'synced'); assert.equal(waiting(on.base, on.list), 0);
  assert.equal(listOn(gh).labels.length, 4);
});

test('a file that is not a Cable Ctrl list is never written over', async () => {
  const gh = fakeGitHub();
  gh.files.set(LIST_PATH, { sha: 'x1', b64: Buffer.from('not json').toString('base64') });
  const r = await sync(gh, device());
  assert.equal(r.status, 'error'); assert.equal(r.error.kind, 'unreadable');
  assert.equal(gh.commits.length, 0);
});

test('a revoked token or a read-only token says so', async () => {
  const gh = fakeGitHub(); gh.token = 'other';
  const r = await sync(gh, device());
  assert.equal(r.error.kind, 'auth');
  const gh2 = fakeGitHub(); gh2.canWrite = false;
  const r2 = await sync(gh2, device());
  assert.equal(r2.status, 'error');
});

test('readList keeps label keys, and Export list carries them', () => {
  const d = device();
  const back = c.readList(JSON.parse(JSON.stringify(d)));
  assert.deepEqual(back.labels.map((l) => l.k), d.labels.map((l) => l.k));
});

test('CC-A81: no token in the repo files, commit messages, or Export list', async () => {
  const gh = fakeGitHub(), local = device();
  const first = await sync(gh, local);
  const l2 = clone(first.list); l2.labels[0].l1 = 'CHANGED';
  await sync(gh, l2, first.base, first.sha);
  for (const f of gh.files.keys()) assert.ok(!text(gh, f).includes(TOKEN), f);
  for (const m of gh.commits) assert.ok(!m.includes(TOKEN), m);
  assert.ok(!JSON.stringify(c.writeList(c.readList(l2))).includes(TOKEN));
  for (const x of gh.calls) assert.ok(!x.url.includes(TOKEN));
});
