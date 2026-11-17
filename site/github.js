// The person's own GitHub data repo, shared with Box Ctrl and Tool Ctrl (CC-R100 to CC-R116). Copied from Box Ctrl's github.js.
// Talks only to api.github.com, only for that repo. The token goes in a header, never in an address,
// and never into the list, an export or the repo (CC-R103).

export const LIST_PATH = 'cable-ctrl.json';
export const README_PATH = 'README.md';
const API = 'https://api.github.com';

export const repoError = (r) => (/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/.test(String(r).trim()) ? '' : 'Enter the repo as owner/name, such as your-name/ctrl-data.');

export function toB64(text) {
  const bytes = new TextEncoder().encode(text); let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function fromB64(b64) {
  const s = atob(String(b64).replace(/\s/g, ''));
  const bytes = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// What went wrong, in plain words, and what to do (CC-R113, CC-S20)
export function explain(status, repo, what = '') {
  if (status === 0) return { kind: 'offline', text: 'GitHub can\'t be reached. Changes wait in this browser and go when the connection is back.' };
  if (status === 401) return { kind: 'auth', title: 'GitHub refused the token', text: `It may have expired or been revoked. Make a new one for ${repo} with Contents read and write, and paste it here.` };
  if (status === 403) return { kind: 'rights', title: 'The token can\'t do that', text: `The token can't ${what || 'use'} ${repo}. Give it Contents read and write for this repo, or wait if GitHub says too many requests.` };
  if (status === 404) return { kind: 'missing', title: 'Repo not found', text: `There is no repo ${repo} that this token can see. Check the name, and that the token covers this repo.` };
  return { kind: 'other', title: 'GitHub didn\'t answer as expected', text: `GitHub answered ${status}. Nothing changed in this browser; try Sync now in a minute.` };
}

export function client(repo, token, fetchFn = (...a) => fetch(...a)) {
  const call = async (path, opts = {}) => {
    let res;
    try {
      res = await fetchFn(`${API}/repos/${repo}${path}`, { ...opts, cache: 'no-store',
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(opts.body ? { 'Content-Type': 'application/json' } : {}) } });
    } catch { return { status: 0 }; }
    let json = null; try { json = await res.json(); } catch { /* empty body */ }
    return { status: res.status, json };
  };
  return {
    // CC-R104: does the repo exist, is it private, can this token write?
    async check() {
      const r = await call('');
      if (r.status !== 200) return { error: explain(r.status, repo) };
      return { private: !!r.json.private, canWrite: !!r.json.permissions?.push, name: r.json.full_name || repo };
    },
    // The files at the top of the repo, with their versions 
    async list() {
      const r = await call('/contents/');
      if (r.status === 404) return { files: {} }; // an empty repo has no contents yet
      if (r.status !== 200 || !Array.isArray(r.json)) return { error: explain(r.status, repo, 'read') };
      return { files: Object.fromEntries(r.json.map((f) => [f.name, f.sha])) };
    },
    // One file as base64, or missing
    async raw(path) {
      const r = await call(`/contents/${path}`);
      if (r.status === 404) return { missing: true };
      if (r.status !== 200) return { error: explain(r.status, repo, 'read') };
      let b64 = r.json.content;
      if (r.json.encoding === 'none' || !b64) { // files over 1 MB come back by blob
        const b = await call(`/git/blobs/${r.json.sha}`);
        if (b.status !== 200) return { error: explain(b.status, repo, 'read') };
        b64 = b.json.content;
      }
      return { b64: String(b64).replace(/\s/g, ''), sha: r.json.sha };
    },
    async read(path) {
      const f = await this.raw(path);
      return f.b64 == null ? f : { text: fromB64(f.b64), sha: f.sha };
    },
    // CC-R111: GitHub refuses a write based on an old copy (409); the caller merges and tries again
    async put(path, b64, sha, message) {
      const r = await call(`/contents/${path}`, { method: 'PUT', body: JSON.stringify({ message, content: b64, ...(sha ? { sha } : {}) }) });
      if (r.status === 200 || r.status === 201) return { sha: r.json.content.sha };
      if (r.status === 409 || (r.status === 422 && /sha/i.test(r.json?.message || ''))) return { stale: true };
      return { error: explain(r.status, repo, 'write to') };
    },
    write(path, text, sha, message) { return this.put(path, toB64(text), sha, message); },
    async remove(path, sha, message) {
      const r = await call(`/contents/${path}`, { method: 'DELETE', body: JSON.stringify({ message, sha }) });
      if (r.status === 200 || r.status === 404) return { ok: true };
      if (r.status === 409 || r.status === 422) return { stale: true };
      return { error: explain(r.status, repo, 'write to') };
    },
  };
}

// CC-R106: written only when the repo has no README
export const readme = (repo) => `# Ctrl data

This private repo holds files written by WOODWERD tools.

- \`${LIST_PATH}\` is written by [Cable Ctrl](https://woodwerd.github.io/cable-ctrl/): your cable label list, types and tab size.
- Other WOODWERD tools, such as [Box Ctrl](https://woodwerd.github.io/box-ctrl/) and [Tool Ctrl](https://woodwerd.github.io/tool-ctrl/), keep their own files here when you use them.

Edit them in those tools, not by hand. Each sync is one commit, so the history of every change is in this repo's commits.
Keep this repo private. It can name your equipment and where it is.

Repo: ${repo}
`;
