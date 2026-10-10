import { detectPitch } from './yin';
declare const sampleRate: number;
declare const currentTime: number;
declare class AudioWorkletProcessor { port: MessagePort }
declare function registerProcessor(name: string, processor: typeof AudioWorkletProcessor): void;
class PitchProcessor extends AudioWorkletProcessor {
  private buffer = new Float32Array(2048);
  private cursor = 0;
  private filled = 0;
  private since = 0;
  process(inputs: Float32Array[][]) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    for (const value of channel) {
      this.buffer[this.cursor] = value;
      this.cursor = (this.cursor + 1) % this.buffer.length;
      this.filled = Math.min(this.filled + 1, this.buffer.length);
    }
    this.since += channel.length;
    if (this.filled === this.buffer.length && this.since >= sampleRate / 40) {
      this.since = 0;
      const frame = new Float32Array(this.buffer.length);
      for (let i = 0; i < frame.length; i++) frame[i] = this.buffer[(this.cursor + i) % frame.length];
      this.port.postMessage(detectPitch(frame, sampleRate, currentTime * 1000));
    }
    return true;
  }
}
registerProcessor('pitch-detector', PitchProcessor);
