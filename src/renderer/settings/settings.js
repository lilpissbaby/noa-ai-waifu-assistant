import { icons } from '../shared/icons.js';
import { t, tHtml, setLocale, getLocale, SUPPORTED, LANGUAGES } from '../../shared/i18n/index.js';
import { applyDom } from '../../shared/i18n/dom.js';
import { assistantName } from '../../shared/personas.js';

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
  const box = document.getElementById('toast');
  box.textContent = msg;
  box.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => box.classList.add('hidden'), 2200);
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
      toast(t('settings.saved'));
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
function secret(ref, placeholder = t('settings.secret.placeholder')) {
  const has = pc.secrets?.[ref];
  let timer;
  return h('input', {
    type: 'password',
    placeholder: has ? t('settings.secret.saved') : placeholder,
    autocomplete: 'off',
    oninput: (e) => {
      clearTimeout(timer);
      const v = e.target.value.trim();
      timer = setTimeout(async () => {
        await wd.invoke('cfg:set-secret', ref, v);
        lastLocalEdit = Date.now();
        toast(v ? t('settings.secret.toastSaved') : t('settings.secret.toastDeleted'));
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
  el.textContent = t('settings.testing');
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
    const langOptions = [['auto', t('settings.general.languageAuto')], ...SUPPORTED.map((code) => [code, LANGUAGES[code].native])];
    return [
      h('h1', {}, t('settings.nav.general')),
      h('p', { class: 'lead' }, t('settings.general.lead')),
      params.get('welcome')
        ? card(
            t('settings.general.welcomeTitle'),
            t('settings.general.welcomeText'),
            h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => go('models') }, t('settings.general.setupModel'))),
          )
        : null,
      card(
        t('settings.general.language'),
        null,
        h(
          'div',
          { class: 'grid' },
          field(t('settings.general.interfaceLanguage'), select('ui.language', langOptions), t('settings.general.languageHelp')),
          field(
            t('settings.general.replyLanguage'),
            text('assistant.language', { placeholder: t('settings.general.replyLanguagePlaceholder', { language: LANGUAGES[getLocale()].native }) }),
            t('settings.general.replyLanguageHelp'),
          ),
        ),
      ),
      card(
        t('settings.general.character'),
        null,
        h(
          'div',
          { class: 'grid' },
          field(t('settings.general.userName'), text('assistant.userName', { placeholder: t('settings.general.userNamePlaceholder') })),
        ),
      ),
      card(
        t('settings.general.desktop'),
        null,
        h(
          'div',
          { class: 'grid' },
          field(
            t('settings.general.size'),
            select(
              'ui.scale',
              [0.6, 0.8, 1, 1.25, 1.5, 2].map((s) => [s, `${Math.round(s * 100)} %`]),
            ),
          ),
          h('div'),
          field(t('settings.general.hotkeyChat'), text('ui.hotkeyChat'), t('settings.general.hotkeyChatHelp')),
          field(t('settings.general.hotkeyTalk'), text('ui.hotkeyTalk'), t('settings.general.hotkeyTalkHelp')),
          h(
            'div',
            { class: 'full' },
            check('ui.alwaysOnTop', t('settings.general.alwaysOnTop')),
            check('ui.followCursor', t('settings.general.followCursor')),
            check('ui.emotions', t('settings.general.emotions')),
            isLinux ? null : check('ui.startWithSystem', t('settings.general.startWithSystem')),
          ),
        ),
        h(
          'div',
          { class: 'row', style: 'margin-top:10px' },
          h('button', { class: 'btn', onclick: () => wd.invoke('app:open-userdata') }, t('settings.general.openData')),
          h('button', { class: 'btn', onclick: () => wd.invoke('app:open-log') }, t('settings.general.openLog')),
        ),
      ),
      card(
        t('settings.general.howTo'),
        null,
        h('div', {
          class: 'desc',
          html: tHtml('settings.general.howToText', { name: assistantName(c) }),
        }),
      ),
      h('p', { class: 'muted small version' }, `Waifu Desk ${pc.version || ''}`),
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
        h('option', { value: 'openai', selected: p.kind === 'openai' }, t('settings.models.openaiCompatible')),
      );
      return h(
        'div',
        { class: 'item' },
        h(
          'div',
          { class: 'item-head' },
          h('strong', {}, p.name || t('settings.models.profile')),
          p.id === c.activeProfileId ? h('span', { class: 'pill active' }, t('settings.common.inUse')) : null,
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
                t('settings.models.useThis'),
              )
            : null,
          h(
            'button',
            {
              class: 'btn ghost danger',
              title: t('settings.models.deleteProfile'),
              onclick: async () => {
                if (list.length <= 1) return toast(t('settings.models.needOne'));
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
          field(t('settings.common.name'), itemText('profiles', i, 'name')),
          field(t('settings.models.apiType'), kindSel),
          h('div', { class: 'full' }, field(t('settings.common.baseUrl'), itemText('profiles', i, 'baseUrl'), p.kind === 'anthropic' ? t('settings.models.baseUrlAnthropic') : t('settings.models.baseUrlOpenai'))),
          field('API key', secret(`profile:${p.id}`, p.kind === 'openai' ? t('settings.models.keyOptionalLocal') : 'sk-ant-…')),
          field(
            t('settings.common.model'),
            h(
              'div',
              { class: 'inline' },
              itemText('profiles', i, 'model', { list: dl, placeholder: t('settings.models.modelPlaceholder') }),
              h(
                'button',
                {
                  class: 'btn',
                  title: t('settings.models.loadTitle'),
                  onclick: async () => {
                    const models = await runTest(res, async () => {
                      const m = await wd.invoke('models:list', list[i]);
                      return { message: t('settings.models.available', { count: m.length }), m };
                    });
                    if (models?.m) document.getElementById(dl).innerHTML = models.m.map((x) => `<option value="${esc(x)}">`).join('');
                  },
                },
                t('settings.models.load'),
              ),
            ),
          ),
          h('datalist', { id: dl }),
          field(t('settings.models.maxTokens'), itemText('profiles', i, 'maxTokens', { type: 'number' })),
          field(t('settings.models.temperature'), itemText('profiles', i, 'temperature', { type: 'number', placeholder: t('settings.models.default') })),
          h(
            'div',
            { class: 'full' },
            itemCheck('profiles', i, 'toolsEnabled', t('settings.models.allowTools')),
            h('small', { class: 'muted' }, t('settings.models.allowToolsHelp')),
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
      h('h1', {}, t('settings.nav.models')),
      h('p', { class: 'lead' }, t('settings.models.lead')),
      params.get('welcome')
        ? h(
            'section',
            { class: 'card welcome' },
            h('h2', {}, t('settings.models.welcomeTitle', { name: assistantName(c) })),
            h('p', { class: 'desc', html: t('settings.models.welcomeText') }),
          )
        : null,
      ...items,
      card(
        t('settings.models.addProfile'),
        t('settings.models.addProfileText'),
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
            t('settings.common.add'),
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
      custom: { baseUrl: 'http://your-vps:8000/v1', model: 'Systran/faster-whisper-small' },
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
          const lang = getLocale();
          const mine = (x) => (x.lang.toLowerCase().startsWith(lang) ? 1 : 0);
          voiceSel.innerHTML = '';
          voiceSel.append(h('option', { value: '' }, t('settings.voice.systemAuto', { language: LANGUAGES[lang].native })));
          for (const x of voices.sort((a, b) => mine(b) - mine(a)))
            voiceSel.append(h('option', { value: x.name, selected: x.name === v.tts.systemVoice }, `${x.name} (${x.lang})`));
        };
        fill();
        speechSynthesis.onvoiceschanged = fill;
        ttsBox.append(
          h(
            'div',
            { class: 'grid' },
            h('div', { class: 'full' }, field(t('settings.voice.systemVoice'), voiceSel, t('settings.voice.systemVoiceHelp'))),
            field(t('settings.voice.rate'), text('voice.tts.rate', { type: 'number' })),
            field(t('settings.voice.pitch'), text('voice.tts.pitch', { type: 'number' }), t('settings.voice.pitchHelp')),
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
              field(t('settings.common.baseUrl'), text('voice.tts.baseUrl'), t('settings.voice.ttsUrlHelp')),
            ),
            field('API key', secret('tts', t('settings.voice.keyOptionalOwn'))),
            field(t('settings.common.model'), text('voice.tts.model')),
            field(t('settings.voice.voice'), text('voice.tts.voice')),
            field(t('settings.voice.rate'), text('voice.tts.rate', { type: 'number' })),
          ),
        );
      } else if (mode === 'elevenlabs') {
        ttsBox.append(
          h(
            'div',
            { class: 'grid' },
            field(t('settings.voice.elevenKey'), secret('tts')),
            field('Voice ID', text('voice.tts.elevenVoiceId', { placeholder: t('settings.voice.elevenVoicePlaceholder') })),
            field(t('settings.common.model'), text('voice.tts.elevenModel')),
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
                onclick: () => {
                  const a = pc.config.assistant;
                  const phrase = a.userName ? t('settings.voice.testPhraseUser', { user: a.userName, name: a.name }) : t('settings.voice.testPhrase', { name: a.name });
                  runTest(ttsRes, async () => (await wd.invoke('voice:test-tts', phrase), t('settings.voice.playing')));
                },
                html: `${icons.play} ${esc(t('settings.voice.test'))}`,
              },
            ),
          ),
          ttsRes,
        );
    };
    renderTts();

    return [
      h('h1', {}, t('settings.nav.voice')),
      h('p', { class: 'lead' }, t('settings.voice.lead')),
      card(
        t('settings.voice.dictation'),
        t('settings.voice.dictationText'),
        h(
          'div',
          { class: 'grid' },
          field(
            t('settings.voice.provider'),
            select(
              'voice.stt.provider',
              [
                ['groq', t('settings.voice.sttGroq')],
                ['openai', 'OpenAI'],
                ['custom', t('settings.voice.sttCustom')],
                ['off', t('settings.voice.off')],
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
          field(t('settings.voice.sttLanguage'), text('voice.stt.language'), t('settings.voice.sttLanguageHelp')),
          h('div', { class: 'full' }, field(t('settings.common.baseUrl'), text('voice.stt.baseUrl'))),
          field('API key', secret('stt')),
          field(t('settings.common.model'), text('voice.stt.model')),
          h('div', { class: 'full' }, check('voice.autoStopOnSilence', t('settings.voice.autoStop'))),
        ),
        sttRes,
      ),
      card(
        t('settings.voice.assistantVoice'),
        null,
        h(
          'div',
          { class: 'grid' },
          field(
            t('settings.voice.engine'),
            select(
              'voice.tts.mode',
              [
                ['system', t('settings.voice.ttsSystem')],
                ['openai', t('settings.voice.ttsOpenai')],
                ['elevenlabs', 'ElevenLabs'],
                ['off', t('settings.voice.ttsOff')],
              ],
              (val) => {
                v.tts.mode = val;
                renderTts();
              },
            ),
          ),
          field(
            t('settings.voice.whenSpeak'),
            select('voice.speakReplies', [
              ['voice', t('settings.voice.speakVoice')],
              ['always', t('settings.voice.speakAlways')],
              ['never', t('settings.voice.speakNever')],
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
      h('h1', {}, t('settings.nav.connectors')),
      h('p', { class: 'lead' }, t('settings.conn.lead')),
      card(
        ['Hermes Agent', h('span', { class: `pill ${hm.enabled ? 'on' : ''}` }, hm.enabled ? t('settings.common.on') : t('settings.common.off'))],
        t('settings.conn.hermesText'),
        check('connectors.hermes.enabled', t('settings.conn.hermesEnable'), () => setTimeout(render, 400)),
        h(
          'div',
          { class: 'grid', style: 'margin-top:8px' },
          h('div', { class: 'full' }, field(t('settings.conn.hermesUrl'), text('connectors.hermes.baseUrl'), t('settings.conn.hermesUrlHelp'))),
          field('API_SERVER_KEY', secret('hermes')),
          field(t('settings.conn.hermesModel'), text('connectors.hermes.model'), t('settings.conn.hermesModelHelp')),
          field(t('settings.conn.hermesTimeout'), text('connectors.hermes.timeoutSec', { type: 'number' })),
        ),
        h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { class: 'btn', onclick: () => runTest(hRes, () => wd.invoke('test:hermes')) }, t('settings.conn.test'))),
        hRes,
        h(
          'details',
          { class: 'help' },
          h('summary', {}, t('settings.conn.hermesHowTo')),
          h('ol', { html: `<li>${t('settings.conn.hermesStep1')}</li>` }),
          h('pre', { class: 'snippet' }, 'API_SERVER_ENABLED=true\nAPI_SERVER_KEY=a-long-random-key\nAPI_SERVER_HOST=127.0.0.1\nAPI_SERVER_PORT=8642'),
          h('ol', {
            start: 2,
            html: `<li>${t('settings.conn.hermesStep2')}</li><li>${t('settings.conn.hermesStep3')}</li><li>${t('settings.conn.hermesStep4')}</li>`,
          }),
          h('div', { class: 'warn-box', html: t('settings.conn.hermesWarn') }),
        ),
      ),
      card(
        ['Paperclip', h('span', { class: `pill ${pp.enabled ? 'on' : ''}` }, pp.enabled ? t('settings.common.on') : t('settings.common.off'))],
        t('settings.conn.paperclipText'),
        check('connectors.paperclip.enabled', t('settings.conn.paperclipEnable'), () => setTimeout(render, 400)),
        h(
          'div',
          { class: 'grid', style: 'margin-top:8px' },
          h('div', { class: 'full' }, field(t('settings.conn.paperclipUrl'), text('connectors.paperclip.baseUrl'), t('settings.conn.paperclipUrlHelp'))),
          field('Token (Bearer)', secret('paperclip', t('settings.conn.paperclipTokenPlaceholder')), t('settings.conn.paperclipTokenHelp')),
          field(t('settings.conn.companyId'), text('connectors.paperclip.companyId', { placeholder: t('settings.conn.companyIdPlaceholder') }), t('settings.conn.companyIdHelp')),
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
                          t('settings.conn.useCompany', { name: co.name }),
                        ),
                      ),
                    ),
                  );
                }
              },
            },
            t('settings.conn.testCompanies'),
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
    const toolsBox = h('div', { class: 'tool-list' }, h('span', { class: 'muted' }, t('settings.common.loading')));
    wd.invoke('tools:list').then((tools) => {
      toolsBox.innerHTML = '';
      for (const tool of tools) toolsBox.append(h('code', { title: tool.description }, tool.name));
    });
    const mcpStatusBox = h('div', { class: 'result' });
    const refreshMcp = async (sync) => {
      mcpStatusBox.textContent = sync ? t('settings.auto.connecting') : '';
      const st = await wd.invoke(sync ? 'mcp:sync' : 'mcp:status');
      mcpStatusBox.innerHTML = st.length
        ? st
            .map(
              (s) =>
                `<div><b>${esc(s.name)}</b>: ${
                  s.connected
                    ? `<span style="color:var(--ok)">${esc(t('settings.auto.connected'))}</span> · ${esc(t('settings.auto.toolCount', { count: s.tools.length }))}`
                    : `<span style="color:var(--err)">${esc(s.error || t('settings.auto.disconnected'))}</span>`
                }</div>`,
            )
            .join('')
        : `<span class="muted">${esc(t('settings.auto.noServers'))}</span>`;
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
          field(t('settings.auto.webhookName'), itemText('connectors.webhooks', i, 'name', { placeholder: 'backup vps' })),
          field(
            t('settings.auto.method'),
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
          h('div', { class: 'full' }, field(t('settings.auto.webhookDesc'), itemText('connectors.webhooks', i, 'description', { placeholder: t('settings.auto.webhookDescPlaceholder') }))),
          h('div', { class: 'full' }, field('URL', itemText('connectors.webhooks', i, 'url', { placeholder: 'https://n8n.example.com/webhook/…' }))),
          field('Token (Authorization)', secret(`webhook:${w.id}`, t('settings.common.optional'))),
          field(t('settings.auto.headers'), itemText('connectors.webhooks', i, 'headersJson', { placeholder: '{"X-Api-Key": "…"}' })),
          h('div', { class: 'full row' }, itemCheck('connectors.webhooks', i, 'enabled', t('settings.auto.enabled')), itemCheck('connectors.webhooks', i, 'confirm', t('settings.auto.webhookConfirm'), false)),
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
          h('strong', {}, s.name || t('settings.auto.mcpServer')),
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
          field(t('settings.common.name'), itemText('connectors.mcpServers', i, 'name')),
          field(
            t('settings.auto.transport'),
            h(
              'select',
              {
                onchange: async (e) => {
                  mcpList[i].type = e.target.value;
                  await saveList('connectors.mcpServers', mcpList);
                  render();
                },
              },
              h('option', { value: 'stdio', selected: s.type !== 'http' }, t('settings.auto.stdio')),
              h('option', { value: 'http', selected: s.type === 'http' }, 'HTTP (Streamable)'),
            ),
          ),
          ...(s.type === 'http'
            ? [
                h('div', { class: 'full' }, field('URL', itemText('connectors.mcpServers', i, 'url', { placeholder: 'https://mcp.example.com/mcp' }))),
                field('Token (Bearer)', secret(`mcp:${s.id}`, t('settings.common.optional'))),
                field(t('settings.auto.headers'), itemText('connectors.mcpServers', i, 'headersJson')),
              ]
            : [
                field(t('settings.auto.command'), itemText('connectors.mcpServers', i, 'command', { placeholder: 'npx | uvx | node | python' })),
                field(t('settings.auto.args'), itemText('connectors.mcpServers', i, 'args', { placeholder: '-y @modelcontextprotocol/server-filesystem C:\\Users\\you\\Documents' })),
                h(
                  'div',
                  { class: 'full' },
                  field(
                    t('settings.auto.env'),
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
          h('div', { class: 'full row' }, itemCheck('connectors.mcpServers', i, 'enabled', t('settings.auto.enabled')), itemCheck('connectors.mcpServers', i, 'confirm', t('settings.auto.mcpConfirm'), false)),
        ),
      ),
    );

    const autoApproved = Object.keys(pc.config.tools.autoApprove || {}).filter((k) => pc.config.tools.autoApprove[k]);
    return [
      h('h1', {}, t('settings.nav.automations')),
      h('p', { class: 'lead' }, t('settings.auto.lead')),
      card(
        t('settings.auto.shellTitle'),
        t('settings.auto.shellText'),
        check('connectors.shell.enabled', t('settings.auto.shellEnable'), () => setTimeout(render, 400)),
        h('div', { class: 'warn-box', html: t('settings.auto.shellWarn') }),
      ),
      card(
        'Webhooks',
        t('settings.auto.webhooksText'),
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
            html: `${icons.plus} ${esc(t('settings.auto.addWebhook'))}`,
          },
        ),
      ),
      card(
        t('settings.auto.mcpTitle'),
        t('settings.auto.mcpText'),
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
                await saveList('connectors.mcpServers', [...mcpList, { id, name: t('settings.auto.newServerName'), type: 'stdio', command: 'npx', args: '', env: '', enabled: false }]);
                render();
              },
              html: `${icons.plus} ${esc(t('settings.auto.addServer'))}`,
            },
          ),
          h('button', { class: 'btn', onclick: () => refreshMcp(true) }, t('settings.auto.refresh')),
        ),
        mcpStatusBox,
      ),
      card(
        t('settings.auto.activeTools'),
        t('settings.auto.activeToolsText'),
        toolsBox,
        autoApproved.length
          ? h(
              'div',
              { style: 'margin-top:14px' },
              h('small', { class: 'muted' }, t('settings.auto.alwaysApproved', { list: autoApproved.join(', ') })),
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
                  t('settings.auto.resetApprovals'),
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
                  ? h('span', { class: 'pill active' }, t('settings.common.inUse'))
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
                      t('settings.skins.use'),
                    ),
                s.type === 'vrm'
                  ? h('button', { class: 'btn', onclick: () => wd.invoke('win:open', 'vrm-editor', { id: s.id }) }, t('settings.skins.adjust'))
                  : s.builtin
                    ? null
                    : h('button', { class: 'btn', onclick: () => wd.invoke('win:open', 'editor', { id: s.id }) }, t('settings.skins.adjust')),
                s.builtin
                  ? null
                  : h('button', {
                      class: 'btn ghost danger',
                      html: icons.trash,
                      title: t('settings.common.delete'),
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
          h('strong', {}, t('settings.skins.import')),
          h('small', { class: 'muted' }, t('settings.skins.importText')),
        ),
        h(
          'div',
          { class: 'skin add', onclick: () => wd.invoke('win:open', 'vrm-editor') },
          h('span', { html: icons.sparkle }),
          h('strong', {}, t('settings.skins.importVrm')),
          h('small', { class: 'muted' }, t('settings.skins.importVrmText')),
        ),
      );
    })();
    return [h('h1', {}, t('settings.nav.skins')), h('p', { class: 'lead' }, t('settings.skins.lead')), grid];
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

function go(next) {
  tab = next;
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

function applyLocale() {
  setLocale(pc.locale);
  applyDom();
  document.title = t('settings.windowTitle');
  document.getElementById('storageNote').textContent = pc.secureStorage ? t('settings.storage.secure') : t('settings.storage.insecure');
}

wd.on('cfg:changed', (next) => {
  const localeChanged = next.locale !== pc?.locale;
  pc = next;
  if (localeChanged) {
    applyLocale();
    render();
    return;
  }
  // No repintar mientras se escribe aquí mismo.
  if (Date.now() - lastLocalEdit > 1500 && !view.contains(document.activeElement)) render();
});
wd.on('skin:list-changed', () => tab === 'skins' && render());
wd.on('win:query', (q) => q?.tab && go(q.tab));

(async () => {
  pc = await wd.invoke('cfg:get');
  applyLocale();
  render();
})();
