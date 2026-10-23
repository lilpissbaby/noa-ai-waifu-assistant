// Emociones de la asistente → expresiones del modelo, adivinadas por el nombre (inglés y japonés).
const PATTERNS = {
  happy: /happy|smile|joy|笑|喜|嬉/i,
  angry: /angry|anger|mad|怒/i,
  sad: /sad|cry|tear|泣|悲/i,
  surprised: /surpris|shock|驚/i,
  relaxed: /relax|calm|blush|照/i,
};

export function autoAssignExpressions(names) {
  const out = {};
  for (const [emotion, re] of Object.entries(PATTERNS)) {
    const hit = (names || []).find((n) => re.test(String(n)));
    if (hit) out[emotion] = hit;
  }
  return out;
}
