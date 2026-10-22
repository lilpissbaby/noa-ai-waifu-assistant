// Lector genérico de Server-Sent Events sobre un ReadableStream de fetch.
export async function* readSSE(body, signal) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.search(/\r?\n\r?\n/)) !== -1) {
        const raw = buf.slice(0, idx);
        buf = buf.slice(idx).replace(/^\r?\n\r?\n/, '');
        const evt = parseEvent(raw);
        if (evt) yield evt;
      }
    }
    if (buf.trim()) {
      const evt = parseEvent(buf);
      if (evt) yield evt;
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* noop */
    }
  }
}

function parseEvent(raw) {
  let event = 'message';
  const data = [];
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith(':')) continue;
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
  }
  if (!data.length) return null;
  return { event, data: data.join('\n') };
}

export async function httpError(res, label) {
  let detail = '';
  try {
    detail = await res.text();
    const j = JSON.parse(detail);
    detail = j.error?.message || j.message || j.error || detail;
    if (typeof detail === 'object') detail = JSON.stringify(detail);
  } catch {
    /* texto plano */
  }
  const err = new Error(`${label}: HTTP ${res.status}${detail ? ` — ${String(detail).slice(0, 400)}` : ''}`);
  err.status = res.status;
  return err;
}
