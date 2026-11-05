// Ajustes → Conectores → Claude Desktop (MCP): Claude Desktop le hace de cerebro a la asistente
// con tu suscripción (sin API key). Y el recuadro del perfil en Ajustes → Modelos.
import { LANGUAGES } from '../../../shared/i18n/index.js';
import { assistantName } from '../../../shared/personas.js';

const DESKTOP_ID = 'claude-desktop';
let timer = null;

function ago(ts, locale) {
  if (!ts) return '';
  const sec = Math.round((ts - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(LANGUAGES[locale]?.tag || 'en-US', { numeric: 'auto' });
  return Math.abs(sec) < 60 ? rtf.format(sec, 'second') : rtf.format(Math.round(sec / 60), 'minute');
}

function statusText(ui, info) {
  const { t } = ui;
  const name = assistantName(ui.getPc().config);
  if (!info?.running) return { cls: '', text: t('desktop.ui.statusOff') };
  const st = info.status || {};
  const who = st.clients?.length ? ` (${st.clients.join(', ')})` : '';
  let out;
  if (st.listening) out = { cls: 'ok', text: t('desktop.ui.statusListening') + who };
  else if (st.connected) out = { cls: 'ok', text: t('desktop.ui.statusConnected', { ago: ago(st.lastSeen, ui.getLocale()) }) + who };
  else out = { cls: '', text: t('desktop.ui.statusWaiting', { name }) };
  if (st.queued) out.text += ` · ${t('desktop.ui.queued', { count: st.queued })}`;
  return out;
}

// Pasa al perfil «Claude Desktop (MCP)» (lo crea si se borró).
async function useDesktop(ui) {
  const cfg = ui.getPc().config;
  let p = cfg.profiles.find((x) => x.kind === 'claude-desktop');
  if (!p) {
    p = { id: cfg.profiles.some((x) => x.id === DESKTOP_ID) ? await ui.wd.invoke('cfg:new-id') : DESKTOP_ID, ...ui.getPc().presets.claudeDesktop, maxTokens: 4096, temperature: null };
    await ui.saveList('profiles', [...cfg.profiles, p]);
  }
  ui.setPc(await ui.wd.invoke('cfg:patch', { activeProfileId: p.id }));
  ui.render();
}

export function desktopCard(ui) {
  const { t, tHtml, h, wd, card } = ui;
  const cfg = ui.getPc().config;
  const name = assistantName(cfg);
  const active = cfg.profiles.find((p) => p.id === cfg.activeProfileId);
  const usingIt = active?.kind === 'claude-desktop';
  const res = ui.result();
  const status = h('p', { class: 'result' });
  const files = h('ul', { class: 'small muted desktop-files' });
  const snippet = h('pre', { class: 'snippet' });
  const snippetNode = h('pre', { class: 'snippet' });
  const ccCmd = h('pre', { class: 'snippet' });
  let info = null;

  const paintStatus = () => {
    const s = statusText(ui, info);
    status.className = `result ${s.cls}`;
    status.textContent = s.text;
  };
  const paint = () => {
    paintStatus();
    files.innerHTML = '';
    for (const c of info?.candidates || []) files.append(h('li', {}, h('code', {}, c.path), ' — ', t(`desktop.ui.configState.${c.exists ? c.state : 'missing'}`)));
    snippet.textContent = info?.snippet || '';
    snippetNode.textContent = info?.snippetNode || '';
    ccCmd.textContent = info?.claudeCode || '';
    uninstall.style.display = (info?.candidates || []).some((c) => c.exists && (c.state === 'current' || c.state === 'outdated')) ? '' : 'none';
  };
  const refresh = async () => {
    try {
      info = await wd.invoke('desktop:info');
      paint();
    } catch (e) {
      status.className = 'result err';
      status.textContent = String(e.message || e);
    }
  };
  ui.listen('desktop:status', (st) => {
    if (info) {
      info.status = st;
      paintStatus();
    }
  });
  clearInterval(timer);
  timer = setInterval(() => (document.body.contains(status) ? refresh() : clearInterval(timer)), 15000);
  setTimeout(refresh, 0);

  const copyBtn = (what, label = t('desktop.ui.copy')) =>
    h(
      'button',
      {
        class: 'btn',
        onclick: async () => {
          await wd.invoke('desktop:copy', what);
          ui.toast(t('desktop.ui.copied'));
        },
      },
      label,
    );

  const uninstall = h(
    'button',
    {
      class: 'btn ghost',
      style: 'display:none',
      onclick: () =>
        ui.runTest(res, async () => {
          const r = await wd.invoke('desktop:uninstall');
          info = r.info;
          paint();
          return t('desktop.ui.removed');
        }),
    },
    t('desktop.ui.uninstall'),
  );

  return card(
    ['Claude Desktop (MCP)', h('span', { class: `pill ${usingIt || cfg.connectors.claudeDesktop?.enabled ? 'on' : ''}` }, usingIt ? t('settings.common.inUse') : cfg.connectors.claudeDesktop?.enabled ? t('settings.common.on') : t('settings.common.off'))],
    tHtml('desktop.ui.desc', { name }),
    status,
    usingIt
      ? h('p', { class: 'small muted' }, t('desktop.ui.inUse', { name }))
      : h('div', { class: 'row', style: 'margin:6px 0 10px' }, h('button', { class: 'btn primary', onclick: () => useDesktop(ui) }, t('desktop.ui.useIt'))),
    ui.check('connectors.claudeDesktop.enabled', t('desktop.ui.enable'), () => setTimeout(refresh, 600)),
    h(
      'div',
      { class: 'grid', style: 'margin-top:8px' },
      h(
        'div',
        { class: 'full' },
        ui.field(
          t('desktop.ui.tools', { name }),
          ui.select(
            'connectors.claudeDesktop.tools',
            [
              ['compact', t('desktop.ui.toolsCompact')],
              ['all', t('desktop.ui.toolsAll')],
              ['none', t('desktop.ui.toolsNone')],
            ],
            () => setTimeout(refresh, 600),
          ),
          t('desktop.ui.toolsHelp'),
        ),
      ),
    ),
    h(
      'div',
      { class: 'row', style: 'margin-top:12px' },
      h(
        'button',
        {
          class: 'btn primary',
          onclick: () =>
            ui.runTest(res, async () => {
              const r = await wd.invoke('desktop:install');
              info = r.info;
              paint();
              const changed = r.files.filter((f) => f.changed).map((f) => f.path);
              return changed.length ? t('desktop.ui.installed', { files: changed.join(', ') }) : t('desktop.ui.unchanged');
            }),
        },
        t('desktop.ui.install'),
      ),
      uninstall,
    ),
    res,
    files,
    h(
      'details',
      { class: 'help', open: !usingIt },
      h('summary', {}, t('desktop.ui.howTo')),
      h('ol', {
        html: ['step1', 'step2', 'step3', 'step4'].map((k) => `<li>${tHtml(`desktop.ui.${k}`, { name })}</li>`).join(''),
      }),
      h('div', { class: 'warn-box', html: t('desktop.ui.warn') }),
    ),
    h(
      'details',
      { class: 'help' },
      h('summary', {}, t('desktop.ui.manual')),
      h('p', { class: 'desc', html: t('desktop.ui.manualText') }),
      snippet,
      h('div', { class: 'row', style: 'margin-top:6px' }, copyBtn('config')),
      h('p', { class: 'small muted', style: 'margin-top:10px' }, t('desktop.ui.withNode')),
      snippetNode,
      h('div', { class: 'row', style: 'margin-top:6px' }, copyBtn('configNode')),
      h('p', { class: 'small muted', style: 'margin-top:10px' }, t('desktop.ui.claudeCode')),
      ccCmd,
      h('div', { class: 'row', style: 'margin-top:6px' }, copyBtn('claudeCode')),
      h('p', { class: 'small muted', style: 'margin-top:10px' }, t('desktop.ui.copyPromptHelp')),
      h('div', { class: 'row', style: 'margin-top:6px' }, copyBtn('prompt', t('desktop.ui.copyPrompt', { name }))),
    ),
  );
}

// Dentro del perfil «Claude Desktop (MCP)» en Ajustes → Modelos.
export function desktopProfileBox(ui) {
  const { t, h } = ui;
  const name = assistantName(ui.getPc().config);
  return h(
    'div',
    { class: 'full' },
    h('p', { class: 'desc', html: ui.tHtml('desktop.ui.profileHelp', { name }) }),
    h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { class: 'btn', onclick: () => ui.goTab('connectors') }, t('desktop.ui.goConfigure'))),
  );
}
