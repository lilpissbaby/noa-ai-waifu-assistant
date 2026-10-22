import { icons } from '../shared/icons.js';

const wd = window.wd;
const view = document.getElementById('view');
const params = new URLSearchParams(location.search);
let pc = null; // { config, secrets, presets, secureStorage, platform }
let tab = params.get('tab') || 'general';
let lastLocalEdit = 0;

// ---------------------------------------------------------------- mini DOM
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  return el;
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.add('hidden'), 2200);
}

const getPath = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);
function patchFor(path, value) {
  const keys = path.split('.');
  const root = {};
  let cur = root;
  keys.forEach((k, i) => {
    if (i === keys.length - 1) cur[k] = value;
    else cur = cur[k] = {};
  });
  return root;
}

const pending = new Map();
function save(path, value, delay = 350) {
  lastLocalEdit = Date.now();
  // actualiza copia local
  const keys = path.split('.');
  let o = pc.config;
  keys.slice(0, -1).forEach((k) => (o = o[k] ??= {}));
  o[keys.at(-1)] = value;
  clearTimeout(pending.get(path));
  pending.set(
    path,
    setTimeout(async () => {
      pending.delete(path);
      pc = await wd.invoke('cfg:patch', patchFor(path, value));
      lastLocalEdit = Date.now();
      toast('Guardado');
    }, delay),
  );
}

// ---------------------------------------------------------------- controles
function field(label, control, help) {
  return h('label', { class: 'field' }, h('span', {}, label), control, help ? h('small', { html: help }) : null);
}
function text(path, { placeholder = '', type = 'text', onchange } = {}) {
  return h('input', {
    type,
    value: getPath(pc.config, path) ?? '',
    placeholder,
    oninput: (e) => {
      const v = type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value;
      save(path, v);
      onchange?.(v);
    },
  });
}
function area(path, rows = 3, placeholder = '') {
  return h('textarea', { rows, placeholder, value: getPath(pc.config, path) ?? '', oninput: (e) => save(path, e.target.value) });
}
function select(path, options, onchange) {
  const cur = getPath(pc.config, path);
  return h(
    'select',
    {
      onchange: (e) => {
        save(path, e.target.value, 0);
        onchange?.(e.target.value);
      },
    },
    options.map(([v, l]) => h('option', { value: v, selected: String(v) === String(cur) }, l)),
  );
}
function check(path, label, onchange) {
  return h(
    'label',
    { class: 'check' },
    h('input', {
      type: 'checkbox',
      checked: !!getPath(pc.config, path),
      onchange: (e) => {
        save(path, e.target.checked, 0);
        onchange?.(e.target.checked);
      },
    }),
    label,
  );
}
function secret(ref, placeholder = 'Pega aquí la clave') {
  const has = pc.secrets?.[ref];
  let timer;
  return h('input', {
    type: 'password',
    placeholder: has ? '•••••••••••• (guardada — escribe para cambiarla)' : placeholder,
    autocomplete: 'off',
    oninput: (e) => {
      clearTimeout(timer);
      const v = e.target.value.trim();
      timer = setTimeout(async () => {
        await wd.invoke('cfg:set-secret', ref, v);
        lastLocalEdit = Date.now();
        toast(v ? 'Clave guardada (cifrada)' : 'Clave borrada');
      }, 500);
    },
  });
}
function card(title, desc, ...kids) {
  return h('section', { class: 'card' }, h('h2', {}, ...[].concat(title)), desc ? h('p', { class: 'desc', html: desc }) : null, ...kids);
}
function result() {
  return h('div', { class: 'result' });
}
async function runTest(el, fn) {
  el.className = 'result';
  el.textContent = 'Probando…';
  try {
    const r = await fn();
    el.className = 'result ok';
    el.textContent = typeof r === 'string' ? r : r?.message || 'OK';
    return r;
  } catch (e) {
    el.className = 'result err';
    el.textContent = String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
    return null;
  }
}
async function saveList(key, list) {
  lastLocalEdit = Date.now();
  const keys = key.split('.');
  let o = pc.config;
  keys.slice(0, -1).forEach((k) => (o = o[k]));
  o[keys.at(-1)] = list;
  pc = await wd.invoke('cfg:patch', patchFor(key, list));
  lastLocalEdit = Date.now();
}
// Edita un campo de un elemento de una lista (perfil, webhook, servidor MCP).
function itemText(listKey, idx, prop, opts = {}) {
  const list = getPath(pc.config, listKey);
  return h('input', {
    type: opts.type || 'text',
    value: list[idx][prop] ?? '',
    placeholder: opts.placeholder || '',
    list: opts.list,
    oninput: (e) => {
      const v = opts.type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value;
      list[idx][prop] = v;
      save(listKey, list, 500);
      opts.onchange?.(v);
    },
  });
}
function itemCheck(listKey, idx, prop, label, def = true) {
  const list = getPath(pc.config, listKey);
  const val = list[idx][prop] ?? def;
  return h(
    'label',
    { class: 'check' },
    h('input', {
      type: 'checkbox',
      checked: !!val,
      onchange: (e) => {
        list[idx][prop] = e.target.checked;
        save(listKey, list, 0);
      },
    }),
    label,
  );
}

// ---------------------------------------------------------------- pestañas
const TABS = {
  general() {
    const c = pc.config;
    const isLinux = pc.platform === 'linux';
    return [
      h('h1', {}, 'General'),
      h('p', { class: 'lead' }, 'Quién es tu asistente, cómo se comporta y cómo vive en el escritorio.'),
      params.get('welcome')
        ? card(
            '¡Bienvenida!',
            'Para empezar: añade tu API key en <b>Modelos de IA</b>. Después, si quieres hablarle, configura el dictado en <b>Voz</b> (Groq tiene un plan gratuito muy rápido).',
            h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => go('models') }, 'Configurar modelo')),
          )
        : null,
      card(
        'Personaje',
        null,
        h(
          'div',
          { class: 'grid' },
          field('Nombre de la asistente', text('assistant.name')),
          field('Cómo te llama a ti', text('assistant.userName', { placeholder: 'tu nombre o apodo' })),
          field('Idioma de respuesta', text('assistant.language')),
          h('div'),
          h('div', { class: 'full' }, field('Personalidad', area('assistant.personality', 3))),
          h(
            'div',
            { class: 'full' },
            field(
              'Instrucciones extra',
              area('assistant.extraInstructions', 4, 'Ej.: Mi VPS usa Docker Compose detrás de nginx. Cuando te pida código, dame primero el comando y luego la explicación.'),
              'Se añaden al prompt de sistema en cada conversación.',
            ),
          ),
        ),
      ),
      card(
        'Escritorio',
        null,
        h(
          'div',
          { class: 'grid' },
          field(
            'Tamaño',
            select(
              'ui.scale',
              [0.6, 0.8, 1, 1.25, 1.5, 2].map((s) => [s, `${Math.round(s * 100)} %`]),
            ),
          ),
          h('div'),
          field('Atajo: abrir chat', text('ui.hotkeyChat'), 'Formato Electron: <kbd>Control+Alt+Space</kbd>, <kbd>Super+J</kbd>…'),
          field('Atajo: hablar', text('ui.hotkeyTalk'), 'Pulsa para empezar a escucharte; se para sola al callarte.'),
          h(
            'div',
            { class: 'full' },
            check('ui.alwaysOnTop', 'Siempre por encima de las demás ventanas'),
            check('ui.followCursor', 'Gira la cabeza siguiendo el ratón'),
            isLinux ? null : check('ui.startWithSystem', 'Arrancar al iniciar sesión'),
          ),
        ),
        h(
          'div',
          { class: 'row', style: 'margin-top:10px' },
          h('button', { class: 'btn', onclick: () => wd.invoke('app:open-userdata') }, 'Abrir carpeta de datos'),
          h('button', { class: 'btn', onclick: () => wd.invoke('app:open-log') }, 'Ver registro de errores'),
        ),
      ),
      card(
        'Cómo se usa',
        null,
        h('div', {
          class: 'desc',
          html: `<b>Clic</b> en ${esc(c.assistant.name)}: abre o cierra el chat · <b>Doble clic</b>: hablarle · <b>Arrastrar</b>: moverla · <b>Clic derecho</b>: menú (modelo, skin, tamaño…). También vive en la bandeja del sistema.`,
        }),
      ),
    ];
  },

  models() {
    const c = pc.config;
    const presets = pc.presets;
    const list = c.profiles;
    const items = list.map((p, i) => {
      const dl = `models-${p.id}`;
      const res = result();
      const kindSel = h(
        'select',
        {
          onchange: (e) => {
            list[i].kind = e.target.value;
            save('profiles', list, 0);
          },
        },
        h('option', { value: 'anthropic', selected: p.kind === 'anthropic' }, 'Anthropic (Claude)'),
        h('option', { value: 'openai', selected: p.kind === 'openai' }, 'OpenAI-compatible'),
      );
      return h(
        'div',
        { class: 'item' },
        h(
          'div',
          { class: 'item-head' },
          h('strong', {}, p.name || 'Perfil'),
          p.id === c.activeProfileId ? h('span', { class: 'pill active' }, 'En uso') : null,
          h('span', { class: 'spacer' }),
          p.id !== c.activeProfileId
            ? h(
                'button',
                {
                  class: 'btn',
                  onclick: async () => {
                    pc = await wd.invoke('cfg:patch', { activeProfileId: p.id });
                    render();
                  },
                },
                'Usar este',
              )
            : null,
          h(
            'button',
            {
              class: 'btn ghost danger',
              title: 'Borrar perfil',
              onclick: async () => {
                if (list.length <= 1) return toast('Necesitas al menos un perfil');
                const next = list.filter((x) => x.id !== p.id);
                await saveList('profiles', next);
                if (c.activeProfileId === p.id) pc = await wd.invoke('cfg:patch', { activeProfileId: next[0].id });
                render();
              },
              html: icons.trash,
            },
          ),
        ),
        h(
          'div',
          { class: 'grid' },
          field('Nombre', itemText('profiles', i, 'name')),
          field('Tipo de API', kindSel),
          h('div', { class: 'full' }, field('URL base', itemText('profiles', i, 'baseUrl'), p.kind === 'anthropic' ? 'Normalmente <code>https://api.anthropic.com</code>' : 'Termina en <code>/v1</code> (o la ruta compatible del proveedor).')),
          field('API key', secret(`profile:${p.id}`, p.kind === 'openai' ? 'Opcional en servidores locales' : 'sk-ant-…')),
          field(
            'Modelo',
            h(
              'div',
              { class: 'inline' },
              itemText('profiles', i, 'model', { list: dl, placeholder: 'id del modelo' }),
              h(
                'button',
                {
                  class: 'btn',
                  title: 'Pedir la lista de modelos al proveedor',
                  onclick: async () => {
                    const models = await runTest(res, async () => {
                      const m = await wd.invoke('models:list', list[i]);
                      return { message: `${m.length} modelos disponibles`, m };
                    });
                    if (models?.m) document.getElementById(dl).innerHTML = models.m.map((x) => `<option value="${esc(x)}">`).join('');
                  },
                },
                'Cargar',
              ),
            ),
          ),
          h('datalist', { id: dl }),
          field('Máx. tokens de respuesta', itemText('profiles', i, 'maxTokens', { type: 'number' })),
          field('Temperatura', itemText('profiles', i, 'temperature', { type: 'number', placeholder: 'por defecto' })),
          h(
            'div',
            { class: 'full' },
            itemCheck('profiles', i, 'toolsEnabled', 'Permitir herramientas (Paperclip, Hermes, webhooks, MCP…)'),
            h('small', { class: 'muted' }, 'Desactívalo si el modelo no soporta tool calling o si es el propio Hermes (que ya tiene las suyas).'),
          ),
        ),
        res,
      );
    });
    const presetSel = h(
      'select',
      {},
      Object.entries(presets).map(([k, v]) => h('option', { value: k }, v.name)),
    );
    return [
      h('h1', {}, 'Modelos de IA'),
      h(
        'p',
        { class: 'lead' },
        'Cada perfil es un modelo con su API key. Cambia de uno a otro desde el chat o el menú del avatar. Las claves se guardan cifradas con el almacén seguro del sistema.',
      ),
      params.get('welcome')
        ? h(
            'section',
            { class: 'card welcome' },
            h('h2', {}, `¡Hola! Soy ${c.assistant.name}`),
            h('p', {
              class: 'desc',
              html: 'Para empezar, pega tu API key en el perfil de Claude (o añade otro proveedor). Luego, si quieres hablarme, configura el dictado en <b>Voz</b>: Groq tiene un plan gratuito muy rápido. Cuando quieras, conecta Hermes y Paperclip.',
            }),
          )
        : null,
      ...items,
      card(
        'Añadir perfil',
        'Elige un proveedor de partida y ajusta luego la URL, la clave y el modelo.',
        h(
          'div',
          { class: 'inline' },
          presetSel,
          h(
            'button',
            {
              class: 'btn primary',
              onclick: async () => {
                const preset = presets[presetSel.value];
                const id = await wd.invoke('cfg:new-id');
                await saveList('profiles', [...list, { id, ...preset, maxTokens: 4096, temperature: null }]);
                render();
              },
            },
            'Añadir',
          ),
        ),
      ),
    ];
  },

  voice() {
    const v = pc.config.voice;
    const sttPresets = {
      groq: { baseUrl: 'https://api.groq.com/openai/v1', model: 'whisper-large-v3-turbo' },
      openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini-transcribe' },
      custom: { baseUrl: 'http://TU-VPS:8000/v1', model: 'Systran/faster-whisper-small' },
    };
    const ttsBox = h('div');
    const sttRes = result();
    const ttsRes = result();

    const renderTts = () => {
      ttsBox.innerHTML = '';
      const mode = v.tts.mode;
      if (mode === 'system') {
        const voiceSel = h('select', {
          onchange: (e) => save('voice.tts.systemVoice', e.target.value, 0),
        });
        const fill = () => {
          const voices = speechSynthesis.getVoices();
          voiceSel.innerHTML = '';
          voiceSel.append(h('option', { value: '' }, 'Automática (primera en español)'));
          for (const x of voices.sort((a, b) => (/^es/.test(b.lang) ? 1 : 0) - (/^es/.test(a.lang) ? 1 : 0)))
            voiceSel.append(h('option', { value: x.name, selected: x.name === v.tts.systemVoice }, `${x.name} (${x.lang})`));
        };
        fill();
        speechSynthesis.onvoiceschanged = fill;
        ttsBox.append(
          h(
            'div',
            { class: 'grid' },
            h('div', { class: 'full' }, field('Voz del sistema', voiceSel, 'Gratis y sin conexión. En Windows puedes instalar más voces en Configuración → Hora e idioma → Voz.')),
            field('Velocidad', text('voice.tts.rate', { type: 'number' })),
            field('Tono', text('voice.tts.pitch', { type: 'number' }), 'Un tono algo más agudo (1.2–1.4) le pega al personaje.'),
          ),
        );
      } else if (mode === 'openai') {
        ttsBox.append(
          h(
            'div',
            { class: 'grid' },
            h(
              'div',
              { class: 'full' },
              field(
                'URL base',
                text('voice.tts.baseUrl'),
                'OpenAI (<code>https://api.openai.com/v1</code>) o un servidor compatible en tu VPS, p. ej. Kokoro-FastAPI (<code>http://TU-VPS:8880/v1</code>, voces <code>ef_dora</code>, <code>jf_alpha</code>…).',
              ),
            ),
            field('API key', secret('tts', 'Opcional en servidores propios')),
            field('Modelo', text('voice.tts.model')),
            field('Voz', text('voice.tts.voice')),
            field('Velocidad', text('voice.tts.rate', { type: 'number' })),
          ),
        );
      } else if (mode === 'elevenlabs') {
        ttsBox.append(
          h(
            'div',
            { class: 'grid' },
            field('API key de ElevenLabs', secret('tts')),
            field('Voice ID', text('voice.tts.elevenVoiceId', { placeholder: 'id de la voz en tu biblioteca' })),
            field('Modelo', text('voice.tts.elevenModel')),
          ),
        );
      }
      if (mode !== 'off')
        ttsBox.append(
          h(
            'div',
            { class: 'row', style: 'margin-top:12px' },
            h(
              'button',
              {
                class: 'btn',
                onclick: () => runTest(ttsRes, async () => (await wd.invoke('voice:test-tts', `¡Hola${pc.config.assistant.userName ? `, ${pc.config.assistant.userName}` : ''}! Soy ${pc.config.assistant.name}. Así sueno ahora mismo.`), 'Reproduciendo en el avatar…')),
                html: `${icons.play} Probar voz`,
              },
            ),
          ),
          ttsRes,
        );
    };
    renderTts();

    return [
      h('h1', {}, 'Voz'),
      h('p', { class: 'lead' }, 'Dictado (lo que dices → texto) y voz de la asistente (texto → audio, con la boca sincronizada).'),
      card(
        'Dictado',
        'Se graba al hacer doble clic en el avatar o con el atajo, y se para sola cuando dejas de hablar.',
        h(
          'div',
          { class: 'grid' },
          field(
            'Proveedor',
            select(
              'voice.stt.provider',
              [
                ['groq', 'Groq Whisper (rápido, plan gratis)'],
                ['openai', 'OpenAI'],
                ['custom', 'Servidor propio compatible (faster-whisper / speaches)'],
                ['off', 'Desactivado'],
              ],
              async (val) => {
                if (sttPresets[val]) {
                  await wd.invoke('cfg:patch', { voice: { stt: { provider: val, ...sttPresets[val] } } });
                  pc = await wd.invoke('cfg:get');
                  render();
                }
              },
            ),
          ),
          field('Idioma', text('voice.stt.language'), 'Código ISO: <code>es</code>, <code>en</code>… vacío = autodetectar.'),
          h('div', { class: 'full' }, field('URL base', text('voice.stt.baseUrl'))),
          field('API key', secret('stt')),
          field('Modelo', text('voice.stt.model')),
          h('div', { class: 'full' }, check('voice.autoStopOnSilence', 'Parar automáticamente cuando dejo de hablar')),
        ),
        sttRes,
      ),
      card(
        'Voz de la asistente',
        null,
        h(
          'div',
          { class: 'grid' },
          field(
            'Motor',
            select(
              'voice.tts.mode',
              [
                ['system', 'Voces del sistema (gratis)'],
                ['openai', 'OpenAI-compatible (OpenAI, Kokoro…)'],
                ['elevenlabs', 'ElevenLabs'],
                ['off', 'Sin voz'],
              ],
              (val) => {
                v.tts.mode = val;
                renderTts();
              },
            ),
          ),
          field(
            'Cuándo habla',
            select('voice.speakReplies', [
              ['voice', 'Solo si le hablo por voz'],
              ['always', 'Siempre'],
              ['never', 'Nunca (solo texto)'],
            ]),
          ),
        ),
        h('div', { style: 'margin-top:14px' }, ttsBox),
      ),
    ];
  },

  connectors() {
    const hm = pc.config.connectors.hermes;
    const pp = pc.config.connectors.paperclip;
    const hRes = result();
    const pRes = result();
    const companySel = h('div');
    return [
      h('h1', {}, 'Hermes y Paperclip'),
      h(
        'p',
        { class: 'lead' },
        'Con estos conectores tu asistente puede delegar trabajo a tu agente Hermes del VPS y crear, asignar y revisar tareas de tus agentes en Paperclip, solo con pedírselo.',
      ),
      card(
        ['Hermes Agent', h('span', { class: `pill ${hm.enabled ? 'on' : ''}` }, hm.enabled ? 'activo' : 'apagado')],
        'Hermes (Nous Research) expone una API compatible con OpenAI. La asistente lo usa como herramienta <code>hermes_task</code> para tareas que deben hacerse en el servidor.',
        check('connectors.hermes.enabled', 'Activar herramienta Hermes', () => setTimeout(render, 400)),
        h(
          'div',
          { class: 'grid', style: 'margin-top:8px' },
          h('div', { class: 'full' }, field('URL del API server', text('connectors.hermes.baseUrl'), 'Ej.: <code>https://hermes.tudominio.com/v1</code> detrás de tu nginx con TLS, o <code>http://localhost:8642/v1</code> con un túnel SSH.')),
          field('API_SERVER_KEY', secret('hermes')),
          field('Nombre del modelo', text('connectors.hermes.model'), 'Por defecto <code>hermes-agent</code> (o el nombre del perfil).'),
          field('Tiempo máximo (s)', text('connectors.hermes.timeoutSec', { type: 'number' })),
        ),
        h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { class: 'btn', onclick: () => runTest(hRes, () => wd.invoke('test:hermes')) }, 'Probar conexión')),
        hRes,
        h(
          'details',
          { class: 'help' },
          h('summary', {}, 'Cómo activarlo en el VPS'),
          h('ol', {
            html: `<li>En <code>~/.hermes/.env</code> añade:</li>`,
          }),
          h('pre', { class: 'snippet' }, 'API_SERVER_ENABLED=true\nAPI_SERVER_KEY=una-clave-larga-y-aleatoria\nAPI_SERVER_HOST=127.0.0.1\nAPI_SERVER_PORT=8642'),
          h('ol', {
            start: 2,
            html: `<li>Arranca <code>hermes gateway</code> (o el contenedor <code>nousresearch/hermes-agent</code>).</li>
<li>Publica el puerto con tu reverse proxy (subdominio con TLS) o haz un túnel: <code>ssh -N -L 8642:127.0.0.1:8642 usuario@vps</code>.</li>
<li>Si quieres hablar <i>directamente</i> con Hermes, usa el perfil «Hermes Agent (VPS)» en Modelos con la misma URL y clave.</li>`,
          }),
          h('div', { class: 'warn-box', html: 'Hermes tiene acceso a la terminal del servidor. No lo expongas sin clave ni sin TLS.' }),
        ),
      ),
      card(
        ['Paperclip', h('span', { class: `pill ${pp.enabled ? 'on' : ''}` }, pp.enabled ? 'activo' : 'apagado')],
        'Herramientas para listar agentes y proyectos, crear y actualizar tareas, comentar y despertar agentes. Las acciones que cambian cosas piden confirmación (o «Permitir siempre»).',
        check('connectors.paperclip.enabled', 'Activar herramientas de Paperclip', () => setTimeout(render, 400)),
        h(
          'div',
          { class: 'grid', style: 'margin-top:8px' },
          h('div', { class: 'full' }, field('URL de Paperclip', text('connectors.paperclip.baseUrl'), 'La raíz del servidor (por defecto <code>http://localhost:3100</code>); se añade <code>/api</code> sola.')),
          field('Token (Bearer)', secret('paperclip', 'Vacío si usas modo local_trusted'), 'En modo <i>authenticated</i> usa una API key de board.'),
          field('ID de la empresa', text('connectors.paperclip.companyId', { placeholder: 'uuid de la company' }), 'Aparece en la URL: <code>/companies/&lt;id&gt;</code>.'),
        ),
        h(
          'div',
          { class: 'row', style: 'margin-top:12px' },
          h(
            'button',
            {
              class: 'btn',
              onclick: async () => {
                const r = await runTest(pRes, () => wd.invoke('test:paperclip'));
                companySel.innerHTML = '';
                if (r?.companies?.length) {
                  companySel.append(
                    h(
                      'div',
                      { class: 'row', style: 'margin-top:8px' },
                      ...r.companies.map((co) =>
                        h(
                          'button',
                          {
                            class: 'btn',
                            onclick: () => {
                              save('connectors.paperclip.companyId', co.id, 0);
                              setTimeout(render, 500);
                            },
                          },
                          `Usar «${co.name}»`,
                        ),
                      ),
                    ),
                  );
                }
              },
            },
            'Probar y listar empresas',
          ),
        ),
        pRes,
        companySel,
      ),
    ];
  },

  automations() {
    const c = pc.config.connectors;
    const whList = c.webhooks || [];
    const mcpList = c.mcpServers || [];
    const toolsBox = h('div', { class: 'tool-list' }, h('span', { class: 'muted' }, 'Cargando…'));
    wd.invoke('tools:list').then((tools) => {
      toolsBox.innerHTML = '';
      for (const t of tools) toolsBox.append(h('code', { title: t.description }, t.name));
    });
    const mcpStatusBox = h('div', { class: 'result' });
    const refreshMcp = async (sync) => {
      mcpStatusBox.textContent = sync ? 'Conectando…' : '';
      const st = await wd.invoke(sync ? 'mcp:sync' : 'mcp:status');
      mcpStatusBox.innerHTML = st.length
        ? st
            .map((s) => `<div><b>${esc(s.name)}</b>: ${s.connected ? `<span style="color:var(--ok)">conectado</span> · ${s.tools.length} herramientas` : `<span style="color:var(--err)">${esc(s.error || 'desconectado')}</span>`}</div>`)
            .join('')
        : '<span class="muted">Ningún servidor activo.</span>';
    };
    refreshMcp(false);

    const wh = whList.map((w, i) =>
      h(
        'div',
        { class: 'item' },
        h(
          'div',
          { class: 'item-head' },
          h('strong', {}, w.name || 'Webhook'),
          h('span', { class: 'spacer' }),
          h('button', {
            class: 'btn ghost danger',
            html: icons.trash,
            onclick: async () => {
              await saveList('connectors.webhooks', whList.filter((_, j) => j !== i));
              render();
            },
          }),
        ),
        h(
          'div',
          { class: 'grid' },
          field('Nombre (será la herramienta webhook_…)', itemText('connectors.webhooks', i, 'name', { placeholder: 'backup vps' })),
          field(
            'Método',
            h(
              'select',
              {
                onchange: (e) => {
                  whList[i].method = e.target.value;
                  save('connectors.webhooks', whList, 0);
                },
              },
              ['POST', 'GET', 'PUT', 'PATCH'].map((m) => h('option', { selected: (w.method || 'POST') === m }, m)),
            ),
          ),
          h('div', { class: 'full' }, field('Qué hace (la IA lo lee para decidir cuándo usarlo)', itemText('connectors.webhooks', i, 'description', { placeholder: 'Lanza la copia de seguridad del VPS en n8n. payload: {"target": "db"|"files"}' }))),
          h('div', { class: 'full' }, field('URL', itemText('connectors.webhooks', i, 'url', { placeholder: 'https://n8n.tudominio.com/webhook/…' }))),
          field('Token (Authorization)', secret(`webhook:${w.id}`, 'Opcional')),
          field('Cabeceras extra (JSON)', itemText('connectors.webhooks', i, 'headersJson', { placeholder: '{"X-Api-Key": "…"}' })),
          h('div', { class: 'full row' }, itemCheck('connectors.webhooks', i, 'enabled', 'Activo'), itemCheck('connectors.webhooks', i, 'confirm', 'Pedir confirmación antes de lanzarlo', false)),
        ),
      ),
    );

    const mcp = mcpList.map((s, i) =>
      h(
        'div',
        { class: 'item' },
        h(
          'div',
          { class: 'item-head' },
          h('strong', {}, s.name || 'Servidor MCP'),
          h('span', { class: 'pill' }, s.type === 'http' ? 'HTTP' : 'stdio'),
          h('span', { class: 'spacer' }),
          h('button', {
            class: 'btn ghost danger',
            html: icons.trash,
            onclick: async () => {
              await saveList('connectors.mcpServers', mcpList.filter((_, j) => j !== i));
              render();
            },
          }),
        ),
        h(
          'div',
          { class: 'grid' },
          field('Nombre', itemText('connectors.mcpServers', i, 'name')),
          field(
            'Transporte',
            h(
              'select',
              {
                onchange: async (e) => {
                  mcpList[i].type = e.target.value;
                  await saveList('connectors.mcpServers', mcpList);
                  render();
                },
              },
              h('option', { value: 'stdio', selected: s.type !== 'http' }, 'stdio (comando local)'),
              h('option', { value: 'http', selected: s.type === 'http' }, 'HTTP (Streamable)'),
            ),
          ),
          ...(s.type === 'http'
            ? [
                h('div', { class: 'full' }, field('URL', itemText('connectors.mcpServers', i, 'url', { placeholder: 'https://mcp.tudominio.com/mcp' }))),
                field('Token (Bearer)', secret(`mcp:${s.id}`, 'Opcional')),
                field('Cabeceras extra (JSON)', itemText('connectors.mcpServers', i, 'headersJson')),
              ]
            : [
                field('Comando', itemText('connectors.mcpServers', i, 'command', { placeholder: 'npx | uvx | node | python' })),
                field('Argumentos', itemText('connectors.mcpServers', i, 'args', { placeholder: '-y @modelcontextprotocol/server-filesystem C:\\Users\\tu\\Documents' })),
                h(
                  'div',
                  { class: 'full' },
                  field(
                    'Variables de entorno (una por línea, CLAVE=valor)',
                    h('textarea', {
                      rows: 2,
                      value: s.env || '',
                      oninput: (e) => {
                        mcpList[i].env = e.target.value;
                        save('connectors.mcpServers', mcpList, 600);
                      },
                    }),
                  ),
                ),
              ]),
          h('div', { class: 'full row' }, itemCheck('connectors.mcpServers', i, 'enabled', 'Activo'), itemCheck('connectors.mcpServers', i, 'confirm', 'Pedir confirmación en cada llamada', false)),
        ),
      ),
    );

    const autoApproved = Object.keys(pc.config.tools.autoApprove || {}).filter((k) => pc.config.tools.autoApprove[k]);
    return [
      h('h1', {}, 'Automatizaciones'),
      h('p', { class: 'lead' }, 'Dale manos a tu asistente: webhooks de tus automatizaciones (n8n, Make, Home Assistant…), servidores MCP y, si quieres, comandos en este PC.'),
      card(
        'Comandos en este PC',
        'Permite la herramienta <code>run_command</code> (PowerShell en Windows, bash en Linux). Útil para <code>ssh</code> al VPS, <code>docker</code>, <code>git</code> o tus scripts.',
        check('connectors.shell.enabled', 'Permitir ejecutar comandos', () => setTimeout(render, 400)),
        h('div', { class: 'warn-box', html: 'Cada comando se muestra y necesita tu aprobación explícita. Nunca se aprueba solo.' }),
      ),
      card(
        'Webhooks',
        'Cada webhook se convierte en una herramienta. Escribe bien la descripción: es lo que la IA lee para decidir cuándo y cómo llamarlo.',
        ...wh,
        h(
          'button',
          {
            class: 'btn',
            onclick: async () => {
              const id = await wd.invoke('cfg:new-id');
              await saveList('connectors.webhooks', [...whList, { id, name: '', description: '', url: '', method: 'POST', enabled: true, confirm: true }]);
              render();
            },
            html: `${icons.plus} Añadir webhook`,
          },
        ),
      ),
      card(
        'Servidores MCP',
        'Conecta cualquier servidor <a href="#" data-ext="https://modelcontextprotocol.io">Model Context Protocol</a>: sistema de archivos, GitHub, Home Assistant, <code>paperclip-mcp</code>…',
        ...mcp,
        h(
          'div',
          { class: 'row' },
          h(
            'button',
            {
              class: 'btn',
              onclick: async () => {
                const id = await wd.invoke('cfg:new-id');
                await saveList('connectors.mcpServers', [...mcpList, { id, name: 'nuevo', type: 'stdio', command: 'npx', args: '', env: '', enabled: false }]);
                render();
              },
              html: `${icons.plus} Añadir servidor`,
            },
          ),
          h('button', { class: 'btn', onclick: () => refreshMcp(true) }, 'Conectar / refrescar'),
        ),
        mcpStatusBox,
      ),
      card(
        'Herramientas activas',
        'Lo que tu asistente puede usar ahora mismo.',
        toolsBox,
        autoApproved.length
          ? h(
              'div',
              { style: 'margin-top:14px' },
              h('small', { class: 'muted' }, `Aprobadas siempre: ${autoApproved.join(', ')}`),
              h(
                'div',
                { class: 'row', style: 'margin-top:8px' },
                h(
                  'button',
                  {
                    class: 'btn',
                    onclick: async () => {
                      pc = await wd.invoke('cfg:replace', { ...pc.config, tools: { autoApprove: {} } });
                      render();
                    },
                  },
                  'Volver a pedir confirmación',
                ),
              ),
            )
          : null,
      ),
    ];
  },

  skins() {
    const grid = h('div', { class: 'skins' });
    (async () => {
      const skins = await wd.invoke('skin:list');
      grid.innerHTML = '';
      for (const s of skins) {
        const cur = s.id === pc.config.ui.skinId;
        grid.append(
          h(
            'div',
            { class: `skin ${cur ? 'current' : ''}` },
            h('div', { class: 'thumb' }, h('img', { src: s.thumb, alt: s.name })),
            h(
              'div',
              { class: 'meta' },
              h('strong', {}, s.name),
              h(
                'div',
                { class: 'row' },
                cur
                  ? h('span', { class: 'pill active' }, 'En uso')
                  : h(
                      'button',
                      {
                        class: 'btn primary',
                        onclick: async () => {
                          await wd.invoke('skin:use', s.id);
                          pc = await wd.invoke('cfg:get');
                          render();
                        },
                      },
                      'Usar',
                    ),
                s.builtin ? null : h('button', { class: 'btn', onclick: () => wd.invoke('win:open', 'editor', { id: s.id }) }, 'Ajustar'),
                s.builtin
                  ? null
                  : h('button', {
                      class: 'btn ghost danger',
                      html: icons.trash,
                      title: 'Borrar',
                      onclick: async () => {
                        await wd.invoke('skin:delete', s.id);
                        pc = await wd.invoke('cfg:get');
                        render();
                      },
                    }),
              ),
            ),
          ),
        );
      }
      grid.append(
        h(
          'div',
          { class: 'skin add', onclick: () => wd.invoke('win:open', 'editor') },
          h('span', { html: icons.image }),
          h('strong', {}, 'Importar un dibujo'),
          h('small', { class: 'muted' }, 'Desde archivo, portapapeles o URL. Se recorta el fondo y marcas ojos, boca y cuello.'),
        ),
      );
    })();
    return [h('h1', {}, 'Skins'), h('p', { class: 'lead' }, 'Cambia el aspecto de tu asistente o crea uno nuevo a partir de cualquier dibujo.'), grid];
  },
};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function render() {
  const scroll = view.scrollTop;
  view.innerHTML = '';
  for (const node of TABS[tab]()) if (node) view.append(node);
  view.scrollTop = scroll;
  document.querySelectorAll('.side button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
}

function go(t) {
  tab = t;
  view.scrollTop = 0;
  render();
}

document.querySelectorAll('.side button').forEach((b) => b.addEventListener('click', () => go(b.dataset.tab)));
view.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-ext]');
  if (a) {
    e.preventDefault();
    wd.invoke('app:open-external', a.dataset.ext);
  }
});

wd.on('cfg:changed', (next) => {
  pc = next;
  // No repintar mientras se escribe aquí mismo.
  if (Date.now() - lastLocalEdit > 1500 && !view.contains(document.activeElement)) render();
});
wd.on('skin:list-changed', () => tab === 'skins' && render());
wd.on('win:query', (q) => q?.tab && go(q.tab));

(async () => {
  pc = await wd.invoke('cfg:get');
  document.getElementById('storageNote').textContent = pc.secureStorage
    ? 'Las claves se guardan cifradas con el almacén del sistema.'
    : 'Aviso: no hay almacén seguro disponible; las claves se guardan solo ofuscadas.';
  render();
})();
