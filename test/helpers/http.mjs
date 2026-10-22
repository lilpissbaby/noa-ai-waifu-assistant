// Servidor HTTP local para simular APIs (Anthropic, OpenAI-compatible, Paperclip…).
import http from 'node:http';

export async function serve(handler) {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const entry = { method: req.method, url: req.url, headers: req.headers, body: body ? safeJson(body) : null };
    requests.push(entry);
    try {
      await handler(entry, res);
    } catch (e) {
      res.writeHead(500).end(String(e));
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  return { url: `http://127.0.0.1:${port}`, requests, close: () => new Promise((r) => server.close(r)) };
}

const safeJson = (s) => {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
};

// Envía una lista de eventos SSE. Cada elemento: objeto (se manda como data JSON), string o [event, data].
export function sendSSE(res, events) {
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  for (const e of events) {
    if (Array.isArray(e)) res.write(`event: ${e[0]}\ndata: ${JSON.stringify(e[1])}\n\n`);
    else res.write(`data: ${typeof e === 'string' ? e : JSON.stringify(e)}\n\n`);
  }
  res.end();
}

export const json = (res, data, status = 200) => res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(data));
