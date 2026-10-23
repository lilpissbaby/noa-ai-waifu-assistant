// Ajustes → Productividad: cómo avisa la asistente y lo que tiene pendiente (recordatorios).
// Cada bloque es una función que devuelve una tarjeta; las tareas siguientes añaden las suyas.
import { localeTag } from '../../../shared/i18n/index.js';
import { actionsFor } from '../../../shared/quick-actions.js';

let unsubscribe = null;

function noticesCard(ui) {
  const { t, field, card, h } = ui;
  return card(
    t('settings.productivity.noticesTitle'),
    t('settings.productivity.noticesDesc'),
    h(
      'div',
      { class: 'grid' },
      field(
        t('settings.productivity.notify'),
        ui.select('productivity.notify', [
          ['speak', t('settings.productivity.notifySpeak')],
          ['notify', t('settings.productivity.notifyNotify')],
          ['silent', t('settings.productivity.notifySilent')],
        ]),
      ),
    ),
  );
}

function remindersCard(ui) {
  const { t, card, h, wd, icons } = ui;
  const list = h('div', { class: 'voice-list', id: 'reminderList' });
  const paint = (items) => {
    list.innerHTML = '';
    if (!items.length) list.append(h('p', { class: 'small muted' }, t('settings.productivity.remindersEmpty')));
    for (const r of items)
      list.append(
        h(
          'div',
          { class: 'voice-row', 'data-reminder': r.id },
          h(
            'div',
            {},
            h('strong', {}, r.text),
            h(
              'div',
              { class: 'small muted' },
              new Date(r.due).toLocaleString(localeTag(), { dateStyle: 'medium', timeStyle: 'short' }),
              r.repeat ? ` · ${t(`settings.productivity.repeat.${r.repeat}`)}` : '',
            ),
          ),
          h('button', {
            class: 'btn ghost danger',
            html: icons.trash,
            title: t('settings.common.delete'),
            onclick: async () => {
              await wd.invoke('productivity:reminder-cancel', r.id);
              paint(await wd.invoke('productivity:reminders'));
            },
          }),
        ),
      );
  };
  wd.invoke('productivity:reminders').then(paint);
  unsubscribe?.();
  unsubscribe = wd.on('productivity:reminders', (items) => list.isConnected && paint(items));
  return card(t('settings.productivity.remindersTitle'), t('settings.productivity.remindersDesc'), list);
}

function memoryCard(ui) {
  const { t, card, h, wd, icons } = ui;
  const list = h('div', { class: 'voice-list', id: 'memoryList' });
  const paint = (items) => {
    list.innerHTML = '';
    if (!items.length) list.append(h('p', { class: 'small muted' }, t('settings.productivity.memoryEmpty')));
    for (const m of items)
      list.append(
        h(
          'div',
          { class: 'voice-row' },
          h('span', {}, m.text),
          h('button', {
            class: 'btn ghost danger',
            html: icons.trash,
            title: t('settings.productivity.forget'),
            onclick: async () => {
              await wd.invoke('productivity:memory-forget', m.id);
              paint(await wd.invoke('productivity:memory'));
            },
          }),
        ),
      );
  };
  wd.invoke('productivity:memory').then(paint);
  return card(t('settings.productivity.memoryTitle'), t('settings.productivity.memoryDesc'), ui.check('productivity.memory', t('settings.productivity.memoryOn')), list);
}

function notesCard(ui) {
  const { t, card, h, wd, field } = ui;
  const input = ui.text('productivity.notesDir');
  wd.invoke('productivity:notes-dir').then((d) => (input.placeholder = d));
  return card(
    t('settings.productivity.notesTitle'),
    t('settings.productivity.notesDesc'),
    field(t('settings.productivity.notesDir'), input, t('settings.productivity.notesDirHelp')),
    h(
      'div',
      { class: 'row', style: 'margin-top:10px' },
      h(
        'button',
        {
          class: 'btn',
          onclick: async () => {
            const dir = await wd.invoke('productivity:pick-folder', t('settings.productivity.notesDir'));
            if (!dir) return;
            input.value = dir;
            ui.save('productivity.notesDir', dir, 0);
          },
        },
        t('settings.productivity.pickFolder'),
      ),
      h('button', { class: 'btn ghost', onclick: () => wd.invoke('productivity:open-notes') }, t('settings.productivity.openFolder')),
    ),
  );
}

function foldersCard(ui) {
  const { t, card, h, wd, icons } = ui;
  const list = h('div', { class: 'voice-list', id: 'folderList' });
  const folders = () => [...(ui.getPc().config.productivity.folders || [])];
  const store = async (next) => {
    ui.markEdit();
    ui.setPc(await wd.invoke('cfg:patch', { productivity: { folders: next } }));
    paint();
  };
  const paint = () => {
    list.innerHTML = '';
    const all = folders();
    if (!all.length) list.append(h('p', { class: 'small muted' }, t('settings.productivity.foldersEmpty')));
    all.forEach((f, i) =>
      list.append(
        h(
          'div',
          { class: 'voice-row' },
          h('code', {}, f),
          h('button', {
            class: 'btn ghost danger',
            html: icons.trash,
            title: t('settings.common.delete'),
            onclick: () => store(all.filter((_, j) => j !== i)),
          }),
        ),
      ),
    );
  };
  paint();
  return card(
    t('settings.productivity.foldersTitle'),
    t('settings.productivity.foldersDesc'),
    list,
    h(
      'div',
      { class: 'row', style: 'margin-top:10px' },
      h(
        'button',
        {
          class: 'btn',
          id: 'addFolder',
          onclick: async () => {
            const dir = await wd.invoke('productivity:pick-folder', t('settings.productivity.foldersTitle'));
            if (dir && !folders().includes(dir)) store([...folders(), dir]);
          },
        },
        t('settings.productivity.addFolder'),
      ),
    ),
  );
}

function quickActionsCard(ui) {
  const { t, card, h, wd, icons, field, getLocale } = ui;
  const cfg = ui.getPc().config;
  const actions = actionsFor(cfg, getLocale()).map((a) => ({ ...a }));
  const box = h('div', { class: 'quick-list' });
  let timer = null;
  const store = (now = false) => {
    clearTimeout(timer);
    ui.markEdit();
    timer = setTimeout(
      async () => {
        ui.setPc(await wd.invoke('cfg:patch', { productivity: { quickActions: actions } }));
        ui.markEdit();
        ui.toast(t('settings.saved'));
      },
      now ? 0 : 450,
    );
  };
  const paint = () => {
    box.innerHTML = '';
    actions.forEach((a, i) =>
      box.append(
        h(
          'div',
          { class: 'quick-item' },
          h(
            'div',
            { class: 'grid' },
            field(
              t('settings.productivity.quickName'),
              h('input', {
                type: 'text',
                value: a.name,
                oninput: (e) => {
                  a.name = e.target.value;
                  store();
                },
              }),
            ),
            h(
              'div',
              { class: 'row', style: 'align-self:end;justify-content:space-between;flex-wrap:nowrap' },
              ui.h(
                'label',
                { class: 'check' },
                h('input', {
                  type: 'checkbox',
                  checked: a.copyResult,
                  onchange: (e) => {
                    a.copyResult = e.target.checked;
                    store(true);
                  },
                }),
                t('settings.productivity.quickCopy'),
              ),
              h('button', {
                class: 'btn ghost danger',
                html: icons.trash,
                title: t('settings.common.delete'),
                onclick: () => {
                  actions.splice(i, 1);
                  store(true);
                  paint();
                },
              }),
            ),
            h(
              'div',
              { class: 'full' },
              field(
                t('settings.productivity.quickPrompt'),
                h('textarea', {
                  rows: 3,
                  value: a.prompt,
                  oninput: (e) => {
                    a.prompt = e.target.value;
                    store();
                  },
                }),
              ),
            ),
          ),
        ),
      ),
    );
  };
  paint();
  return card(
    t('settings.productivity.quickTitle'),
    t('settings.productivity.quickDesc', { hotkey: cfg.ui.hotkeyQuick || '—' }),
    box,
    h(
      'div',
      { class: 'row', style: 'margin-top:10px' },
      h(
        'button',
        {
          class: 'btn',
          onclick: () => {
            actions.push({ id: `custom-${Date.now().toString(36)}`, name: t('settings.productivity.quickNew'), prompt: '{text}', copyResult: false });
            store(true);
            paint();
          },
        },
        t('settings.productivity.quickAdd'),
      ),
      h(
        'button',
        {
          class: 'btn ghost',
          onclick: async () => {
            ui.setPc(await wd.invoke('cfg:patch', { productivity: { quickActions: null } }));
            ui.render();
          },
        },
        t('settings.productivity.quickReset'),
      ),
    ),
  );
}

// Los enlaces iCal privados llevan un secreto en la ruta: solo se enseña el servidor y el final.
function maskUrl(u) {
  try {
    const url = new URL(String(u).replace(/^webcal:/i, 'https:'));
    return `${url.host}/…/${url.pathname.split('/').pop()}`;
  } catch {
    return '…';
  }
}

function calendarsCard(ui) {
  const { t, card, h, wd, icons, field } = ui;
  const list = h('div', { class: 'voice-list', id: 'calendarList' });
  const cals = () => [...(ui.getPc().config.productivity.calendars || [])];
  const store = async (next) => {
    ui.markEdit();
    ui.setPc(await wd.invoke('cfg:patch', { productivity: { calendars: next } }));
    paint();
  };
  const paint = () => {
    list.innerHTML = '';
    const all = cals();
    if (!all.length) list.append(h('p', { class: 'small muted' }, t('settings.productivity.calendarsEmpty')));
    for (const c of all)
      list.append(
        h(
          'div',
          { class: 'voice-row' },
          h('div', {}, h('strong', {}, c.name), h('div', { class: 'small muted' }, c.file || maskUrl(c.url))),
          h('button', { class: 'btn ghost danger', html: icons.trash, title: t('settings.common.delete'), onclick: () => store(all.filter((x) => x.id !== c.id)) }),
        ),
      );
  };
  paint();
  const name = h('input', { type: 'text', placeholder: t('settings.productivity.calendarName') });
  const url = h('input', { type: 'text', placeholder: 'https://calendar.google.com/calendar/ical/…/basic.ics' });
  const newId = () => `cal-${Date.now().toString(36)}`;
  return card(
    t('settings.productivity.calendarsTitle'),
    t('settings.productivity.calendarsDesc'),
    list,
    h('div', { class: 'grid', style: 'margin-top:10px' }, field(t('settings.productivity.calendarName'), name), field(t('settings.productivity.calendarUrl'), url)),
    h(
      'div',
      { class: 'row', style: 'margin-top:10px' },
      h(
        'button',
        {
          class: 'btn',
          onclick: () => {
            const u = url.value.trim();
            if (!/^(https?|webcal):\/\//i.test(u)) return ui.toast(t('settings.productivity.calendarBadUrl'));
            store([...cals(), { id: newId(), name: name.value.trim() || t('settings.productivity.calendarDefault'), url: u }]);
          },
        },
        t('settings.productivity.calendarAddUrl'),
      ),
      h(
        'button',
        {
          class: 'btn ghost',
          onclick: async () => {
            const file = await wd.invoke('productivity:pick-ics');
            if (file) store([...cals(), { id: newId(), name: name.value.trim() || file.split(/[\\/]/).pop().replace(/\.ics$/i, ''), file }]);
          },
        },
        t('settings.productivity.calendarAddFile'),
      ),
    ),
  );
}

function briefingCard(ui) {
  const { t, card, h, wd, field } = ui;
  const b = ui.getPc().config.productivity.briefing;
  const days = [...(b.days || [])];
  const dayBoxes = h(
    'div',
    { class: 'row days' },
    [1, 2, 3, 4, 5, 6, 7].map((d) =>
      h(
        'label',
        { class: 'check' },
        h('input', {
          type: 'checkbox',
          checked: days.includes(d),
          onchange: (e) => {
            const next = e.target.checked ? [...new Set([...days, d])].sort() : days.filter((x) => x !== d);
            days.splice(0, days.length, ...next);
            ui.save('productivity.briefing.days', [...days], 0);
          },
        }),
        new Date(2026, 0, 4 + d).toLocaleDateString(localeTag(), { weekday: 'short' }),
      ),
    ),
  );
  return card(
    t('settings.productivity.briefingTitle'),
    t('settings.productivity.briefingDesc'),
    ui.check('productivity.briefing.enabled', t('settings.productivity.briefingOn')),
    h('div', { class: 'grid', style: 'margin-top:10px' }, field(t('settings.productivity.briefingTime'), ui.text('productivity.briefing.time', { type: 'time' })), field(t('settings.productivity.briefingDays'), dayBoxes)),
    h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { class: 'btn', onclick: () => wd.invoke('productivity:briefing-now') }, t('settings.productivity.briefingNow'))),
  );
}

function webCard(ui) {
  const { t, card, h, field } = ui;
  const box = h('div', { class: 'grid', style: 'margin-top:10px' });
  const paint = () => {
    box.innerHTML = '';
    const p = ui.getPc().config.productivity.search?.provider || 'none';
    if (p === 'none') return;
    box.append(
      h('div', { class: p === 'searxng' ? 'full' : '' }, field(t('settings.common.baseUrl'), ui.text('productivity.search.baseUrl', { placeholder: { searxng: 'https://searx.tu-dominio.com', brave: 'https://api.search.brave.com/res/v1/web', tavily: 'https://api.tavily.com' }[p] }), t(`settings.productivity.searchHelp.${p}`))),
    );
    if (p !== 'searxng') box.append(field('API key', ui.secret('search')));
  };
  paint();
  return card(
    t('settings.productivity.webTitle'),
    t('settings.productivity.webDesc'),
    field(
      t('settings.productivity.searchProvider'),
      ui.select(
        'productivity.search.provider',
        [
          ['none', t('settings.productivity.searchNone')],
          ['searxng', 'SearXNG'],
          ['brave', 'Brave Search API'],
          ['tavily', 'Tavily'],
        ],
        paint,
      ),
    ),
    box,
  );
}

function agentsCard(ui) {
  const { t, card, h, wd, icons, field } = ui;
  const list = h('div', { class: 'voice-list', id: 'watchList' });
  const paint = (items) => {
    list.innerHTML = '';
    if (!items.length) list.append(h('p', { class: 'small muted' }, t('settings.productivity.agentsEmpty')));
    for (const w of items)
      list.append(
        h(
          'div',
          { class: 'voice-row' },
          h('div', {}, h('strong', {}, w.title || w.id), h('div', { class: 'small muted' }, w.status ? t('settings.productivity.agentsStatus', { status: w.status }) : '')),
          h('button', {
            class: 'btn ghost danger',
            html: icons.trash,
            title: t('settings.productivity.agentsUnwatch'),
            onclick: async () => paint(await wd.invoke('productivity:unwatch', w.id)),
          }),
        ),
      );
  };
  wd.invoke('productivity:watched').then(paint);
  wd.on('productivity:watched', (items) => list.isConnected && paint(items));
  return card(
    t('settings.productivity.agentsTitle'),
    t('settings.productivity.agentsDesc'),
    h('div', { class: 'grid' }, field(t('settings.productivity.agentsPoll'), ui.text('productivity.agentPollMin', { type: 'number' }))),
    list,
  );
}

export const PRODUCTIVITY_SECTIONS = [noticesCard, remindersCard, calendarsCard, briefingCard, agentsCard, webCard, memoryCard, notesCard, foldersCard, quickActionsCard];

export function productivityTab(ui) {
  return [ui.h('h1', {}, ui.t('settings.nav.productivity')), ui.h('p', { class: 'lead' }, ui.t('settings.productivity.lead')), ...PRODUCTIVITY_SECTIONS.map((section) => section(ui))];
}
