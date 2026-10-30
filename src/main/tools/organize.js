// Herramientas de organización: tareas pendientes, rutinas programadas y modo concentración.
// services.tasks / services.focus / services.routines vienen de main.js (en los tests, dobles).
import { PRIORITIES, TASK_FILTERS } from '../productivity/tasks.js';
import { makeRoutine } from '../productivity/routines.js';
import { loadConfig, patchConfig } from '../config.js';
import { t } from '../../shared/i18n/index.js';

const taskView = (x) => ({
  id: x.id,
  title: x.title,
  ...(x.notes ? { notes: x.notes } : {}),
  ...(x.due ? { due: x.due } : {}),
  priority: x.priority,
  ...(x.project ? { project: x.project } : {}),
  done: x.done,
  ...(x.overdue ? { overdue: true } : {}),
});

export function taskTools(services) {
  const { tasks } = services;
  if (!tasks) return [];
  const group = 'to-do list';
  const props = {
    title: { type: 'string' },
    notes: { type: 'string' },
    due: { type: 'string', description: 'Local date YYYY-MM-DD or date-time YYYY-MM-DDTHH:MM. Empty to remove.' },
    priority: { type: 'string', enum: PRIORITIES },
    project: { type: 'string', description: 'Optional project or list name, e.g. "VPS" or "Home".' },
  };
  return [
    {
      name: 'task_add',
      group,
      description:
        "Adds a task to the user's to-do list (things to do, not timed alerts: use reminder_create for those). Use it when the user says they have to do something or asks you to note a task.",
      schema: { type: 'object', properties: props, required: ['title'] },
      run: async (input) => taskView(tasks.add(input)),
    },
    {
      name: 'task_list',
      group,
      description: `Lists tasks. filter: open (default), today (due today or overdue), overdue, week (due in the next 7 days), done or all. Optional project and query (text search).`,
      schema: { type: 'object', properties: { filter: { type: 'string', enum: TASK_FILTERS }, project: { type: 'string' }, query: { type: 'string' } } },
      run: async ({ filter, project, query } = {}) => {
        const list = tasks.list({ filter: filter || 'open', project, query });
        return { count: list.length, tasks: list.slice(0, 60).map(taskView), projects: tasks.projects() };
      },
    },
    {
      name: 'task_update',
      group,
      description: 'Changes a task (title, notes, due date, priority or project) by id. Get ids with task_list.',
      schema: { type: 'object', properties: { id: { type: 'string' }, ...props }, required: ['id'] },
      run: async ({ id, ...patch }) => taskView(tasks.update(id, patch)),
    },
    {
      name: 'task_complete',
      group,
      description: 'Marks a task as done (or as not done with done=false).',
      schema: { type: 'object', properties: { id: { type: 'string' }, done: { type: 'boolean' } }, required: ['id'] },
      run: async ({ id, done = true }) => taskView(tasks.complete(id, done)),
    },
    {
      name: 'task_delete',
      group,
      description: 'Deletes a task by id. Prefer task_complete for tasks the user finished.',
      schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      run: async ({ id }) => {
        const x = tasks.get(id);
        if (!x || !tasks.remove(id)) throw new Error(`No task with id ${id}.`);
        return `Deleted task "${x.title}".`;
      },
    },
  ];
}

const routineView = (r, log) => ({ id: r.id, name: r.name, prompt: r.prompt, time: r.time, days: r.days, enabled: r.enabled, ...(log?.info(r.id) ? { lastRun: log.info(r.id).at } : {}) });

export function routineTools(services) {
  const group = 'scheduled routines';
  const list = () => loadConfig().productivity.routines || [];
  const store = (next) => {
    patchConfig({ productivity: { routines: next } });
    services.configChanged?.();
  };
  return [
    {
      name: 'routine_create',
      group,
      description:
        'Creates a routine: a request that YOU will run automatically at a time on some days, then report the result to the user (e.g. "every Monday at 9 ask Hermes about the backups and tell me", "every weekday at 8:00 summarize my GitHub notifications"). prompt is the instruction you will receive then, written as a complete request. days: daily (default), weekdays, weekends or a list of 1-7 (1 = Monday). For simple alerts use reminder_create instead.',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          prompt: { type: 'string' },
          time: { type: 'string', description: 'HH:MM, 24 h, local time.' },
          days: { type: 'string', description: 'daily (default) | weekdays | weekends | comma-separated days 1-7 (1 = Monday), e.g. "1,3,5".' },
        },
        required: ['name', 'prompt', 'time'],
      },
      confirm: ({ name, time }) => ({ title: t('approve.routine.title'), message: t('approve.routine.message', { name: String(name || ''), time: String(time || '') }), detail: '' }),
      run: async (input) => {
        const r = makeRoutine(input);
        store([...list(), r]);
        return routineView(r);
      },
    },
    {
      name: 'routine_list',
      group,
      description: 'Lists the scheduled routines.',
      schema: { type: 'object', properties: {} },
      run: async () => list().map((r) => routineView(r, services.routineLog)),
    },
    {
      name: 'routine_update',
      group,
      description: 'Changes a routine (name, prompt, time, days or enabled) by id.',
      schema: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, prompt: { type: 'string' }, time: { type: 'string' }, days: { type: 'string' }, enabled: { type: 'boolean' } }, required: ['id'] },
      confirm: ({ id }) => ({ title: t('approve.routine.title'), message: t('approve.routine.update', { name: list().find((r) => r.id === id)?.name || id }), detail: '' }),
      run: async ({ id, ...patch }) => {
        const all = list();
        const cur = all.find((r) => r.id === id);
        if (!cur) throw new Error(`No routine with id ${id}.`);
        const next = makeRoutine({ ...cur, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) }, id);
        store(all.map((r) => (r.id === id ? next : r)));
        return routineView(next);
      },
    },
    {
      name: 'routine_delete',
      group,
      description: 'Deletes a routine by id.',
      schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      run: async ({ id }) => {
        const all = list();
        const cur = all.find((r) => r.id === id);
        if (!cur) throw new Error(`No routine with id ${id}.`);
        store(all.filter((r) => r.id !== id));
        return `Deleted routine "${cur.name}".`;
      },
    },
  ];
}

export function focusTools(services) {
  const { focus } = services;
  if (!focus) return [];
  const group = 'focus mode (Pomodoro)';
  const view = (s) => ({ ...s, remaining: s.remainingSec ? `${Math.floor(s.remainingSec / 60)} min ${s.remainingSec % 60} s` : undefined });
  return [
    {
      name: 'focus_start',
      group,
      description:
        'Starts a focus session (Pomodoro): a work block (default from settings, usually 25 min) followed by breaks; you will announce each change. While working, notices are kept quiet if the user enabled "do not disturb". Optional label: what they are working on.',
      schema: { type: 'object', properties: { minutes: { type: 'number' }, label: { type: 'string' } } },
      run: async (input) => view(focus.start(input)),
    },
    {
      name: 'focus_stop',
      group,
      description: 'Stops the focus session.',
      schema: { type: 'object', properties: {} },
      run: async () => view(focus.stop()),
    },
    {
      name: 'focus_status',
      group,
      description: "Current focus phase (work, short, long or off), time left and today's focused minutes and sessions, plus the last 7 days.",
      schema: { type: 'object', properties: {} },
      run: async () => ({ ...view(focus.status()), lastDays: focus.history(7) }),
    },
  ];
}
