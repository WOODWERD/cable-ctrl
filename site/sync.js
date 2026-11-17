// One sync with the data repo (CC-R109 to CC-R113). Copied from Box Ctrl's sync.js and shaped for a label list.
// No page code: tested against a fake GitHub.
import { readDoc, mergeLists, listCommitMessage, diffLists, same } from './core.js';
import { LIST_PATH, README_PATH, readme } from './github.js';

// Changes in this browser that GitHub doesn't have yet (CC-R112)
export const waiting = (base, local) => (base ? diffLists(base, local).total : 0);

// Reads cable-ctrl.json; a file that won't read is never written over (CC-R113)
export async function readRemote(gh, repo) {
  const f = await gh.read(LIST_PATH);
  if (f.missing || f.error) return f;
  try { return { doc: readDoc(JSON.parse(f.text)), sha: f.sha }; }
  catch { return { error: { kind: 'unreadable', title: `${LIST_PATH} won't read`, text: `${LIST_PATH} in ${repo} isn't a Cable Ctrl list. Nothing in this browser changed. Fix or remove the file on GitHub, then sync again.` } }; }
}

// base: the list as last synced; sha: GitHub's version of it.
export async function syncOnce({ gh, repo, local, base, sha }) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const rem = await readRemote(gh, repo);
    if (rem.error) return { status: 'error', error: rem.error };
    let target, message;
    if (rem.missing) { target = local; message = 'Cable Ctrl: first list'; }
    else if (rem.sha === sha && base) {
      if (same(local, base)) return { status: 'synced', list: local, base, sha, wrote: false };
      target = local; message = listCommitMessage(base, local);
    } else {
      const m = mergeLists(base, local, rem.doc);
      if (m.conflicts.length) return { status: 'conflict', merged: m.list, conflicts: m.conflicts, remote: rem.doc, remoteSha: rem.sha };
      if (same(m.list, rem.doc)) return { status: 'synced', list: m.list, base: rem.doc, sha: rem.sha, wrote: false };
      target = m.list; message = listCommitMessage(rem.doc, m.list);
    }
    const w = await gh.write(LIST_PATH, JSON.stringify(target, null, 2), rem.missing ? null : rem.sha, message);
    if (w.stale) { if (!rem.missing) { base = rem.doc; sha = rem.sha; local = target; } continue; }
    if (w.error) return { status: 'error', error: w.error };
    if (rem.missing) { const rd = await gh.read(README_PATH); if (rd.missing) await gh.write(README_PATH, readme(repo), null, 'Cable Ctrl: README'); }
    return { status: 'synced', list: target, base: target, sha: w.sha, message, wrote: true };
  }
  return { status: 'error', error: { kind: 'busy', title: 'GitHub kept changing', text: 'GitHub kept changing while this synced. Try Sync now in a minute.' } };
}
