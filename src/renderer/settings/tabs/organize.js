// Ajustes → Organización: tareas pendientes, rutinas programadas, modo concentración y pausas.
import { localeTag } from '../../../shared/i18n/index.js';

const DAYS = [1, 2, 3, 4, 5, 6, 7];
const dayName = (d) => new Date(2026, 0, 4 + d).toLocaleDateString(localeTag(), { weekday: 'short' });
const subs = new Map(); // canal → función para darse de baja al repintar

function listen(wd, channel, fn) {
  subs.get(channel)?.();
  subs.set(channel, wd.on(channel, fn));
}

function fmtDue(due) {
  if (!due) return '';
  const d = new Date(due.length === 10 ? `${due}T00:00` : due);
  return due.length === 10 ? d.toLocaleDateString(localeTag(), { weekday: 'short', day: 'numeric', month: 'short' }) : d.toLocaleString(localeTag(), { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

// ---------------------------------------------------------------- tareas
let taskFilter = 'open';

function tasksCard(ui) {
  const { t, card, h, wd, icons, field } = ui;
  const list = h('div', { class: 'voice-list', id: 'taskList' });
  const chips = h('div', { class: 'chips' });
  let all = [];
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const filters = {
    open: (x) => !x.done,
    today: (x) => !x.done && x.due && x.due.slice(0, 10) <= todayKey,
    done: (x) => x.done,
    all: () => true,
  };
  const paint = () => {
    chips.innerHTML = '';
    for (const f of Object.keys(filters))
      chips.append(
        h(
          'button',
          {
            class: `chip ${f === taskFilter ? 'active' : ''}`,
            onclick: () => {
              taskFilter = f;
              paint();
            },
          },
          `${t(`org.tasks.filter.${f}`)} · ${all.filter(filters[f]).length}`,
        ),
      );
    list.innerHTML = '';
    const items = all.filter(filters[taskFilter]);
    if (!items.length) list.append(h('p', { class: 'small muted' }, t('org.tasks.empty')));
    for (const x of items)
      list.append(
        h(
          'div',
          { class: `voice-row task ${x.done ? 'done' : ''} ${x.overdue ? 'overdue' : ''}`, 'data-task': x.id },
          h('input', {
            type: 'checkbox',
            checked: x.done,
            title: t('org.tasks.complete'),
            onchange: async (e) => {
              await wd.invoke('productivity:task-update', x.id, { done: e.target.checked });
            },
          }),
          h(
            'div',
            { class: 'grow' },
            h('strong', {}, x.title),
            h(
              'div',
              { class: 'small muted' },
              [x.priority !== 'normal' ? h('span', { class: `pill prio-${x.priority}` }, t(`org.tasks.priority.${x.priority}`)) : null, x.due ? h('span', { class: x.overdue ? 'late' : '' }, fmtDue(x.due)) : null, x.project ? h('span', {}, `# ${x.project}`) : null, x.notes ? h('span', { title: x.notes }, '📝') : null].filter(Boolean).flatMap((el, i) => (i ? [' · ', el] : [el])),
            ),
          ),
          h('button', { class: 'btn ghost danger', html: icons.trash, title: t('settings.common.delete'), onclick: () => wd.invoke('productivity:task-remove', x.id) }),
        ),
      );
  };
  const load = async () => {
    all = await wd.invoke('productivity:tasks');
    if (list.isConnected || !list.parentNode) paint();
  };
  load();
  listen(wd, 'productivity:tasks', (items) => {
    all = items;
    if (list.isConnected) paint();
  });

  const title = h('input', { type: 'text', placeholder: t('org.tasks.titlePlaceholder') });
  const due = h('input', { type: 'date' });
  const project = h('input', { type: 'text', placeholder: t('org.tasks.projectPlaceholder') });
  const prio = h(
    'select',
    {},
    ['normal', 'high', 'low'].map((p) => h('option', { value: p }, t(`org.tasks.priority.${p}`))),
  );
  const add = async () => {
    if (!title.value.trim()) return title.focus();
    await wd.invoke('productivity:task-add', { title: title.value, due: due.value || null, priority: prio.value, project: project.value });
    title.value = '';
    due.value = '';
    title.focus();
  };
  title.addEventListener('keydown', (e) => e.key === 'Enter' && add());
  return card(
    t('org.tasks.title'),
    t('org.tasks.desc'),
    h('div', { class: 'grid task-add' }, h('div', { class: 'full' }, field(t('org.tasks.new'), title)), field(t('org.tasks.due'), due), field(t('org.tasks.priorityLabel'), prio), field(t('org.tasks.project'), project)),
    h(
      'div',
      { class: 'row', style: 'margin:10px 0 14px' },
      h('button', { class: 'btn primary', onclick: add, html: `${icons.plus} ${t('org.tasks.add')}` }),
      h(
        'button',
        {
          class: 'btn ghost',
          onclick: async () => {
            const n = await wd.invoke('productivity:task-clear-done');
            ui.toast(t('org.tasks.cleared', { count: n }));
          },
        },
        t('org.tasks.clearDone'),
      ),
    ),
    chips,
    list,
  );
}

// ---------------------------------------------------------------- rutinas
function routinesCard(ui) {
  const { t, card, h, wd, icons, field } = ui;
  const routines = () => ui.getPc().config.productivity.routines || [];
  const box = h('div', { class: 'routine-list' });
  let log = {};
  const store = async (next) => {
    await ui.saveList('productivity.routines', next);
    paint();
  };
  const daysBox = (days, onChange) =>
    h(
      'div',
      { class: 'row days' },
      DAYS.map((d) =>
        h(
          'label',
          { class: 'check' },
          h('input', {
            type: 'checkbox',
            checked: days.includes(d),
            onchange: (e) => onChange(e.target.checked ? [...new Set([...days, d])].sort() : days.filter((x) => x !== d)),
          }),
          dayName(d),
        ),
      ),
    );
  const paint = () => {
    box.innerHTML = '';
    const all = routines();
    if (!all.length) box.append(h('p', { class: 'small muted' }, t('org.routines.empty')));
    all.forEach((r, i) => {
      const last = log[r.id];
      box.append(
        h(
          'div',
          { class: 'sub-card' },
          h(
            'div',
            { class: 'grid' },
            field(t('settings.common.name'), ui.itemText('productivity.routines', i, 'name')),
            field(t('org.routines.time'), ui.itemText('productivity.routines', i, 'time', { type: 'time' })),
            h('div', { class: 'full' }, field(t('org.routines.days'), daysBox(r.days || [], (days) => days.length && store(all.map((x, j) => (j === i ? { ...x, days } : x)))))),
            h(
              'div',
              { class: 'full' },
              field(
                t('org.routines.prompt'),
                h('textarea', {
                  rows: 3,
                  value: r.prompt,
                  oninput: (e) => {
                    all[i].prompt = e.target.value;
                    ui.save('productivity.routines', all, 600);
                  },
                }),
              ),
            ),
          ),
          h(
            'div',
            { class: 'row', style: 'margin-top:8px' },
            ui.itemCheck('productivity.routines', i, 'enabled', t('settings.auto.enabled')),
            h('span', { class: 'grow small muted' }, last?.at ? t('org.routines.lastRun', { when: new Date(last.at).toLocaleString(localeTag(), { dateStyle: 'medium', timeStyle: 'short' }) }) : t('org.routines.never')),
            h('button', { class: 'btn', onclick: () => wd.invoke('productivity:routine-run', r.id) }, t('org.routines.runNow')),
            h('button', { class: 'btn ghost danger', html: icons.trash, title: t('settings.common.delete'), onclick: () => store(all.filter((x) => x.id !== r.id)) }),
          ),
          last?.result ? h('details', { class: 'help' }, h('summary', {}, t('org.routines.lastResult')), h('p', { class: 'small' }, last.result)) : null,
        ),
      );
    });
  };
  wd.invoke('productivity:routine-log').then((l) => {
    log = l || {};
    paint();
  });
  listen(wd, 'productivity:routine-log', (l) => {
    log = l || {};
    if (box.isConnected) paint();
  });
  paint();

  // Ejemplos: rellenan el formulario de nueva rutina.
  const name = h('input', { type: 'text', placeholder: t('org.routines.namePlaceholder') });
  const time = h('input', { type: 'time', value: '09:00' });
  let days = [1, 2, 3, 4, 5];
  const newDays = h('div');
  const paintDays = () => {
    newDays.innerHTML = '';
    newDays.append(
      daysBox(days, (d) => {
        days = d;
        paintDays();
      }),
    );
  };
  paintDays();
  const prompt = h('textarea', { rows: 3, placeholder: t('org.routines.promptPlaceholder') });
  const examples = h(
    'div',
    { class: 'chips' },
    [1, 2, 3, 4].map((n) =>
      h(
        'button',
        {
          class: 'chip',
          onclick: () => {
            name.value = t(`org.routines.example${n}.name`);
            prompt.value = t(`org.routines.example${n}.prompt`);
            time.value = ['08:30', '09:00', '18:00', '20:00'][n - 1];
          },
        },
        t(`org.routines.example${n}.name`),
      ),
    ),
  );
  return card(
    t('org.routines.title'),
    t('org.routines.desc'),
    box,
    h('h3', {}, t('org.routines.new')),
    h('div', { class: 'small muted', style: 'margin-bottom:6px' }, t('org.routines.examples')),
    examples,
    h('div', { class: 'grid', style: 'margin-top:10px' }, field(t('settings.common.name'), name), field(t('org.routines.time'), time), h('div', { class: 'full' }, field(t('org.routines.days'), newDays)), h('div', { class: 'full' }, field(t('org.routines.prompt'), prompt))),
    h(
      'div',
      { class: 'row', style: 'margin-top:10px' },
      h(
        'button',
        {
          class: 'btn primary',
          html: `${icons.plus} ${t('org.routines.add')}`,
          onclick: async () => {
            if (!name.value.trim() || !prompt.value.trim() || !time.value || !days.length) return ui.toast(t('org.routines.incomplete'));
            const id = await wd.invoke('cfg:new-id');
            await store([...routines(), { id, name: name.value.trim(), prompt: prompt.value.trim(), time: time.value, days, enabled: true }]);
            name.value = '';
            prompt.value = '';
          },
        },
      ),
    ),
  );
}

// ---------------------------------------------------------------- concentración
function focusCard(ui) {
  const { t, card, h, wd, field } = ui;
  const status = h('div', { class: 'focus-status' });
  const bars = h('div', { class: 'bars' });
  let timer = null;
  let st = null;
  const paint = () => {
    status.innerHTML = '';
    if (!st) return;
    const active = st.phase !== 'off';
    const mm = Math.floor(st.remainingSec / 60);
    const ss = String(st.remainingSec % 60).padStart(2, '0');
    status.append(
      h('div', { class: `focus-clock ${st.phase}` }, active ? `${mm}:${ss}` : '—'),
      h(
        'div',
        { class: 'grow' },
        h('strong', {}, t(`org.focus.phase.${st.phase}`)),
        st.label ? h('div', { class: 'small muted' }, st.label) : null,
        h('div', { class: 'small muted' }, t('org.focus.today', { minutes: Math.round(st.today.minutes), sessions: st.today.sessions })),
      ),
      active
        ? h('div', { class: 'row' }, h('button', { class: 'btn', onclick: async () => set(await wd.invoke('productivity:focus-skip')) }, t('org.focus.skip')), h('button', { class: 'btn ghost danger', onclick: async () => set(await wd.invoke('productivity:focus-stop')) }, t('org.focus.stop')))
        : h('button', { class: 'btn primary', onclick: async () => set(await wd.invoke('productivity:focus-start', {})) }, t('org.focus.start')),
    );
    const hist = st.history || [];
    const max = Math.max(30, ...hist.map((d) => d.minutes));
    bars.innerHTML = '';
    for (const d of hist)
      bars.append(
        h(
          'div',
          { class: 'bar', title: t('org.focus.barTitle', { minutes: Math.round(d.minutes), sessions: d.sessions }) },
          h('i', { style: `height:${Math.round((d.minutes / max) * 100)}%` }),
          h('span', {}, new Date(`${d.day}T12:00`).toLocaleDateString(localeTag(), { weekday: 'narrow' })),
        ),
      );
  };
  const set = (next) => {
    st = { ...st, ...next };
    paint();
  };
  const refresh = async () => {
    st = await wd.invoke('productivity:focus');
    paint();
  };
  refresh();
  listen(wd, 'productivity:focus', (next) => {
    if (!status.isConnected) return;
    set(next);
  });
  clearInterval(focusCard.tick);
  focusCard.tick = timer = setInterval(() => {
    if (!status.isConnected) return clearInterval(timer);
    if (st?.phase !== 'off' && st.remainingSec > 0) {
      st.remainingSec -= 1;
      paint();
    }
  }, 1000);
  return card(
    t('org.focus.title'),
    t('org.focus.desc'),
    status,
    h('div', { class: 'small muted', style: 'margin:12px 0 4px' }, t('org.focus.week')),
    bars,
    h(
      'div',
      { class: 'grid', style: 'margin-top:14px' },
      field(t('org.focus.work'), ui.text('productivity.focus.work', { type: 'number' })),
      field(t('org.focus.short'), ui.text('productivity.focus.short', { type: 'number' })),
      field(t('org.focus.long'), ui.text('productivity.focus.long', { type: 'number' })),
      field(t('org.focus.every'), ui.text('productivity.focus.every', { type: 'number' })),
      h('div', { class: 'full' }, ui.check('productivity.focus.autoContinue', t('org.focus.autoContinue')), ui.check('productivity.focus.dnd', t('org.focus.dnd'))),
    ),
  );
}

// ---------------------------------------------------------------- pausas
function breaksCard(ui) {
  const { t, card, h, field } = ui;
  return card(
    t('org.breaks.title'),
    t('org.breaks.desc'),
    ui.check('productivity.breaks.enabled', t('org.breaks.enable')),
    h('div', { class: 'grid', style: 'margin-top:10px' }, field(t('org.breaks.every'), ui.text('productivity.breaks.every', { type: 'number' }), t('org.breaks.everyHelp')), field(t('org.breaks.idleReset'), ui.text('productivity.breaks.idleResetMin', { type: 'number' }), t('org.breaks.idleResetHelp'))),
  );
}

export const ORGANIZE_SECTIONS = [tasksCard, focusCard, routinesCard, breaksCard];

export function organizeTab(ui) {
  return [ui.h('h1', {}, ui.t('org.nav')), ui.h('p', { class: 'lead' }, ui.t('org.lead')), ...ORGANIZE_SECTIONS.map((section) => section(ui))];
}
