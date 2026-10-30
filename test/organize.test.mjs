process.env.TZ = 'Europe/Madrid';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Tasks, normalizeDue } from '../src/main/productivity/tasks.js';
import { makeRoutine, normalizeDays, normalizeTime, routineDue, dueRoutines, RoutineLog, ROUTINE_PROMPT } from '../src/main/productivity/routines.js';
import { Focus, focusSettings } from '../src/main/productivity/focus.js';
import { taskTools, routineTools, focusTools } from '../src/main/tools/organize.js';
import { BRIEFING_PROMPT } from '../src/main/productivity/briefing.js';

const tmp = (name) => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wd-org-')), name);
const local = (y, m, d, h = 9, mi = 0) => new Date(y, m - 1, d, h, mi);

test('normalizeDue acepta fecha, fecha y hora o nada', () => {
  assert.equal(normalizeDue('2026-10-30'), '2026-10-30');
  assert.equal(normalizeDue('2026-10-30 18:05'), '2026-10-30T18:05');
  assert.equal(normalizeDue('2026-10-30T18:05:44'), '2026-10-30T18:05');
  assert.equal(normalizeDue(''), null);
  assert.throws(() => normalizeDue('el viernes'), /YYYY-MM-DD/);
});

test('Tasks: añadir, filtrar, ordenar, completar y guardar', () => {
  const file = tmp('tasks.json');
  let now = local(2026, 10, 30, 12);
  const changes = [];
  const tasks = new Tasks({ file, now: () => now, onChange: (l) => changes.push(l.length) });
  const a = tasks.add({ title: 'Renovar dominio', due: '2026-10-29', priority: 'high', project: 'VPS' });
  const b = tasks.add({ title: 'Comprar café' });
  const c = tasks.add({ title: 'Informe', due: '2026-10-30T18:00' });
  tasks.add({ title: 'Viaje', due: '2026-11-20', priority: 'low' });
  assert.throws(() => tasks.add({ title: '  ' }), /title/);
  assert.throws(() => tasks.add({ title: 'x', priority: 'urgent' }), /priority/);

  // Alta primero; luego por fecha; las sin fecha al final.
  assert.deepEqual(
    tasks.list().map((x) => x.title),
    ['Renovar dominio', 'Informe', 'Comprar café', 'Viaje'],
  );
  assert.deepEqual(
    tasks.list({ filter: 'today' }).map((x) => x.id),
    [a.id, c.id],
  );
  assert.deepEqual(
    tasks.list({ filter: 'overdue' }).map((x) => x.id),
    [a.id],
  );
  assert.equal(tasks.list({ filter: 'week' }).length, 2);
  assert.deepEqual(
    tasks.list({ project: 'vps' }).map((x) => x.id),
    [a.id],
  );
  assert.deepEqual(
    tasks.list({ query: 'café' }).map((x) => x.id),
    [b.id],
  );
  assert.equal(tasks.list()[0].overdue, true);
  assert.deepEqual(tasks.counts(), { open: 4, overdue: 1, today: 1 });

  tasks.complete(a.id);
  assert.equal(tasks.get(a.id).done, true);
  assert.ok(tasks.get(a.id).doneAt);
  assert.equal(tasks.list({ filter: 'done' }).length, 1);
  tasks.update(c.id, { due: '', priority: 'low' });
  assert.equal(tasks.get(c.id).due, null);
  assert.throws(() => tasks.update('nope', {}), /No task/);

  // Se guarda y se vuelve a leer.
  const again = new Tasks({ file, now: () => now });
  assert.equal(again.list({ filter: 'all' }).length, 4);
  assert.equal(again.clearDone(), 1);
  assert.equal(again.remove(b.id), true);
  assert.equal(again.remove(b.id), false);
  assert.ok(changes.length >= 6);
  now = local(2026, 11, 1);
});

test('rutinas: hora, días y cuándo tocan', () => {
  assert.equal(normalizeTime('8:05'), '08:05');
  assert.throws(() => normalizeTime('25:00'), /HH:MM/);
  assert.deepEqual(normalizeDays('weekdays'), [1, 2, 3, 4, 5]);
  assert.deepEqual(normalizeDays('mon, wed,fri'), [1, 3, 5]);
  assert.deepEqual(normalizeDays('7,1'), [1, 7]);
  assert.deepEqual(normalizeDays([6, 7]), [6, 7]);
  assert.deepEqual(normalizeDays(''), [1, 2, 3, 4, 5, 6, 7]);
  assert.throws(() => normalizeDays('lunes'), /Invalid day/);

  const r = makeRoutine({ name: 'Copias', prompt: 'Pregunta a Hermes por las copias', time: '09:00', days: 'weekdays' }, 'r1');
  assert.throws(() => makeRoutine({ name: 'x', prompt: '', time: '09:00' }), /prompt/);
  const fri = (h, mi) => local(2026, 10, 30, h, mi); // viernes
  assert.equal(routineDue(fri(8, 59), r, null), false);
  assert.equal(routineDue(fri(9, 0), r, null), true);
  assert.equal(routineDue(fri(9, 29), r, null), true);
  assert.equal(routineDue(fri(9, 31), r, null), false); // fuera del margen de 30 min
  assert.equal(routineDue(fri(9, 5), r, '2026-10-30'), false); // ya se hizo hoy
  assert.equal(routineDue(local(2026, 10, 31, 9, 5), r, null), false); // sábado
  assert.equal(routineDue(fri(9, 5), { ...r, enabled: false }, null), false);

  const log = new RoutineLog(tmp('routines.json'));
  const late = makeRoutine({ name: 'B', prompt: 'b', time: '09:10' }, 'r2');
  assert.deepEqual(
    dueRoutines(fri(9, 15), [late, r], log).map((x) => x.id),
    ['r1', 'r2'],
  );
  log.mark('r1', fri(9, 15), 'todo bien');
  assert.deepEqual(
    dueRoutines(fri(9, 16), [late, r], log).map((x) => x.id),
    ['r2'],
  );
  assert.equal(new RoutineLog(log.file).info('r1').result, 'todo bien');
  log.prune(['r2']);
  assert.equal(log.lastRun('r1'), null);
  assert.match(ROUTINE_PROMPT(r, 'Friday'), /Pregunta a Hermes por las copias/);
  assert.match(BRIEFING_PROMPT('Friday'), /task_list/);
});

// Reloj y temporizadores falsos.
function clock(start) {
  let now = start.getTime();
  let timers = [];
  let seq = 0;
  return {
    now: () => new Date(now),
    setTimer: (fn, ms) => {
      const id = ++seq;
      timers.push({ id, at: now + ms, fn });
      return id;
    },
    clearTimer: (id) => {
      timers = timers.filter((x) => x.id !== id);
    },
    advance(ms) {
      const end = now + ms;
      for (;;) {
        timers.sort((a, b) => a.at - b.at);
        const next = timers[0];
        if (!next || next.at > end) break;
        timers.shift();
        now = next.at;
        next.fn();
      }
      now = end;
    },
  };
}

test('Focus: trabajo, descansos, largo cada N, estadísticas y no molestar', () => {
  const c = clock(local(2026, 10, 30, 10));
  const phases = [];
  const settings = { work: 25, short: 5, long: 15, every: 2, autoContinue: true, dnd: true };
  const focus = new Focus({ file: tmp('focus.json'), settings: () => settings, onPhase: (p, i) => phases.push(`${p}:${i.reason}:${i.minutes}`), now: c.now, setTimer: c.setTimer, clearTimer: c.clearTimer });
  assert.equal(focus.quiet, false);
  focus.start({ label: 'informe' });
  assert.equal(focus.quiet, true);
  assert.equal(focus.status().remainingSec, 25 * 60);
  c.advance(25 * 60000);
  assert.equal(focus.status().phase, 'short');
  assert.equal(focus.quiet, false);
  c.advance(5 * 60000);
  assert.equal(focus.status().phase, 'work');
  c.advance(25 * 60000);
  assert.equal(focus.status().phase, 'long'); // segundo bloque → descanso largo
  assert.deepEqual(focus.today(), { sessions: 2, minutes: 50 });
  focus.stop();
  assert.equal(focus.status().phase, 'off');
  assert.deepEqual(phases, ['work:start:25', 'short:workDone:5', 'work:breakDone:25', 'long:workDone:15', 'off:stopped:0']);

  // Un bloque a medias cuenta los minutos, no la sesión; sin autoContinue se para tras el descanso.
  settings.autoContinue = false;
  focus.start({ minutes: 50 });
  c.advance(10 * 60000);
  focus.stop();
  assert.deepEqual(focus.today(), { sessions: 2, minutes: 60 });
  focus.start({ minutes: 1 });
  c.advance(60000);
  c.advance(5 * 60000);
  assert.equal(focus.status().phase, 'off');
  const hist = focus.history(7);
  assert.equal(hist.length, 7);
  assert.equal(hist.at(-1).minutes, 61);
  // Se guarda en disco.
  assert.equal(new Focus({ file: focus.file, now: c.now }).today().sessions, 3);
  assert.deepEqual(focusSettings({ work: -3, every: 0 }).work, 25);
});

test('herramientas de tareas, rutinas y concentración', async () => {
  const tasks = new Tasks({ file: tmp('t.json'), now: () => local(2026, 10, 30, 12) });
  const [add, list, update, complete, del] = taskTools({ tasks });
  const t1 = await add.run({ title: 'Llamar al banco', due: '2026-10-30', priority: 'high' });
  assert.equal(t1.priority, 'high');
  assert.equal((await list.run({ filter: 'today' })).count, 1);
  assert.equal((await update.run({ id: t1.id, project: 'Casa' })).project, 'Casa');
  assert.equal((await complete.run({ id: t1.id })).done, true);
  assert.match(await del.run({ id: t1.id }), /Llamar al banco/);
  await assert.rejects(del.run({ id: t1.id }), /No task/);
  assert.deepEqual(taskTools({}), []);

  const rt = routineTools({});
  assert.deepEqual(rt.map((x) => x.name).sort(), ['routine_create', 'routine_delete', 'routine_list', 'routine_update']);
  assert.ok(rt.find((x) => x.name === 'routine_create').confirm({ name: 'x', time: '09:00' }).message);

  const c = clock(local(2026, 10, 30, 10));
  const focus = new Focus({ file: tmp('f.json'), now: c.now, setTimer: c.setTimer, clearTimer: c.clearTimer });
  const [start, stop, status] = focusTools({ focus });
  assert.equal((await start.run({ minutes: 30 })).phase, 'work');
  assert.match((await status.run()).remaining, /30 min/);
  assert.equal((await stop.run()).phase, 'off');
});
