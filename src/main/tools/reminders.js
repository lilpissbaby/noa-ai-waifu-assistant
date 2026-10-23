// Herramientas de recordatorios y temporizadores. services.reminders es la instancia de Reminders
// que vive en main.js (en los tests, una con reloj falso).
import { REPEATS } from '../productivity/reminders.js';
import { getLocale, localeTag } from '../../shared/i18n/index.js';

const fmt = (iso) => new Date(iso).toLocaleString(localeTag(getLocale()), { dateStyle: 'full', timeStyle: 'short' });
const view = (r) => ({ id: r.id, text: r.text, when: fmt(r.due), due: r.due, repeat: r.repeat });

// «18:30» → la próxima vez que lleguen las 18:30; «2026-10-23T18:30» → hora local; solo fecha → 09:00.
export function parseAt(at, now) {
  const s = String(at ?? '').trim();
  const hm = s.match(/^(\d{1,2}):(\d{2})$/);
  if (hm) {
    const d = new Date(now);
    d.setHours(Number(hm[1]), Number(hm[2]), 0, 0);
    if (d <= now) d.setDate(d.getDate() + 1);
    return d;
  }
  if (!/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(s)) throw new Error(`Invalid date "${s}". Use local ISO format, e.g. 2026-10-23T18:30, or HH:MM.`);
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T09:00`) : new Date(s.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date "${s}".`);
  return d;
}

export function reminderTools(services) {
  const { reminders } = services;
  const now = () => (services.now ? services.now() : new Date());
  const group = 'reminders and timers';
  return [
    {
      name: 'reminder_create',
      group,
      description:
        'Creates a reminder or a timer. At that moment the user gets a notice (speech bubble, desktop notification and/or voice), even if the chat is closed. Use in_minutes for timers ("in 10 minutes") and at for clock times: local ISO date-time like 2026-10-23T18:30 (the current date and time zone are in your instructions) or just HH:MM for the next time that hour comes. repeat: daily | weekdays | weekly | monthly.',
      schema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'What to remind the user about, in their language.' },
          at: { type: 'string', description: 'Local date-time (2026-10-23T18:30) or HH:MM.' },
          in_minutes: { type: 'number', description: 'Minutes from now (timers).' },
          repeat: { type: 'string', enum: REPEATS },
        },
        required: ['text'],
      },
      run: async ({ text, at, in_minutes: minutes, repeat }) => {
        if (repeat && !REPEATS.includes(repeat)) throw new Error(`repeat must be one of: ${REPEATS.join(', ')}`);
        const n = now();
        let due;
        if (minutes != null && minutes !== '') {
          const m = Number(minutes);
          if (!(m > 0)) throw new Error('in_minutes must be a positive number');
          due = new Date(n.getTime() + m * 60000);
        } else if (at) due = parseAt(at, n);
        else throw new Error('Give either at (a date-time) or in_minutes (a timer).');
        if (due <= n) throw new Error(`That time is in the past (now it is ${fmt(n.toISOString())}).`);
        return view(reminders.add({ text, due, repeat: repeat || null }));
      },
    },
    {
      name: 'reminder_list',
      group,
      description: "Lists the user's pending reminders and timers.",
      schema: { type: 'object', properties: {} },
      run: async () => reminders.list().map(view),
    },
    {
      name: 'reminder_cancel',
      group,
      description: 'Cancels a reminder or timer by id (get ids with reminder_list).',
      schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      run: async ({ id }) => {
        const r = reminders.list().find((x) => x.id === id);
        if (!r || !reminders.cancel(id)) throw new Error(`No reminder with id ${id}. Use reminder_list to see the ids.`);
        return `Cancelled reminder "${r.text}".`;
      },
    },
  ];
}
