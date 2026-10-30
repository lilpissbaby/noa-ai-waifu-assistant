// Vigila el CI de GitHub Actions de los repos que elijas y avisa cuando una ejecución falla, y
// cuando vuelve a pasar en verde después de fallar. La primera pasada solo aprende el estado (no
// avisa de lo que ya había). Estado en userData/ci-watch.json.
import { readJson, writeJson } from './json-file.js';

export class CiWatcher {
  // latestRuns(repo) → [{ id, name, status, conclusion, head_branch, html_url, display_title, run_number }]
  // onFinish(repo, run, 'failed' | 'fixed')
  constructor({ file, repos = () => [], latestRuns, onFinish = () => {} }) {
    Object.assign(this, { file, repos, latestRuns, onFinish });
    const raw = readJson(file, {});
    this.state = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    this.polling = null;
  }

  // Estado por repo: { lastId, last: { 'workflow@branch': conclusion } }
  async #pollRepo(repo) {
    const runs = (await this.latestRuns(repo)).filter((r) => r && r.status === 'completed').sort((a, b) => a.id - b.id);
    const st = this.state[repo];
    if (!st) {
      const last = {};
      for (const r of runs) last[`${r.name}@${r.head_branch}`] = r.conclusion;
      this.state[repo] = { lastId: runs.at(-1)?.id || 0, last };
      return [];
    }
    const events = [];
    for (const r of runs) {
      if (r.id <= st.lastId) continue;
      const key = `${r.name}@${r.head_branch}`;
      const prev = st.last[key];
      if (r.conclusion === 'failure' || r.conclusion === 'timed_out') events.push({ repo, run: r, kind: 'failed' });
      else if (r.conclusion === 'success' && (prev === 'failure' || prev === 'timed_out')) events.push({ repo, run: r, kind: 'fixed' });
      if (r.conclusion !== 'cancelled' && r.conclusion !== 'skipped') st.last[key] = r.conclusion;
      st.lastId = Math.max(st.lastId, r.id);
    }
    return events;
  }

  poll() {
    if (this.polling) return this.polling;
    this.polling = (async () => {
      const repos = this.repos();
      const all = [];
      for (const repo of repos) {
        try {
          const events = await this.#pollRepo(repo);
          for (const e of events) {
            all.push(e);
            try {
              this.onFinish(e.repo, e.run, e.kind);
            } catch {
              /* un aviso que falla no para el resto */
            }
          }
        } catch {
          /* sin red o sin permiso: se reintenta en la siguiente pasada */
        }
      }
      for (const repo of Object.keys(this.state)) if (!repos.includes(repo)) delete this.state[repo];
      writeJson(this.file, this.state);
      return all;
    })().finally(() => {
      this.polling = null;
    });
    return this.polling;
  }
}
