export interface PitchReading { frequencyHz: number | null; confidence: number; rms: number; timestamp: number }
/** YIN: normalized difference, first reliable local minimum, parabolic refinement. */
export function detectPitch(samples: Float32Array, sampleRate: number, timestamp = 0): PitchReading {
  let energy = 0;
  for (const x of samples) energy += x * x;
  const rms = Math.sqrt(energy / samples.length);
  const invalid = { frequencyHz: null, confidence: 0, rms, timestamp };
  if (rms < 0.003) return invalid;
  const minLag = Math.floor(sampleRate / 1000);
  const maxLag = Math.min(Math.floor(sampleRate / 65), Math.floor(samples.length / 2) - 1);
  const differences = new Float32Array(maxLag + 1);
  const window = samples.length - maxLag;
  for (let lag = 1; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < window; i++) { const d = samples[i] - samples[i + lag]; sum += d * d; }
    differences[lag] = sum;
  }
  let sum = 0;
  differences[0] = 1;
  for (let lag = 1; lag <= maxLag; lag++) {
    sum += differences[lag];
    differences[lag] = sum ? differences[lag] * lag / sum : 1;
  }
  for (let lag = minLag; lag < maxLag; lag++) {
    if (differences[lag] >= 0.15) continue;
    while (lag + 1 < maxLag && differences[lag + 1] < differences[lag]) lag++;
    const a = differences[lag - 1], b = differences[lag], c = differences[lag + 1];
    const denominator = a - 2 * b + c;
    const refined = lag + (denominator ? (a - c) / (2 * denominator) : 0);
    return { frequencyHz: sampleRate / refined, confidence: 1 - b, rms, timestamp };
  }
  return invalid;
}
