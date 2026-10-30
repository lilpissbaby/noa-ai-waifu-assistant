// Tarjetas de la 0.5.0 que van en pestañas ya existentes: el tiempo, noticias y portapapeles
// (Productividad); GitHub, Home Assistant y móvil (Conectores); monitor de servicios y catálogo
// MCP (Automatizaciones); galería de modelos (Skins); modo mascota (General); uso y coste (Modelos).
import { localeTag } from '../../../shared/i18n/index.js';
import { GALLERY, galleryThumb } from '../../../shared/gallery.js';
import { MCP_CATALOG, serverFromCatalog } from '../../../shared/mcp-catalog.js';

const pill = (h, on, t) => h('span', { class: `pill ${on ? 'on' : ''}` }, on ? t('settings.common.on') : t('settings.common.off'));

// ---------------------------------------------------------------- Productividad
export function weatherCard(ui) {
  const { t, card, h, wd, field } = ui;
  const w = () => ui.getPc().config.productivity.weather;
  const city = h('input', { type: 'text', placeholder: t('info.weather.cityPlaceholder'), value: w().label || '' });
  const res = ui.result();
  const now = h('div', { class: 'weather-now' });
  const paintNow = async () => {
    now.innerHTML = '';
    if (w().lat == null) return;
    try {
      const r = await wd.invoke('productivity:weather-now');
      if (!r?.now) return;
      const d = r.days?.[0];
      now.append(h('div', { class: 'big' }, r.now.temperature), h('div', {}, h('strong', {}, r.location), h('div', { class: 'small muted' }, `${r.now.sky} · ${d ? `${d.min} / ${d.max}` : ''}${d?.rainChance ? ` · ☂ ${d.rainChance}` : ''}`)));
    } catch {
      /* sin red */
    }
  };
  paintNow();
  const find = async () => {
    const r = await ui.runTest(res, async () => {
      const place = await wd.invoke('productivity:weather-find', city.value);
      if (!place) throw new Error(t('info.weather.notFound'));
      await ui.saveList('productivity.weather', { ...w(), label: place.label, lat: place.lat, lon: place.lon });
      return t('info.weather.saved', { place: place.label });
    });
    if (r) {
      city.value = w().label;
      paintNow();
    }
  };
  city.addEventListener('keydown', (e) => e.key === 'Enter' && find());
  return card(
    t('info.weather.title'),
    t('info.weather.desc'),
    h(
      'div',
      { class: 'grid' },
      field(t('info.weather.city'), city),
      field(
        t('info.weather.units'),
        ui.select('productivity.weather.units', [
          ['metric', t('info.weather.metric')],
          ['imperial', t('info.weather.imperial')],
        ]),
      ),
    ),
    h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { class: 'btn', onclick: find }, t('info.weather.find'))),
    res,
    now,
  );
}

export function feedsCard(ui) {
  const { t, card, h, wd, icons, field } = ui;
  const feeds = () => [...(ui.getPc().config.productivity.feeds || [])];
  const list = h('div', { class: 'voice-list' });
  const res = ui.result();
  const store = async (next) => {
    await ui.saveList('productivity.feeds', next);
    paint();
  };
  const paint = () => {
    list.innerHTML = '';
    const all = feeds();
    if (!all.length) list.append(h('p', { class: 'small muted' }, t('info.feeds.empty')));
    for (const f of all)
      list.append(
        h(
          'div',
          { class: 'voice-row' },
          h('div', {}, h('strong', {}, f.name), h('div', { class: 'small muted' }, f.url)),
          h('button', { class: 'btn ghost danger', html: icons.trash, title: t('settings.common.delete'), onclick: () => store(all.filter((x) => x.id !== f.id)) }),
        ),
      );
  };
  paint();
  const name = h('input', { type: 'text', placeholder: t('info.feeds.namePlaceholder') });
  const url = h('input', { type: 'text', placeholder: 'https://www.example.com/feed.xml' });
  return card(
    t('info.feeds.title'),
    t('info.feeds.desc'),
    list,
    h('div', { class: 'grid', style: 'margin-top:10px' }, field(t('settings.common.name'), name), field('URL', url)),
    h(
      'div',
      { class: 'row', style: 'margin-top:10px' },
      h(
        'button',
        {
          class: 'btn',
          onclick: async () => {
            const u = url.value.trim();
            const r = await ui.runTest(res, async () => {
              const f = await wd.invoke('productivity:feed-test', u);
              return { f, message: t('info.feeds.ok', { title: f.title || u, count: f.count }) };
            });
            if (!r) return;
            const id = await wd.invoke('cfg:new-id');
            await store([...feeds(), { id, name: name.value.trim() || r.f.title || new URL(u).host, url: u }]);
            name.value = '';
            url.value = '';
          },
          html: `${icons.plus} ${t('info.feeds.add')}`,
        },
      ),
    ),
    res,
  );
}

export function clipboardCard(ui) {
  const { t, card, h, wd, icons } = ui;
  const list = h('div', { class: 'voice-list clip-list' });
  const enabled = () => ui.getPc().config.productivity.clipboardHistory?.enabled;
  const paint = (items) => {
    list.innerHTML = '';
    if (!enabled()) return;
    if (!items.length) list.append(h('p', { class: 'small muted' }, t('info.clipboard.empty')));
    for (const x of items.slice(0, 30))
      list.append(
        h(
          'div',
          { class: 'voice-row' },
          h('div', { class: 'grow clip-text' }, h('span', {}, x.text.length > 200 ? `${x.text.slice(0, 200)}…` : x.text), h('div', { class: 'small muted' }, new Date(x.at).toLocaleTimeString(localeTag(), { timeStyle: 'short' }))),
          h(
            'button',
            {
              class: 'btn ghost',
              title: t('info.clipboard.copy'),
              html: icons.copy || '⧉',
              onclick: async () => {
                await wd.invoke('productivity:clipboard-copy', x.id);
                ui.toast(t('info.clipboard.copied'));
              },
            },
          ),
          h('button', { class: 'btn ghost danger', html: icons.trash, title: t('settings.common.delete'), onclick: async () => (await wd.invoke('productivity:clipboard-remove', x.id), paint(await wd.invoke('productivity:clipboard'))) }),
        ),
      );
  };
  wd.invoke('productivity:clipboard').then(paint);
  ui.listen('productivity:clipboard', (items) => list.isConnected && paint(items));
  return card(
    t('info.clipboard.title'),
    t('info.clipboard.desc'),
    ui.check('productivity.clipboardHistory.enabled', t('info.clipboard.enable'), () => setTimeout(() => wd.invoke('productivity:clipboard').then(paint), 300)),
    h('div', { class: 'row', style: 'margin:10px 0' }, h('button', { class: 'btn ghost', onclick: async () => (await wd.invoke('productivity:clipboard-clear'), paint([])) }, t('info.clipboard.clear'))),
    list,
  );
}

// ---------------------------------------------------------------- Conectores
export function githubCard(ui) {
  const { t, card, h, wd, field } = ui;
  const gh = ui.getPc().config.connectors.github;
  const res = ui.result();
  const repos = h('input', {
    type: 'text',
    value: (gh.watchRepos || []).join(', '),
    placeholder: 'lilpissbaby/noa-ai-waifu-assistant, owner/repo',
    oninput: (e) =>
      ui.save(
        'connectors.github.watchRepos',
        e.target.value
          .split(/[\s,]+/)
          .map((s) => s.trim())
          .filter(Boolean),
        800,
      ),
  });
  return card(
    ['GitHub', pill(h, gh.enabled, t)],
    t('conn2.github.desc'),
    ui.check('connectors.github.enabled', t('conn2.github.enable'), () => setTimeout(ui.render, 400)),
    h(
      'div',
      { class: 'grid', style: 'margin-top:8px' },
      field(t('conn2.github.token'), ui.secret('github', 'github_pat_…'), t('conn2.github.tokenHelp')),
      field(t('conn2.github.poll'), ui.text('connectors.github.pollMin', { type: 'number' })),
      h('div', { class: 'full' }, field(t('conn2.github.watch'), repos, t('conn2.github.watchHelp'))),
    ),
    h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { class: 'btn', onclick: () => ui.runTest(res, () => wd.invoke('test:github')) }, t('settings.conn.test'))),
    res,
  );
}

export function homeAssistantCard(ui) {
  const { t, card, h, wd, field } = ui;
  const ha = ui.getPc().config.connectors.homeassistant;
  const res = ui.result();
  return card(
    ['Home Assistant', pill(h, ha.enabled, t)],
    t('conn2.ha.desc'),
    ui.check('connectors.homeassistant.enabled', t('conn2.ha.enable'), () => setTimeout(ui.render, 400)),
    h(
      'div',
      { class: 'grid', style: 'margin-top:8px' },
      field('URL', ui.text('connectors.homeassistant.baseUrl', { placeholder: 'http://homeassistant.local:8123' }), t('conn2.ha.urlHelp')),
      field(t('conn2.ha.token'), ui.secret('homeassistant'), t('conn2.ha.tokenHelp')),
    ),
    h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { class: 'btn', onclick: () => ui.runTest(res, () => wd.invoke('test:homeassistant')) }, t('settings.conn.test'))),
    res,
  );
}

export function phoneCard(ui) {
  const { t, card, h, wd, field } = ui;
  const box = h('div', { class: 'grid', style: 'margin-top:10px' });
  const res = ui.result();
  const paint = () => {
    box.innerHTML = '';
    const p = ui.getPc().config.connectors.push.provider;
    if (p === 'none') return;
    if (p === 'ntfy') box.append(field(t('conn2.push.server'), ui.text('connectors.push.server', { placeholder: 'https://ntfy.sh' })), field(t('conn2.push.topic'), ui.text('connectors.push.topic', { placeholder: 'noa-xxxxxxxx' }), t('conn2.push.topicHelp')), field(t('conn2.push.ntfyToken'), ui.secret('push', t('conn2.push.optional'))));
    if (p === 'telegram') box.append(field(t('conn2.push.botToken'), ui.secret('push', '123456:ABC…'), t('conn2.push.botHelp')), field('Chat ID', ui.text('connectors.push.chatId'), t('conn2.push.chatHelp')));
    if (p === 'gotify') box.append(field(t('conn2.push.server'), ui.text('connectors.push.server', { placeholder: 'https://gotify.example.com' })), field(t('conn2.push.appToken'), ui.secret('push')));
    box.append(
      h(
        'div',
        { class: 'full' },
        field(
          t('conn2.push.forward'),
          ui.select('connectors.push.forward', [
            ['off', t('conn2.push.forwardOff')],
            ['important', t('conn2.push.forwardImportant')],
            ['all', t('conn2.push.forwardAll')],
          ]),
        ),
      ),
    );
  };
  paint();
  return card(
    t('conn2.push.title'),
    t('conn2.push.desc'),
    field(
      t('conn2.push.provider'),
      ui.select(
        'connectors.push.provider',
        [
          ['none', t('conn2.push.none')],
          ['ntfy', 'ntfy'],
          ['telegram', 'Telegram'],
          ['gotify', 'Gotify'],
        ],
        () => setTimeout(paint, 50),
      ),
    ),
    box,
    h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { class: 'btn', onclick: () => ui.runTest(res, () => wd.invoke('test:push')) }, t('conn2.push.test'))),
    res,
  );
}

// ---------------------------------------------------------------- Automatizaciones
export function monitorsCard(ui) {
  const { t, card, h, wd, icons, field } = ui;
  const list = h('div', { class: 'voice-list' });
  const items = () => [...(ui.getPc().config.productivity.monitors?.list || [])];
  const store = async (next) => {
    await ui.saveList('productivity.monitors.list', next);
    paint(await wd.invoke('productivity:monitors'));
  };
  const paint = (states) => {
    list.innerHTML = '';
    if (!states.length) list.append(h('p', { class: 'small muted' }, t('auto2.monitors.empty')));
    for (const m of states)
      list.append(
        h(
          'div',
          { class: 'voice-row' },
          h('span', { class: `dot ${m.up === true ? 'up' : m.up === false ? 'down' : ''}`, title: m.up === true ? t('auto2.monitors.up') : m.up === false ? t('auto2.monitors.down') : t('auto2.monitors.unknown') }),
          h(
            'div',
            { class: 'grow' },
            h('strong', {}, m.name),
            h('div', { class: 'small muted' }, [m.url, m.ms != null ? `${m.ms} ms` : '', m.error || ''].filter(Boolean).join(' · ')),
          ),
          h('button', { class: 'btn ghost danger', html: icons.trash, title: t('settings.common.delete'), onclick: () => store(items().filter((x) => x.id !== m.id)) }),
        ),
      );
  };
  wd.invoke('productivity:monitors').then(paint);
  ui.listen('productivity:monitors', (st) => list.isConnected && paint(st));
  const name = h('input', { type: 'text', placeholder: t('auto2.monitors.namePlaceholder') });
  const url = h('input', { type: 'text', placeholder: 'https://tenebrum.online' });
  const keyword = h('input', { type: 'text', placeholder: t('auto2.monitors.keywordPlaceholder') });
  return card(
    t('auto2.monitors.title'),
    t('auto2.monitors.desc'),
    list,
    h('div', { class: 'grid', style: 'margin-top:10px' }, field(t('settings.common.name'), name), field('URL', url), field(t('auto2.monitors.keyword'), keyword), field(t('auto2.monitors.every'), ui.text('productivity.monitors.everyMin', { type: 'number' }))),
    h(
      'div',
      { class: 'row', style: 'margin-top:10px' },
      h(
        'button',
        {
          class: 'btn primary',
          html: `${icons.plus} ${t('auto2.monitors.add')}`,
          onclick: async () => {
            const u = url.value.trim();
            if (!/^https?:\/\/\S+/i.test(u)) return ui.toast(t('auto2.monitors.badUrl'));
            const id = await wd.invoke('cfg:new-id');
            await store([...items(), { id, name: name.value.trim() || new URL(u).host, url: u, keyword: keyword.value.trim() }]);
            name.value = '';
            url.value = '';
            keyword.value = '';
          },
        },
      ),
      h('button', { class: 'btn', onclick: async () => paint((await wd.invoke('productivity:monitors-check')) || []) }, t('auto2.monitors.checkNow')),
    ),
  );
}

// Lista del catálogo MCP dentro de la tarjeta de servidores MCP.
export function mcpCatalogBox(ui) {
  const { t, h, wd, icons } = ui;
  const cfg = ui.getPc().config;
  const added = new Set((cfg.connectors.mcpServers || []).map((s) => s.catalog).filter(Boolean));
  return h(
    'details',
    { class: 'help catalog', open: !(cfg.connectors.mcpServers || []).length },
    h('summary', {}, t('mcpCatalog.title')),
    h('p', { class: 'small muted' }, t('mcpCatalog.desc')),
    h(
      'div',
      { class: 'catalog-grid' },
      MCP_CATALOG.map((item) =>
        h(
          'div',
          { class: 'catalog-item' },
          h('div', { class: 'row' }, h('strong', { class: 'grow' }, item.name), h('span', { class: `badge needs-${item.needs}` }, t(`mcpCatalog.needs.${item.needs}`))),
          h('p', { class: 'small' }, t(`mcpCatalog.items.${item.id}`)),
          h(
            'div',
            { class: 'row' },
            h('a', { href: '#', 'data-ext': item.docs, class: 'small' }, t('mcpCatalog.docs')),
            h('span', { class: 'grow' }),
            added.has(item.id)
              ? h('span', { class: 'pill' }, t('mcpCatalog.added'))
              : h(
                  'button',
                  {
                    class: 'btn tiny',
                    html: `${icons.plus} ${t('mcpCatalog.add')}`,
                    onclick: async () => {
                      const id = await wd.invoke('cfg:new-id');
                      const server = serverFromCatalog(item, { id, folder: cfg.productivity.folders?.[0] || '', haUrl: cfg.connectors.homeassistant?.baseUrl });
                      await ui.saveList('connectors.mcpServers', [...(cfg.connectors.mcpServers || []), server]);
                      ui.toast(t('mcpCatalog.addedToast', { name: item.name }));
                      ui.render();
                    },
                  },
                ),
          ),
        ),
      ),
    ),
  );
}

// ---------------------------------------------------------------- Skins: galería
export function galleryCard(ui) {
  const { t, card, h, wd } = ui;
  let kind = 'all';
  const grid = h('div', { class: 'gallery' });
  const chips = h('div', { class: 'chips' });
  const paint = () => {
    chips.innerHTML = '';
    for (const k of ['all', 'vrm', 'live2d'])
      chips.append(
        h(
          'button',
          {
            class: `chip ${k === kind ? 'active' : ''}`,
            onclick: () => {
              kind = k;
              paint();
            },
          },
          `${t(`gallery.filter.${k}`)} · ${GALLERY.filter((g) => k === 'all' || g.kind === k).length}`,
        ),
      );
    grid.innerHTML = '';
    for (const g of GALLERY.filter((x) => kind === 'all' || x.kind === kind))
      grid.append(
        h(
          'div',
          { class: 'model-card' },
          h('div', { class: 'thumb' }, h('img', { src: galleryThumb(g.id), alt: g.name, loading: 'lazy' }), h('span', { class: `badge kind-${g.kind}` }, g.kind === 'vrm' ? '3D · VRM' : 'Live2D')),
          h(
            'div',
            { class: 'meta' },
            h('strong', {}, g.name),
            h('div', { class: 'small muted' }, g.author),
            h('div', { class: 'small license' }, t(`gallery.license.${g.license}`), g.credit ? ` · ${t('gallery.credit')}` : ''),
            h(
              'div',
              { class: 'row' },
              h('a', { href: '#', 'data-ext': g.source, class: 'small' }, t('gallery.source')),
              h('span', { class: 'grow' }),
              h('button', { class: 'btn tiny primary', onclick: () => wd.invoke('win:open', 'vrm-editor', { gallery: g.id, kind: g.kind }) }, t('gallery.use')),
            ),
          ),
        ),
      );
  };
  paint();
  return card([t('gallery.title'), h('span', { class: 'pill' }, String(GALLERY.length))], t('gallery.desc'), chips, grid);
}

// ---------------------------------------------------------------- General: modo mascota
export function presenceCard(ui) {
  const { t, card, h, field } = ui;
  return card(
    t('presenceUi.title'),
    t('presenceUi.desc'),
    ui.check('ui.presence.sleep', t('presenceUi.sleep')),
    ui.check('ui.presence.welcomeBack', t('presenceUi.welcome')),
    h('div', { class: 'grid', style: 'margin-top:10px' }, field(t('presenceUi.after'), ui.text('ui.presence.sleepAfterMin', { type: 'number' }))),
  );
}

// ---------------------------------------------------------------- Modelos: uso y coste
const fmtTokens = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)} M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)} k` : String(n));
const fmtCost = (c) => (c == null ? '—' : c < 0.01 ? `$${c.toFixed(4)}` : `$${c.toFixed(2)}`);

export function usageCard(ui) {
  const { t, card, h, wd } = ui;
  const table = h('div', { class: 'usage' });
  const profiles = ui.getPc().config.profiles;
  const paint = (rows) => {
    table.innerHTML = '';
    if (!rows.length) return table.append(h('p', { class: 'small muted' }, t('usage.empty')));
    table.append(
      h(
        'table',
        {},
        h('thead', {}, h('tr', {}, h('th', {}, t('usage.model')), ...['today', 'week', 'month'].map((p) => h('th', {}, t(`usage.${p}`))))),
        h(
          'tbody',
          {},
          rows.map((r) =>
            h(
              'tr',
              {},
              h('td', {}, h('strong', {}, r.name), h('div', { class: 'small muted' }, r.model)),
              ...['today', 'week', 'month'].map((p) => h('td', {}, h('div', {}, `${fmtTokens(r[p].input)} ↑ · ${fmtTokens(r[p].output)} ↓`), h('div', { class: 'small muted' }, `${r[p].requests} · ${fmtCost(r.cost[p])}`))),
            ),
          ),
        ),
      ),
    );
  };
  wd.invoke('productivity:usage').then(paint);
  const prices = h(
    'div',
    { class: 'grid', style: 'margin-top:14px' },
    profiles.flatMap((p, i) => [
      h('div', { class: 'full small', style: 'margin-top:6px' }, h('strong', {}, p.name), p.model ? ` · ${p.model}` : ''),
      ui.field(t('usage.priceIn'), ui.itemText('profiles', i, 'priceIn', { type: 'number', placeholder: '3' })),
      ui.field(t('usage.priceOut'), ui.itemText('profiles', i, 'priceOut', { type: 'number', placeholder: '15' })),
    ]),
  );
  return card(
    t('usage.title'),
    t('usage.desc'),
    table,
    h('details', { class: 'help' }, h('summary', {}, t('usage.prices')), h('p', { class: 'small muted' }, t('usage.pricesHelp')), prices),
    h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { class: 'btn ghost', onclick: async () => paint(await wd.invoke('productivity:usage-reset')) }, t('usage.reset'))),
  );
}
