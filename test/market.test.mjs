import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { __test } from 'electron';
import { listMarket, installMarket, marketIndex } from '../src/main/market.js';
import { listSkins, getSkin } from '../src/main/skins.js';
import { patchConfig, resetConfigCache } from '../src/main/config.js';
import { EMOTION_NAMES } from '../src/shared/expressions.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const lock = () => patchConfig({ content: { adultUnlockedAt: null } });
const unlock = () => patchConfig({ content: { adultUnlockedAt: Date.now() } });

test('mercado: cada skin tiene sus capas, una cara por emoción y miniatura', () => {
  const all = marketIndex();
  assert.ok(all.length >= 10, `${all.length}`);
  assert.ok(all.some((m) => m.adult) && all.some((m) => !m.adult));
  for (const m of all) {
    const dir = path.join(ROOT, 'assets', 'market', m.dir);
    const man = JSON.parse(fs.readFileSync(path.join(dir, 'skin.json'), 'utf8'));
    assert.equal(man.id, m.id);
    assert.ok(man.market.age >= 18, `${m.id}: edad`);
    assert.equal(man.market.adult, m.adult);
    for (const f of Object.values(man.files)) assert.ok(fs.existsSync(path.join(dir, f)), `${m.id}: falta ${f}`);
    for (const e of EMOTION_NAMES.filter((n) => n !== 'neutral')) assert.ok(man.emotions[e] && fs.existsSync(path.join(dir, man.emotions[e])), `${m.id}: sin cara ${e}`);
    assert.ok(fs.existsSync(path.join(ROOT, 'assets', 'gallery', `${m.id}.jpg`)), `${m.id}: sin miniatura`);
  }
});

test('mercado: las +18 no se listan ni se instalan con el contenido bloqueado', () => {
  lock();
  const r = listMarket();
  assert.ok(r.items.every((m) => !m.adult));
  assert.ok(r.hiddenAdult > 0);
  const adult = marketIndex().find((m) => m.adult);
  assert.deepEqual(installMarket(adult.id), { error: 'adultLocked' });
  assert.ok(!fs.existsSync(path.join(__test.userData, 'skins', adult.id)));
  unlock();
  assert.equal(listMarket().hiddenAdult, 0);
  assert.ok(listMarket().items.some((m) => m.adult));
});

test('mercado: instalar copia la skin con sus caras; al volver a bloquear la +18 desaparece', () => {
  unlock();
  const adult = marketIndex().find((m) => m.adult);
  const plain = marketIndex().find((m) => !m.adult);
  for (const m of [adult, plain]) assert.deepEqual(installMarket(m.id), { id: m.id });
  const s = getSkin(adult.id);
  assert.equal(s.id, adult.id);
  assert.equal(s.type, '2d');
  assert.ok(s.urls.emotions.happy.startsWith('app://local/user/skins/'));
  assert.ok(listMarket().items.find((m) => m.id === plain.id).installed);
  lock();
  resetConfigCache();
  assert.ok(!listSkins().some((x) => x.id === adult.id), 'oculta con el bloqueo');
  assert.equal(getSkin(adult.id).id, 'default', 'vuelve a la de serie');
  assert.ok(listSkins().some((x) => x.id === plain.id));
});
