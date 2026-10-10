import type { PitchReading } from './audio/yin';
export const median = (values: number[]) => { const s = [...values].sort((a,b) => a-b); return s.length ? (s[Math.floor((s.length-1)/2)] + s[Math.floor(s.length/2)]) / 2 : 0; };
export interface Calibration { lowHz: number; highHz: number; noiseFloor: number }
export function calibrate(noise: number[], low: number[], high: number[]): Calibration {
  if (noise.length < 20 || low.length < 30 || high.length < 30) throw new Error('Faltan muestras fiables. Acércate al micrófono y sostén cada tono sin hablar.');
  const lowHz = median(low), highHz = median(high);
  if (12 * Math.log2(highHz / lowHz) < 5) throw new Error('El tono agudo debe superar al grave por al menos cinco semitonos. Repite con un rango cómodo más amplio.');
  return { lowHz, highHz, noiseFloor: Math.max(0.003, median(noise) * 3) };
}
export function normalizePitch(hz: number, calibration: Calibration) {
  return Math.max(0, Math.min(1, Math.log(hz / calibration.lowHz) / Math.log(calibration.highHz / calibration.lowHz)));
}
export class VoiceControl {
  target = 0.5;
  height = 0.5;
  private history: number[] = [];
  private lastValid = -Infinity;
  reset() { this.target = this.height = 0.5; this.history = []; this.lastValid = -Infinity; }
  ingest(reading: PitchReading, calibration: Calibration) {
    if (reading.frequencyHz === null || reading.confidence < 0.85 || reading.rms < calibration.noiseFloor) return false;
    if (reading.timestamp - this.lastValid > 250) this.history = [];
    this.lastValid = reading.timestamp;
    this.history.push(reading.frequencyHz);
    if (this.history.length > 5) this.history.shift();
    this.target = normalizePitch(median(this.history), calibration);
    return true;
  }
  update(dt: number) { this.height += (this.target - this.height) * (1 - Math.exp(-dt / 0.12)); }
}
