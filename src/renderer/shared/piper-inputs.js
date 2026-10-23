// Entradas del modelo ONNX de Piper a partir de los phoneme_ids que da piper_phonemize. Puro.

// rate > 1 habla más deprisa (length_scale más pequeño). speaker solo cuenta si hay varios hablantes.
export function piperInputs(ids, config, { rate = 1, speaker = 0 } = {}) {
  const inf = config.inference || {};
  const multi = (config.num_speakers || 0) > 1 || Object.keys(config.speaker_id_map || {}).length > 1;
  const nSpk = Math.max(config.num_speakers || 0, Object.keys(config.speaker_id_map || {}).length);
  const spk = Number.isInteger(speaker) && speaker >= 0 && speaker < nSpk ? speaker : 0;
  return {
    input: BigInt64Array.from(ids, (x) => BigInt(x)),
    input_lengths: BigInt64Array.from([BigInt(ids.length)]),
    scales: Float32Array.from([inf.noise_scale ?? 0.667, (inf.length_scale ?? 1) / (rate > 0 ? rate : 1), inf.noise_w ?? 0.8]),
    sid: multi ? BigInt64Array.from([BigInt(spk)]) : null,
  };
}

// Cada línea que imprime piper_phonemize es un JSON con los phoneme_ids de una frase.
export function parsePhonemizeOutput(lines) {
  const out = [];
  for (const line of lines) {
    try {
      const ids = JSON.parse(line)?.phoneme_ids;
      if (Array.isArray(ids) && ids.length) out.push(ids);
    } catch {
      /* línea que no es JSON */
    }
  }
  return out;
}
