// Servidor simulado para las pruebas de humo y las capturas: API compatible con OpenAI (con
// llamadas a herramientas), Hermes Agent, Paperclip y Whisper. Respuestas en el idioma pedido.
import http from 'node:http';

const REPLIES = {
  es: {
    hello: '¡Hola! Soy Noa. Puedo hablar con tus agentes de Paperclip, mandarle trabajo a Hermes en el VPS y lanzar tus automatizaciones.',
    time: '<emo:happy>Son las {time}. ¿Te pongo un recordatorio?',
    created: '¡Hecho! He creado **PAP-7 · Migrar Postgres a la 17** y se la he asignado al CTO con prioridad alta.\n\n- Estado: `todo`\n- Le he despertado para que empiece ya.',
    hermes: 'Hermes ha revisado el VPS: **12 contenedores** en marcha y `nginx`, `portainer` y `postgres` sanos. Disco al 61 %.',
    issueTitle: 'Migrar Postgres a la 17',
    screen: 'Veo tu escritorio con la ventana de la terminal abierta.',
    organize: 'Para hoy tienes **2 tareas**: renovar el dominio (venció ayer, prioridad alta) y el informe trimestral a las 18:00.\n\nTe he puesto **25 minutos de concentración** para el informe; te aviso cuando toque descansar.',
    monitor: 'Todo en marcha salvo **Uptime Kuma**, que no responde desde hace 12 minutos (timeout). Te he mandado el resumen al móvil.',
  },
  en: {
    hello: "Hi! I'm Noa. I can talk to your Paperclip agents, send work to Hermes on your VPS and run your automations.",
    time: "<emo:happy>It's {time}. Want me to set a reminder?",
    created: 'Done! I created **PAP-7 · Migrate Postgres to 17** and assigned it to the CTO with high priority.\n\n- Status: `todo`\n- I woke them up so they start right away.',
    hermes: 'Hermes checked the VPS: **12 containers** up and `nginx`, `portainer` and `postgres` healthy. Disk at 61 %.',
    issueTitle: 'Migrate Postgres to 17',
    screen: 'I can see your desktop with the terminal window open.',
    organize: 'You have **2 tasks** for today: renew the domain (due yesterday, high priority) and the quarterly report at 18:00.\n\nI started **25 minutes of focus** for the report; I will tell you when to take a break.',
    monitor: 'Everything is up except **Uptime Kuma**, which has not responded for 12 minutes (timeout). I sent the summary to your phone.',
  },
  ru: {
    hello: 'Привет! Я Noa. Могу общаться с вашими агентами в Paperclip, передавать работу Hermes на VPS и запускать автоматизации.',
    time: '<emo:happy>Сейчас {time}. Поставить напоминание?',
    created: 'Готово! Я создала **PAP-7 · Перевести Postgres на 17** и назначила её CTO с высоким приоритетом.\n\n- Статус: `todo`\n- Разбудила агента, чтобы он начал сразу.',
    hermes: 'Hermes проверил VPS: работают **12 контейнеров**, `nginx`, `portainer` и `postgres` в порядке. Диск заполнен на 61 %.',
    issueTitle: 'Перевести Postgres на 17',
    screen: 'Вижу ваш рабочий стол с открытым окном терминала.',
    organize: 'На сегодня **2 задачи**: продлить домен (срок был вчера, высокий приоритет) и квартальный отчёт к 18:00.\n\nВключила **25 минут фокуса** для отчёта; скажу, когда пора отдохнуть.',
    monitor: 'Всё работает, кроме **Uptime Kuma**: не отвечает уже 12 минут (таймаут). Отправила сводку тебе на телефон.',
  },
  uk: {
    hello: 'Привіт! Я Noa. Можу спілкуватися з вашими агентами в Paperclip, передавати роботу Hermes на VPS і запускати автоматизації.',
    time: '<emo:happy>Зараз {time}. Поставити нагадування?',
    created: 'Готово! Я створила **PAP-7 · Перевести Postgres на 17** і призначила її CTO з високим пріоритетом.\n\n- Статус: `todo`\n- Розбудила агента, щоб він почав одразу.',
    hermes: 'Hermes перевірив VPS: працюють **12 контейнерів**, `nginx`, `portainer` і `postgres` у порядку. Диск заповнений на 61 %.',
    issueTitle: 'Перевести Postgres на 17',
    screen: 'Бачу ваш робочий стіл із відкритим вікном термінала.',
    organize: 'На сьогодні **2 завдання**: продовжити домен (термін був учора, високий пріоритет) і квартальний звіт до 18:00.\n\nУвімкнула **25 хвилин фокусу** для звіту; скажу, коли треба відпочити.',
    monitor: 'Усе працює, крім **Uptime Kuma**: не відповідає вже 12 хвилин (тайм-аут). Надіслала зведення тобі на телефон.',
  },
  zh: {
    hello: '你好！我是 Noa。我可以和你在 Paperclip 里的智能体沟通，把工作交给 VPS 上的 Hermes，还能运行你的自动化。',
    time: '<emo:happy>现在是 {time}。要我设个提醒吗？',
    created: '搞定！我创建了 **PAP-7 · 将 Postgres 升级到 17**，并以高优先级分配给了 CTO。\n\n- 状态：`todo`\n- 已经唤醒它，马上开工。',
    hermes: 'Hermes 检查了 VPS：**12 个容器**正在运行，`nginx`、`portainer` 和 `postgres` 都正常。磁盘使用率 61 %。',
    issueTitle: '将 Postgres 升级到 17',
    screen: '我看到你的桌面上开着终端窗口。',
    organize: '今天有 **2 项任务**：续费域名（昨天到期，高优先级）和 18:00 前完成的季度报告。\n\n我为报告开启了 **25 分钟专注**，该休息时会提醒你。',
    monitor: '除了 **Uptime Kuma** 以外都正常，它已经 12 分钟没有响应（超时）。我把摘要发到你手机上了。',
  },
};

const HERMES_RESULT = '12 containers up; nginx, portainer and postgres healthy. Disk at 61 %.';

function detectLang(system) {
  const m = /Always reply in ([A-Za-z ]+)/.exec(system || '');
  const name = (m?.[1] || '').toLowerCase();
  if (name.startsWith('spanish')) return 'es';
  if (name.startsWith('russian')) return 'ru';
  if (name.startsWith('ukrainian')) return 'uk';
  if (name.startsWith('simplified chinese')) return 'zh';
  return 'en';
}

const sse = (res) => {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  return (obj) => res.write(`data: ${typeof obj === 'string' ? obj : JSON.stringify(obj)}\n\n`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function streamText(send, text, delay) {
  for (const piece of text.match(/[\s\S]{1,6}/g) || []) {
    send({ choices: [{ index: 0, delta: { content: piece } }] });
    if (delay) await sleep(delay);
  }
  send({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] });
}

function toolCall(send, id, name, args) {
  send({ choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id, type: 'function', function: { name, arguments: JSON.stringify(args) } }] } }] });
  send({ choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] });
}

export async function startMockServer({ delay = 0 } = {}) {
  const issues = [];
  const images = []; // data: URL de las imágenes recibidas (captura de pantalla)
  const files = []; // textos de archivos adjuntos recibidos
  const briefings = []; // peticiones internas de resumen diario
  const server = http.createServer(async (req, res) => {
    let raw = '';
    for await (const c of req) raw += c;
    const body = raw && req.headers['content-type']?.includes('json') ? JSON.parse(raw) : null;
    const url = new URL(req.url, 'http://x');
    const json = (data, status = 200) => res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(data));

    // ---------------- modelo OpenAI-compatible
    if (url.pathname === '/v1/chat/completions') {
      const msgs = body.messages || [];
      const lang = detectLang(msgs.find((m) => m.role === 'system')?.content);
      const L = REPLIES[lang];
      // Un aviso de la app (mensaje del asistente sin herramientas) puede ir detrás del resultado de una
      // herramienta: lo que cuenta es el último mensaje del usuario, de una herramienta o con llamadas.
      const last = msgs.findLast((m) => m.role !== 'assistant' || m.tool_calls?.length) || msgs.at(-1);
      const send = sse(res);
      const userContent = [...msgs].reverse().find((m) => m.role === 'user')?.content || '';
      const userText = Array.isArray(userContent) ? userContent.map((p) => p.text || '').join(' ') : userContent;
      const image = Array.isArray(last.content) ? last.content.find((p) => p.type === 'image_url') : null;
      const attached = Array.isArray(last.content) ? last.content.filter((p) => p.type === 'text' && p.text.startsWith('Attached file:')) : [];
      if (last.role === 'user' && userText.startsWith('[Daily briefing]')) {
        briefings.push(userText);
        await streamText(send, L.hello, delay);
      } else if (last.role === 'user' && attached.length) {
        files.push(...attached.map((p) => p.text));
        await streamText(send, L.hello, delay);
      } else if (last.role === 'user' && image) {
        images.push(image.image_url.url);
        await streamText(send, L.screen, delay);
      } else if (last.role === 'user' && /pendiente hoy|due today|на сегодня|на сьогодні|今天要做/i.test(userText)) {
        toolCall(send, 'call_tasks', 'task_list', { filter: 'today' });
      } else if (last.role === 'tool' && last.tool_call_id === 'call_tasks') {
        toolCall(send, 'call_focus', 'focus_start', { minutes: 25, label: 'Informe trimestral' });
      } else if (last.role === 'tool' && last.tool_call_id === 'call_focus') {
        await streamText(send, L.organize, delay);
      } else if (last.role === 'user' && /al móvil|to my phone|на телефон|到我手机/i.test(userText)) {
        toolCall(send, 'call_mon', 'monitor_status', {});
      } else if (last.role === 'tool' && last.tool_call_id === 'call_mon') {
        toolCall(send, 'call_phone', 'phone_notify', { title: 'Servicios', message: 'Uptime Kuma no responde desde hace 12 min.', priority: 'high' });
      } else if (last.role === 'tool' && last.tool_call_id === 'call_phone') {
        await streamText(send, L.monitor, delay);
      } else if (last.role === 'user' && /pantalla|screen|экран|屏幕/i.test(userText)) {
        toolCall(send, 'call_s', 'screen_capture', { target: 'screen' });
      } else if (last.role === 'user' && /paperclip|PAP|tarea|task|задач|任务/i.test(userText)) {
        toolCall(send, 'call_issue', 'paperclip_create_issue', { title: L.issueTitle, assigneeAgentId: 'a1', priority: 'high' });
      } else if (last.role === 'tool' && last.tool_call_id === 'call_issue') {
        toolCall(send, 'call_wake', 'paperclip_wakeup_agent', { agentId: 'a1', issueId: 'PAP-7' });
      } else if (last.role === 'tool' && last.tool_call_id === 'call_wake') {
        await streamText(send, L.created, delay);
      } else if (last.role === 'user' && /hermes/i.test(userText)) {
        toolCall(send, 'call_h', 'hermes_task', { task: 'docker ps --format table' });
      } else if (last.role === 'tool' && last.tool_call_id === 'call_h') {
        await streamText(send, L.hermes, delay);
      } else if (last.role === 'user' && /hora|time|час|время|时间|几点/i.test(userText)) {
        toolCall(send, 'call_t', 'get_current_time', {});
      } else if (last.role === 'tool' && last.tool_call_id === 'call_t') {
        const local = JSON.parse(last.content).local || '';
        await streamText(send, L.time.replace('{time}', local.split(/,\s*|\s+/).slice(-1)[0] || local), delay);
      } else {
        await streamText(send, L.hello, delay);
      }
      send('[DONE]');
      return res.end();
    }
    if (url.pathname === '/v1/models') return json({ data: [{ id: 'mock-model' }, { id: 'mock-model-large' }] });

    // ---------------- ntfy (avisos al móvil)
    if (url.pathname === '/ntfy' && req.method === 'POST') return json({ id: 'n1', event: 'message', topic: body?.topic });

    // ---------------- web: un artículo y un SearXNG
    if (url.pathname === '/web/article')
      return res
        .writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        .end(
          '<html><head><title>Notas de la versión</title><script>var x = "NO"</script></head><body><nav>Menú</nav><article><h1>Notas de la versión</h1><p>Waifu Desk añade avatares VTuber con Live2D, voces locales Piper y un montón de herramientas de productividad para el día a día.</p><p>También puede leer páginas web y buscar con tu propio SearXNG, sin depender de nadie.</p></article></body></html>',
        );
    if (url.pathname === '/searx/search') return json({ results: [{ title: 'Waifu Desk', url: `http://127.0.0.1:${server.address().port}/web/article`, content: 'Asistente con avatar' }] });

    // ---------------- Hermes Agent
    if (url.pathname === '/hermes/v1/chat/completions') {
      const send = sse(res);
      await streamText(send, HERMES_RESULT, delay);
      send('[DONE]');
      return res.end();
    }
    if (url.pathname === '/hermes/v1/models') return json({ data: [{ id: 'hermes-agent' }] });

    // ---------------- Whisper
    if (url.pathname === '/v1/audio/transcriptions') return json({ text: 'hola' });

    // ---------------- Paperclip
    if (url.pathname === '/api/companies') return json([{ id: 'c1', name: 'Tenebrum Labs' }]);
    if (url.pathname === '/api/companies/c1/agents') return json([{ id: 'a1', name: 'CTO', role: 'cto', status: 'idle' }]);
    if (url.pathname === '/api/companies/c1/issues' && req.method === 'POST') {
      const issue = { id: 'i7', identifier: 'PAP-7', ...body };
      issues.push(issue);
      return json(issue);
    }
    if (url.pathname === '/api/companies/c1/issues') return json(issues);
    if (/^\/api\/issues\/[^/]+$/.test(url.pathname)) {
      const issue = issues.find((i) => i.id === decodeURIComponent(url.pathname.split('/').pop()));
      return issue ? json(issue) : json({ error: 'not found' }, 404);
    }
    if (/^\/api\/agents\/[^/]+\/wakeup$/.test(url.pathname)) return json({ ok: true, runId: 'r1' });

    json({ error: `mock: ${req.method} ${url.pathname}` }, 404);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const close = () =>
    new Promise((r) => {
      server.closeAllConnections?.(); // net.fetch deja conexiones keep-alive abiertas
      server.close(r);
    });
  return { base, issues, images, files, briefings, close };
}

// Configuración que apunta todos los conectores al servidor simulado.
export function mockConfigPatch(base) {
  return {
    profiles: [
      { id: 'mock', kind: 'openai', name: 'Claude Sonnet', baseUrl: `${base}/v1`, model: 'claude-sonnet-5-5', toolsEnabled: true, maxTokens: 1024, temperature: null },
      { id: 'hermes', kind: 'openai', name: 'Hermes Agent (VPS)', baseUrl: `${base}/hermes/v1`, model: 'hermes-agent', toolsEnabled: false, maxTokens: 1024, temperature: null },
    ],
    activeProfileId: 'mock',
    connectors: {
      hermes: { enabled: true, baseUrl: `${base}/hermes/v1`, model: 'hermes-agent', timeoutSec: 60 },
      paperclip: { enabled: true, baseUrl: base, companyId: 'c1' },
    },
    tools: { autoApprove: { paperclip_create_issue: true, paperclip_wakeup_agent: true } },
    voice: { stt: { provider: 'custom', baseUrl: `${base}/v1`, model: 'whisper-1' }, tts: { mode: 'off' } },
    // Sin teclado ni ratón (Xvfb, CI) se dormiría al minuto: el modo mascota se prueba aparte.
    ui: { followCursor: false, presence: { sleep: false } },
  };
}
