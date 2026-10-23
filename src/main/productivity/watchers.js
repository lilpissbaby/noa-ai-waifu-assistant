// Vigila las tareas de Paperclip que la asistente creó o comentó y avisa cuando terminan, se
// bloquean o piden revisión. La lista vive en userData/watch.json.
import fs from 'node:fs';
import path from 'node:path';

export const NOTIFY_STATUSES = ['done', 'blocked', 'in_review', 'cancelled'];
const CLOSED = ['done', 'cancelled'];

export class PaperclipWatcher {
  constructor({ file, getIssue, onChange }) {
    Object.assign(this, { file, getIssue, onChange });
    this.items = this.#load();
    this.polling = null;
  }

  #load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      return Array.isArray(raw) ? raw.filter((x) => x && typeof x.id === 'string') : [];
    } catch {
      return [];
    }
  }

  #save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(`${this.file}.tmp`, JSON.stringify(this.items, null, 2));
    fs.renameSync(`${this.file}.tmp`, this.file);
  }

  list() {
    return this.items.map((x) => ({ ...x }));
  }

  watch(id, status = null, title = '') {
    const key = String(id);
    const cur = this.items.find((x) => x.id === key);
    if (cur) {
      if (title && !cur.title) cur.title = title;
      if (status && !cur.status) cur.status = status;
    } else
      this.items.push({
        id: key,
        status: status || null,
        title: title || '',
        since: new Date().toISOString(),
      });
    this.#save();
  }

  unwatch(id) {
    const before = this.items.length;
    this.items = this.items.filter((x) => x.id !== String(id));
    if (this.items.length !== before) this.#save();
  }

  // Una pasada: consulta cada tarea; un fallo en una no impide mirar las demás.
  poll() {
    if (this.polling) return this.polling;
    this.polling = (async () => {
      const changes = [];
      for (const item of [...this.items]) {
        let issue;
        try {
          issue = await this.getIssue(item.id);
        } catch {
          continue;
        }
        const to = issue?.status;
        if (!to || to === item.status) continue;
        const from = item.status;
        item.status = to;
        if (!item.title && issue.title) item.title = [issue.identifier, issue.title].filter(Boolean).join(' · ');
        if (from && NOTIFY_STATUSES.includes(to)) {
          changes.push({ id: item.id, from, to });
          try {
            this.onChange(issue, from, to);
          } catch {
            /* un aviso que falla no para el resto */
          }
        }
        if (CLOSED.includes(to)) this.items = this.items.filter((x) => x !== item);
      }
      this.#save();
      return changes;
    })().finally(() => {
      this.polling = null;
    });
    return this.polling;
  }
}
