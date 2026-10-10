import type { PitchReading } from './audio/yin';
import { calibrate, median, type Calibration } from './control';

export type CalibrationStage = 'noise' | 'ready-low' | 'prepare-low' | 'low' | 'ready-high' | 'prepare-high' | 'high' | 'complete';
export type ToneFeedback = 'waiting' | 'recognized' | 'quiet' | 'unstable' | 'too-low';
export const CALIBRATION_SECONDS = 2;

/** Preparation time and silence never consume the time needed to recognize a tone. */
export class CalibrationSession {
  stage: CalibrationStage = 'noise';
  feedback: ToneFeedback = 'waiting';
  validSeconds = 0;
  frequencyHz: number | null = null;
  noise: number[] = [];
  low: number[] = [];
  high: number[] = [];
  private startedAt: number;
  private previousValidTimestamp: number | null = null;

  constructor(now: number) { this.startedAt = now; }
  get lowHz() { return median(this.low); }
  get noiseFloor() { return Math.max(0.003, median(this.noise) * 3); }
  remaining(now: number) { return Math.max(0, CALIBRATION_SECONDS - (now - this.startedAt) / 1000); }

  startTone(now: number) {
    if (this.stage !== 'ready-low' && this.stage !== 'ready-high') return;
    this.stage = this.stage === 'ready-low' ? 'prepare-low' : 'prepare-high';
    this.startedAt = now;
    this.validSeconds = 0;
    this.previousValidTimestamp = null;
    this.frequencyHz = null;
    this.feedback = 'waiting';
  }

  tick(now: number) {
    if (this.stage === 'noise' && this.remaining(now) === 0 && this.noise.length >= 20) this.stage = 'ready-low';
    else if ((this.stage === 'prepare-low' || this.stage === 'prepare-high') && this.remaining(now) === 0) {
      this.stage = this.stage === 'prepare-low' ? 'low' : 'high';
    }
  }

  ingest(reading: PitchReading) {
    if (this.stage === 'noise') { if (Number.isFinite(reading.rms)) this.noise.push(reading.rms); return false; }
    if (this.stage !== 'low' && this.stage !== 'high') return false;
    const hz = reading.frequencyHz;
    let rejected: ToneFeedback | null = null;
    if (!Number.isFinite(reading.rms) || reading.rms < this.noiseFloor) rejected = 'quiet';
    else if (hz === null || !Number.isFinite(hz) || hz <= 0 || !Number.isFinite(reading.timestamp) || !Number.isFinite(reading.confidence) || reading.confidence < 0.85) rejected = 'unstable';
    else if (this.stage === 'high' && hz < this.lowHz * 2 ** (5 / 12)) rejected = 'too-low';
    if (rejected) {
      this.feedback = rejected; this.frequencyHz = null; this.previousValidTimestamp = null;
      return false;
    }
    this.feedback = 'recognized'; this.frequencyHz = hz;
    if (this.previousValidTimestamp !== null) {
      const delta = reading.timestamp - this.previousValidTimestamp;
      // Missing or delayed frames must not count silence as recognized voice.
      if (delta > 0 && delta <= 100) this.validSeconds += delta / 1000;
    }
    this.previousValidTimestamp = reading.timestamp;
    const samples = this.stage === 'low' ? this.low : this.high;
    samples.push(hz!);
    if (this.validSeconds + 1e-9 >= CALIBRATION_SECONDS && samples.length >= 30) {
      this.validSeconds = CALIBRATION_SECONDS;
      this.stage = this.stage === 'low' ? 'ready-high' : 'complete';
    }
    return true;
  }

  result(): Calibration {
    if (this.stage !== 'complete') throw new Error('Todavía necesitamos dos segundos de cada tono reconocido.');
    return calibrate(this.noise, this.low, this.high);
  }
}
