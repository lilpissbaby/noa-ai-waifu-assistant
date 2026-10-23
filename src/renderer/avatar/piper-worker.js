// Síntesis de voz Piper en un Worker: piper_phonemize (espeak-ng en WebAssembly) convierte el texto
// en phoneme_ids y onnxruntime-web ejecuta la voz. Devuelve un WAV.
import { piperInputs, parsePhonemizeOutput } from '../shared/piper-inputs.js';
import { encodeWav } from '../shared/wav.js';

const ORT_BASE = '/bundle/node_modules/onnxruntime-web/dist/';
let ortP = null;
let phonemizerP = null;
const voices = new Map(); // modelUrl -> Promise<{ session, config }>

function loadOrt() {
  ortP ||= import(`${ORT_BASE}ort.wasm.min.mjs`).then((ort) => {
    ort.env.wasm.wasmPaths = ORT_BASE;
    ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.max(1, Math.min(2, (navigator.hardwareConcurrency || 2) - 1)) : 1;
    return ort;
  });
  return ortP;
}

// El fonemizador es un módulo Emscripten clásico: se envuelve como módulo ES desde un Blob.
function loadPhonemizer(runtimeUrl) {
  phonemizerP ||= (async () => {
    const src = await (await fetch(`${runtimeUrl}piper_phonemize.js`)).text();
    const url = URL.createObjectURL(new Blob([`${src}\nexport default createPiperPhonemize;`], { type: 'text/javascript' }));
    const create = (await import(url)).default;
    let sink = [];
    const mod = await create({
      print: (line) => sink.push(line),
      printErr: () => {},
      locateFile: (f) => `${runtimeUrl}${f}`,
    });
    return {
      run(voice, text) {
        sink = [];
        mod.callMain(['-l', voice, '--input', JSON.stringify([{ text }]), '--espeak_data', '/espeak-ng-data']);
        return parsePhonemizeOutput(sink);
      },
    };
  })();
  return phonemizerP;
}

function loadVoice(modelUrl, configUrl) {
  if (!voices.has(modelUrl)) {
    voices.set(
      modelUrl,
      (async () => {
        const ort = await loadOrt();
        const config = await (await fetch(configUrl)).json();
        const model = await (await fetch(modelUrl)).arrayBuffer();
        const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
        return { ort, session, config };
      })().catch((e) => {
        voices.delete(modelUrl);
        throw e;
      }),
    );
  }
  return voices.get(modelUrl);
}

async function synth({ text, runtimeUrl, voice }) {
  const [{ ort, session, config }, phon] = await Promise.all([loadVoice(voice.modelUrl, voice.configUrl), loadPhonemizer(runtimeUrl)]);
  const groups = phon.run(config.espeak?.voice || 'en-us', text);
  const rate = config.audio?.sample_rate || 22050;
  const gap = new Float32Array(Math.round(rate * 0.12));
  const parts = [];
  for (const ids of groups) {
    const x = piperInputs(ids, config, { rate: voice.rate || 1, speaker: voice.speaker || 0 });
    const feeds = {
      input: new ort.Tensor('int64', x.input, [1, ids.length]),
      input_lengths: new ort.Tensor('int64', x.input_lengths, [1]),
      scales: new ort.Tensor('float32', x.scales, [3]),
    };
    if (x.sid) feeds.sid = new ort.Tensor('int64', x.sid, [1]);
    const out = await session.run(feeds);
    parts.push(out.output.data, gap);
  }
  const total = parts.reduce((n, p) => n + p.length, 0);
  const pcm = new Float32Array(total);
  let o = 0;
  for (const p of parts) {
    pcm.set(p, o);
    o += p.length;
  }
  return encodeWav(pcm, rate);
}

self.onmessage = async ({ data }) => {
  try {
    const wav = await synth(data);
    self.postMessage({ id: data.id, wav }, [wav]);
  } catch (e) {
    self.postMessage({ id: data.id, error: String(e?.message || e) });
  }
};
