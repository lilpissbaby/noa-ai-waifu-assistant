process.env.TZ = 'Europe/Madrid';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { nextDue, Reminders } from '../src/main/productivity/reminders.js';
import { reminderTools } from '../src/main/tools/reminders.js';

const local = (y, m, d, h = 9, mi = 0) => new Date(y, m - 1, d, h, mi);
const parts = (dt) => [dt.getFullYear(), dt.getMonth() + 1, dt.getDate(), dt.getHours(), dt.getMinutes()];

test('nextDue diario mantiene la hora local al cambiar al horario de invierno', () => {
  const sat = local(2026, 10, 24, 9);
  const sun = nextDue(sat, 'daily');
  assert.deepEqual(parts(sun), [2026, 10, 25, 9, 0]);
  assert.equal(sun - sat, 25 * 3600 * 1000); // ese día dura 25 horas
  assert.deepEqual(parts(nextDue(sun, 'daily')), [2026, 10, 26, 9, 0]);
});

test('nextDue laborables, semanal y mensual', () => {
  assert.deepEqual(parts(nextDue(local(2026, 10, 23, 8, 30), 'weekdays')), [2026, 10, 26, 8, 30]); // viernes → lunes
  assert.deepEqual(parts(nextDue(local(2026, 10, 20, 8, 30), 'weekdays')), [2026, 10, 21, 8, 30]);
  assert.deepEqual(parts(nextDue(local(2026, 10, 23), 'weekly')), [2026, 10, 30, 9, 0]);
  assert.deepEqual(parts(nextDue(local(2026, 1, 31), 'monthly')), [2026, 2, 28, 9, 0]);
  // El día de anclaje se conserva: tras febrero vuelve al 31.
  assert.deepEqual(parts(nextDue(local(2026, 2, 28), 'monthly', 31)), [2026, 3, 31, 9, 0]);
  assert.throws(() => nextDue(local(2026, 1, 1), 'yearly'));
});

// Reloj y temporizadores falsos: advance(ms) mueve el reloj y dispara lo que toque.
function fakeClock(start) {
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
    clearTimer: (id) => (timers = timers.filter((x) => x.id !== id)),
    pending: () => timers.length,
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
const tmpFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'waifu-rem-')), 'reminders.json');

test('un recordatorio único dispara una vez y desaparece', () => {
  const clock = fakeClock(local(2026, 10, 23, 10));
  const fired = [];
  const r = new Reminders({ file: tmpFile(), ...clock, onFire: (rem, info) => fired.push([rem.text, info.late]) });
  r.start();
  r.add({ text: 'Llamar a mamá', due: local(2026, 10, 23, 10, 30) });
  clock.advance(29 * 60 * 1000);
  assert.equal(fired.length, 0);
  clock.advance(2 * 60 * 1000);
  assert.deepEqual(fired, [['Llamar a mamá', false]]);
  clock.advance(24 * 3600 * 1000);
  assert.equal(fired.length, 1);
  assert.equal(r.list().length, 0);
});

test('un recordatorio diario se reprograma', () => {
  const clock = fakeClock(local(2026, 10, 23, 10));
  const fired = [];
  const r = new Reminders({ file: tmpFile(), ...clock, onFire: (rem) => fired.push(rem.text) });
  r.start();
  const rem = r.add({ text: 'Agua', due: local(2026, 10, 23, 11), repeat: 'daily' });
  clock.advance(3 * 24 * 3600 * 1000);
  assert.equal(fired.length, 3);
  assert.equal(r.list().length, 1);
  assert.deepEqual(parts(new Date(r.list()[0].due)), [2026, 10, 26, 11, 0]);
  assert.equal(r.cancel(rem.id), true);
  assert.equal(r.cancel(rem.id), false);
  clock.advance(2 * 24 * 3600 * 1000);
  assert.equal(fired.length, 3);
});

test('los plazos de más de 24 días se trocean', () => {
  const clock = fakeClock(local(2026, 10, 23, 10));
  const fired = [];
  const r = new Reminders({ file: tmpFile(), ...clock, onFire: (rem) => fired.push(rem.text) });
  r.start();
  r.add({ text: 'Renovar el dominio', due: local(2027, 1, 23, 10) });
  clock.advance(60 * 24 * 3600 * 1000);
  assert.equal(fired.length, 0);
  clock.advance(33 * 24 * 3600 * 1000); // 92 días y una hora más (el cambio de hora de octubre)
  assert.deepEqual(fired, ['Renovar el dominio']);
});

test('al arrancar: vencido hace 2 h → aviso con retraso una vez; hace 3 días → se borra sin avisar', () => {
  const file = tmpFile();
  fs.writeFileSync(
    file,
    JSON.stringify([
      { id: 'a', text: 'Reciente', due: local(2026, 10, 23, 8).toISOString(), repeat: null, created: local(2026, 10, 22).toISOString() },
      { id: 'b', text: 'Viejo', due: local(2026, 10, 20, 8).toISOString(), repeat: null, created: local(2026, 10, 19).toISOString() },
      { id: 'c', text: 'Diario viejo', due: local(2026, 10, 20, 7).toISOString(), repeat: 'daily', created: local(2026, 10, 19).toISOString() },
    ]),
  );
  const clock = fakeClock(local(2026, 10, 23, 10));
  const fired = [];
  const r = new Reminders({ file, ...clock, onFire: (rem, info) => fired.push([rem.text, info.late]) });
  r.start();
  assert.deepEqual(fired, [['Reciente', true]]);
  assert.deepEqual(
    r.list().map((x) => x.id),
    ['c'],
  );
  assert.deepEqual(parts(new Date(r.list()[0].due)), [2026, 10, 24, 7, 0]);
  clock.advance(3600 * 1000);
  assert.equal(fired.length, 1);
});

test('persistencia entre instancias', () => {
  const file = tmpFile();
  const clock = fakeClock(local(2026, 10, 23, 10));
  const a = new Reminders({ file, ...clock, onFire: () => {} });
  a.start();
  const rem = a.add({ text: 'Pagar la luz', due: local(2026, 10, 30, 9), repeat: 'monthly' });
  const b = new Reminders({ file, ...clock, onFire: () => {} });
  b.load();
  assert.deepEqual(b.list(), [rem]);
  assert.equal(b.list()[0].day, 30);
});

test('herramientas: crear con in_minutes o at, validar fechas, listar y cancelar', async () => {
  const clock = fakeClock(local(2026, 10, 23, 10));
  const reminders = new Reminders({ file: tmpFile(), ...clock, onFire: () => {} });
  reminders.start();
  const tools = Object.fromEntries(reminderTools({ reminders, now: clock.now }).map((x) => [x.name, x]));
  const a = await tools.reminder_create.run({ text: 'Té', in_minutes: 5 });
  assert.equal(new Date(a.due).getTime(), local(2026, 10, 23, 10, 5).getTime());
  const b = await tools.reminder_create.run({ text: 'Reunión', at: '2026-10-23T16:00', repeat: 'weekdays' });
  assert.deepEqual(parts(new Date(b.due)), [2026, 10, 23, 16, 0]);
  assert.equal(b.repeat, 'weekdays');
  await assert.rejects(tools.reminder_create.run({ text: 'x' }), /at|in_minutes/);
  await assert.rejects(tools.reminder_create.run({ text: 'x', at: '2026-10-22T09:00' }), /past/);
  await assert.rejects(tools.reminder_create.run({ text: 'x', at: 'mañana' }), /date/i);
  await assert.rejects(tools.reminder_create.run({ text: 'x', in_minutes: 5, repeat: 'yearly' }), /repeat/);
  const list = await tools.reminder_list.run({});
  assert.deepEqual(
    list.map((x) => x.text),
    ['Té', 'Reunión'],
  );
  assert.match(list[0].when, /10:05/);
  assert.match(await tools.reminder_cancel.run({ id: a.id }), /Cancelled/);
  await assert.rejects(tools.reminder_cancel.run({ id: 'nope' }), /No reminder/);
});
