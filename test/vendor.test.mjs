import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { VENDOR_FILES, IMPORT_MAP } from '../src/shared/vendor.js';
import { BUNDLE_ALLOWED, isBundleAllowed } from '../src/main/bundle-allowed.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

test('cada archivo de VENDOR_FILES existe en node_modules', () => {
  assert.equal(VENDOR_FILES.length, 14); // 11 del 3D + 3 de Live2D (pixi, su parche sin eval y el motor)
  for (const f of VENDOR_FILES) assert.ok(fs.existsSync(path.join(ROOT, f)), `falta ${f}`);
});

test('BUNDLE_ALLOWED permite los VENDOR_FILES y nada más de three o @pixiv', () => {
  for (const f of VENDOR_FILES) assert.ok(isBundleAllowed(f), `no se sirve ${f}`);
  for (const f of ['node_modules/three/package.json', 'node_modules/three/src/Three.js', 'node_modules/three/examples/jsm/loaders/OBJLoader.js', 'node_modules/@pixiv/three-vrm/lib/three-vrm.cjs', 'node_modules/@pixiv/three-vrm/package.json'])
    assert.equal(isBundleAllowed(f), false, `no debería servirse ${f}`);
  assert.ok(BUNDLE_ALLOWED.includes('src/renderer/'));
});

test('build.files incluye los VENDOR_FILES y excluye el resto de three y @pixiv', () => {
  const files = pkg.build.files;
  const exThree = files.indexOf('!node_modules/three/**');
  const exPixiv = files.indexOf('!node_modules/@pixiv/**');
  const exPixi = files.indexOf('!node_modules/pixi.js/**');
  const exEngine = files.indexOf('!node_modules/untitled-pixi-live2d-engine/**');
  assert.ok(exThree >= 0 && exPixiv >= 0 && exPixi >= 0 && exEngine >= 0, 'faltan las exclusiones');
  // electron-builder descarta las carpetas «examples» de node_modules: los complementos de three van
  // en un FileSet con el mismo destino.
  const sets = files.filter((f) => typeof f === 'object');
  for (const f of VENDOR_FILES) {
    const i = files.indexOf(f);
    const set = sets.find((s) => f.startsWith(`${s.from}/`) && s.to === s.from && s.filter.includes(f.slice(s.from.length + 1)));
    assert.ok(i > Math.max(exThree, exPixiv, exPixi, exEngine) || set, `${f} debe incluirse después de las exclusiones`);
  }
});

test('las dependencias 3D están fijadas', () => {
  assert.equal(pkg.dependencies.three, '0.186.1');
  assert.equal(pkg.dependencies['@pixiv/three-vrm'], '3.5.5');
  assert.equal(pkg.dependencies['@pixiv/three-vrm-animation'], '3.5.5');
  assert.equal(pkg.dependencies['pixi.js'], '8.22.0');
  assert.equal(pkg.dependencies['untitled-pixi-live2d-engine'], '1.4.0');
});

function htmlFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? htmlFiles(path.join(dir, e.name)) : e.name.endsWith('.html') ? [path.join(dir, e.name)] : []));
}

test('cada import map es IMPORT_MAP y su CSP lo autoriza por hash', () => {
  const pages = htmlFiles(path.join(ROOT, 'src/renderer')).filter((f) => fs.readFileSync(f, 'utf8').includes('type="importmap"'));
  assert.ok(pages.some((p) => p.endsWith('avatar.html')), 'el avatar debe tener import map');
  for (const page of pages) {
    const html = fs.readFileSync(page, 'utf8');
    const m = /<script type="importmap">([\s\S]*?)<\/script>/.exec(html);
    assert.deepEqual(JSON.parse(m[1]), IMPORT_MAP, `${page}: import map distinto`);
    const hash = crypto.createHash('sha256').update(m[1], 'utf8').digest('base64');
    const csp = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)[1];
    const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src'));
    assert.ok(scriptSrc.includes(`'sha256-${hash}'`), `${path.basename(page)}: la CSP necesita 'sha256-${hash}'`);
    assert.ok(!scriptSrc.includes('unsafe-inline'), `${path.basename(page)}: sin 'unsafe-inline'`);
  }
});
