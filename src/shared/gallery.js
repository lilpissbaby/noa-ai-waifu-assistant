// Galería de modelos gratis (Ajustes → Skins → Galería). Solo modelos que su autoría deja usar a
// cualquiera y redistribuir, o que se descargan del repositorio de quien tiene los derechos. La
// app no los incluye: los descarga de su origen (GitHub, con el commit fijado) cuando eliges uno, y
// los importa con el editor de siempre, que enseña la licencia antes de guardarlos.
// Miniaturas: assets/gallery/<id>.jpg (las genera tools/automation/gallery.mjs con la propia app).
// La licencia se resume con gallery.license.<license> en las traducciones.

const gh = (repo, sha, file) => `https://raw.githubusercontent.com/${repo}/${sha}/${file.split('/').map(encodeURIComponent).join('/')}`;
const MADJIN = ['madjin/vrm-samples', 'e16eb187100149a315ad92c3c9968f1d5baa6c7d'];
const WEBAVERSE = ['webaverse/avatar-models', '7516201eb94199d805e2394f43e01b3c79782fcd'];
const CUBISM = ['Live2D/CubismWebSamples', 'b1de66b0b1f1cb881d95fb6158622aeb6a2827bd'];
const OLV = ['Open-LLM-VTuber/Open-LLM-VTuber', '992309c0aa19845960228f880013d4685fde93b5'];
const VROID_LICENSE = 'https://vroid.pixiv.help/hc/en-us/articles/4402614652569';
const LIVE2D_LICENSE = 'https://www.live2d.com/eula/live2d-free-material-license-agreement_en.html';
const VRM_LICENSE = 'https://vrm.dev/licenses/1.0/';

const vroid = (id, name, file, license = 'cc0') => ({
  id,
  name,
  kind: 'vrm',
  url: gh(...MADJIN, file),
  author: 'pixiv (VRoid Studio)',
  license,
  licenseUrl: VROID_LICENSE,
  source: 'https://github.com/madjin/vrm-samples',
  tags: ['vroid'],
});
const hub = (id, name, model, author, license, credit = false) => ({
  id,
  name,
  kind: 'vrm',
  url: gh(...WEBAVERSE, `model${model}.vrm`),
  author,
  license,
  credit,
  source: 'https://github.com/webaverse/avatar-models',
  tags: ['vroid-hub'],
});
const live2d = (id, name, [repo, sha], file, author = 'Live2D Inc.') => ({
  id,
  name,
  kind: 'live2d',
  model: gh(repo, sha, file),
  author,
  license: 'live2dFree',
  licenseUrl: LIVE2D_LICENSE,
  source: `https://github.com/${repo}`,
  tags: ['live2d'],
});

export const GALLERY = [
  // ---------------------------------------------------------------- VRM (3D)
  vroid('vroid-sample-a', 'AvatarSample A', 'vroid/stable/AvatarSample_A.vrm', 'vroidSample'),
  vroid('vroid-sample-b', 'AvatarSample B', 'vroid/stable/AvatarSample_B.vrm', 'vroidSample'),
  vroid('vroid-shino', 'Sendagaya Shino', 'vroid/beta/Sendagaya_Shino.vrm'),
  vroid('vroid-shibu', 'Sendagaya Shibu', 'vroid/beta/Sendagaya_Shibu.vrm'),
  vroid('vroid-darkness-shibu', 'Darkness Shibu', 'vroid/beta/Darkness_Shibu.vrm'),
  vroid('vroid-victoria', 'Victoria Rubin', 'vroid/beta/Victoria_Rubin.vrm'),
  vroid('vroid-vita', 'Vita', 'vroid/beta/Vita.vrm'),
  vroid('vroid-vivi', 'Vivi', 'vroid/beta/Vivi.vrm'),
  vroid('vroid-hair-female', 'HairSample Female', 'vroid/beta/HairSample_Female.vrm'),
  {
    id: 'alicia-solid',
    name: 'Alicia Solid',
    kind: 'vrm',
    url: gh('vrm-c/UniVRM', 'efd20f62f1bf0ac3fcc34de1e497324c5197d146', 'Tests/Models/Alicia_vrm-0.51/AliciaSolid_vrm-0.51.vrm'),
    author: 'DWANGO Co., Ltd.',
    license: 'alicia',
    licenseUrl: 'https://3d.nicovideo.jp/alicia/rule.html',
    source: 'https://github.com/vrm-c/UniVRM',
    tags: ['official'],
  },
  {
    id: 'seed-san',
    name: 'Seed-san',
    kind: 'vrm',
    url: gh('vrm-c/vrm-specification', '94e82dd346fa6cf0337c4421728640e5252dd38e', 'samples/Seed-san/vrm/Seed-san.vrm'),
    author: 'VirtualCast, Inc.',
    license: 'vrmPublic',
    licenseUrl: VRM_LICENSE,
    credit: true,
    source: 'https://github.com/vrm-c/vrm-specification',
    tags: ['official'],
  },
  {
    id: 'three-vrm-girl',
    name: 'three-vrm girl',
    kind: 'vrm',
    url: gh('pixiv/three-vrm', 'v0.6.11', 'packages/three-vrm/examples/models/three-vrm-girl.vrm'),
    author: 'pixiv Inc.',
    license: 'vroidHubCommercial',
    source: 'https://github.com/pixiv/three-vrm',
    tags: ['official'],
  },
  {
    id: 'godette',
    name: 'Godette (low-poly)',
    kind: 'vrm',
    url: gh('V-Sekai/godot-vrm', 'e15199f980064028bfa4fbee5e70dddb82dd55c3', 'vrm_samples/Godette_vrm_v4.vrm'),
    author: 'SirRichard94 · Lyuma',
    license: 'ccby',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
    credit: true,
    source: 'https://github.com/V-Sekai/godot-vrm',
    tags: ['low-poly'],
  },
  {
    id: 'neko-sister',
    name: 'N.E.K.O Sister',
    kind: 'vrm',
    url: gh('Project-N-E-K-O/N.E.K.O', 'd4dd5b5c818320e0bfeb2c614ca03cd3e83246f9', 'static/vrm/sister1.0.vrm'),
    author: '八黑山',
    license: 'vrmPublic',
    licenseUrl: VRM_LICENSE,
    source: 'https://github.com/Project-N-E-K-O/N.E.K.O',
    tags: [],
  },
  hub('holo', 'Holo', 39, 'H. NOMATA', 'vroidHubNc'),
  hub('miku-ls', 'Hatsune Miku (LS)', 17, 'lente · illuminance', 'vroidHubNc'),
  hub('miku-kasumi', 'Hatsune Miku (Kasumi)', 48, 'Kasumi', 'vroidHubCommercial'),
  hub('ruike', 'Ruike', 41, 'quappa-el', 'vroidHubCommercial', true),
  // ---------------------------------------------------------------- Live2D (VTuber)
  live2d('live2d-hiyori', 'Hiyori Momose', CUBISM, 'Samples/Resources/Hiyori/Hiyori.model3.json'),
  live2d('live2d-haru', 'Haru', CUBISM, 'Samples/Resources/Haru/Haru.model3.json'),
  live2d('live2d-mao', 'Mao Niziiro', CUBISM, 'Samples/Resources/Mao/Mao.model3.json'),
  live2d('live2d-rice', 'Rice Glassfield', CUBISM, 'Samples/Resources/Rice/Rice.model3.json'),
  live2d('live2d-mao-pro', 'Mao (4K)', OLV, 'live2d-models/mao_pro/runtime/mao_pro.model3.json'),
  live2d('live2d-shizuku', 'Shizuku', OLV, 'live2d-models/shizuku/runtime/shizuku.model3.json'),
  live2d('live2d-hibiki', 'Hibiki', ['Ikaros-521/AI-Vtuber', '0030024ec66ceb5ffa409b98cad4bb2716a804b8'], 'Live2D/live2d-model/hibiki/hibiki.model3.json'),
  live2d('live2d-feiniu', 'Hiyori · Feiniu', ['morettt/my-neuro', 'a31df91b9b2d5b077e3834d43fd516babd0662d8'], 'live-2d/2D/肥牛/feiniu.model3.json', 'Live2D Inc. · my-neuro'),
];

export const galleryItem = (id) => GALLERY.find((g) => g.id === id) || null;
export const galleryThumb = (id) => `app://local/bundle/assets/gallery/${id}.jpg`;
