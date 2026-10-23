// Ajustes → Productividad: cómo avisa la asistente y lo que tiene pendiente (recordatorios).
// Cada bloque es una función que devuelve una tarjeta; las tareas siguientes añaden las suyas.
import { localeTag } from '../../../shared/i18n/index.js';

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

export const PRODUCTIVITY_SECTIONS = [noticesCard, remindersCard, memoryCard, notesCard, foldersCard];

export function productivityTab(ui) {
  return [ui.h('h1', {}, ui.t('settings.nav.productivity')), ui.h('p', { class: 'lead' }, ui.t('settings.productivity.lead')), ...PRODUCTIVITY_SECTIONS.map((section) => section(ui))];
}
