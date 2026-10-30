#!/usr/bin/env node
// Genera docs/modelos.md: los modelos gratis de la galería de la app y los que solo se ven en la
// imagen del README, con autoría, licencia y origen. node tools/gen-models-doc.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ALL_MODELS } from './gallery-models.mjs';
import { tIn } from '../src/shared/i18n/index.js';

const OUT = path.resolve(import.meta.dirname, '..', 'docs', 'modelos.md');
const kind = (m) => (m.kind === 'vrm' ? '3D · VRM' : 'VTuber · Live2D');
const license = (m) => (m.inGallery ? tIn('es', `gallery.license.${m.license}`) + (m.credit ? ' · pide crédito' : '') : m.license);
const link = (m) => `[${m.source.replace('https://github.com/', '')}](${m.source})`;
const row = (m) => `| ${m.inGallery ? `<img src="../assets/gallery/${m.id}.jpg" width="72" alt="">` : ''} | **${m.name}** | ${kind(m)} | ${m.author || '—'} | ${license(m)} | ${link(m)} |`;
const gallery = ALL_MODELS.filter((m) => m.inGallery);
const extra = ALL_MODELS.filter((m) => !m.inGallery);
const lines = [
  '# Modelos gratis',
  '',
  '> Generado con `node tools/gen-models-doc.mjs`. Las miniaturas y la imagen de abajo las saca `tools/automation/gallery.mjs` con la propia app.',
  '',
  `![Los ${ALL_MODELS.length} modelos](screenshots/models.jpg)`,
  '',
  `## En la galería de la app (${gallery.length})`,
  '',
  'Ajustes → Skins → **Galería de modelos gratis** (o clic derecho en la waifu → Skin → Galería). Al pulsar **Usar**, la app descarga el modelo de su repositorio original (con el commit fijado, para que no cambie) y lo abre en el editor 3D o VTuber, que enseña su licencia antes de guardarlo. La app no lleva ningún modelo dentro.',
  '',
  'Solo están los que su autoría deja usar a cualquiera **y redistribuir**, o que se bajan del repositorio de quien tiene los derechos. Los Live2D necesitan el Cubism Core (la app lo descarga la primera vez, con su licencia).',
  '',
  '| | Modelo | Tipo | Autoría | Licencia | Origen |',
  '| --- | --- | --- | --- | --- | --- |',
  ...gallery.map(row),
  '',
  `## Solo en la imagen (${extra.length})`,
  '',
  'Modelos gratuitos que se pueden usar como avatar pero cuya licencia **no deja redistribuirlos**, así que la app no los ofrece. Si quieres usar alguno, búscalo en su origen (VRoid Hub, el repositorio indicado) y respeta sus condiciones.',
  '',
  '| | Modelo | Tipo | Autoría | Licencia | Origen |',
  '| --- | --- | --- | --- | --- | --- |',
  ...extra.map(row),
  '',
  '## Resumen de licencias',
  '',
  '- **CC0**: dominio público, sin condiciones.',
  '- **Muestras de VRoid** (AvatarSample A y B): uso libre según las [condiciones de VRoid](https://vroid.pixiv.help/hc/en-us/articles/4402614652569).',
  '- **VRM Public License 1.0** ([texto](https://vrm.dev/licenses/1.0/)): lo que declare cada modelo en su ficha (el editor de la app lo enseña).',
  '- **Alicia Solid**: [condiciones de DWANGO](https://3d.nicovideo.jp/alicia/rule.html); nada de uso sexual ni violento.',
  '- **CC BY 3.0** (Godette): hay que citar la autoría.',
  '- **VRoid Hub**: cada modelo dice si permite uso comercial, modificarlo, redistribuirlo y si pide crédito.',
  '- **Live2D Free Material License** ([texto](https://www.live2d.com/eula/live2d-free-material-license-agreement_en.html)): uso libre para particulares y empresas pequeñas; Shizuku hay que usarla con su nombre y personalidad.',
  '',
  '## Más modelos sin crear cuenta',
  '',
  '- [Muestras oficiales de Live2D](https://www.live2d.com/en/learn/sample/): Miara, Tsumiki, Izumi, Koharu, Epsilon, Kei… (Download tras aceptar la licencia). El .zip se importa tal cual.',
  '- [Modelos VRoid CC0 en OpenGameArt](https://opengameart.org/content/vroid-studio-cc0-models).',
  '- itch.io: en los de «name your own price», **Download Now → No thanks, just take me to the downloads**. Por ejemplo [式神 COLLECTION](https://karindou.itch.io/vroid) (4 VRM CC0), [Alice Chan](https://yuna0x0.itch.io/alice-chan) (CC BY-SA), [Kotori](https://fox-jump.itch.io/kotori-anime-character) y [Kaya](https://fox-jump.itch.io/kaya-anime-character).',
  '- Hazte la tuya gratis con [VRoid Studio](https://vroid.com/studio) y expórtala a VRM.',
  '- Con cuenta: [VRoid Hub](https://hub.vroid.com), [Booth](https://booth.pm) y [nizima](https://nizima.com) tienen muchos más.',
  '',
  'No valen los modelos de Cubism 2 (`model.json` + `.moc`) ni los exportados para Cubism 5.3. Evita los repositorios con cientos de modelos «Live2D» sacados de juegos: no tienen licencia.',
  '',
];
fs.writeFileSync(OUT, lines.join('\n'));
console.log(`✓ ${ALL_MODELS.length} modelos en ${path.relative(process.cwd(), OUT)}`);
