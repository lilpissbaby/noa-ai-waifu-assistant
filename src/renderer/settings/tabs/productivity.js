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

export const PRODUCTIVITY_SECTIONS = [noticesCard, remindersCard];

export function productivityTab(ui) {
  return [ui.h('h1', {}, ui.t('settings.nav.productivity')), ui.h('p', { class: 'lead' }, ui.t('settings.productivity.lead')), ...PRODUCTIVITY_SECTIONS.map((section) => section(ui))];
}
