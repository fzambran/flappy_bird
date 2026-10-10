import processorUrl from './processor.ts?worker&url';
import type { PitchReading } from './yin';
export class Microphone {
  private context?: AudioContext;
  private stream?: MediaStream;
  private node?: AudioWorkletNode;
  async start(onReading: (reading: PitchReading) => void, onLost: () => void) {
    await this.stop();
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Abre el juego en localhost o HTTPS para acceder al micrófono.');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
      this.context = new AudioContext({ latencyHint: 'interactive' });
      await this.context.audioWorklet.addModule(processorUrl);
      this.node = new AudioWorkletNode(this.context, 'pitch-detector');
      this.node.port.onmessage = event => onReading(event.data);
      this.context.createMediaStreamSource(this.stream).connect(this.node);
      // The processor outputs silence; connecting keeps the graph running without monitoring the mic.
      this.node.connect(this.context.destination);
      this.stream.getAudioTracks().forEach(track => track.addEventListener('ended', onLost));
      this.context.onstatechange = () => { if (this.context?.state === 'suspended') onLost(); };
      await this.context.resume();
    } catch (error) { await this.stop(); throw error; }
  }
  async resume() { await this.context?.resume(); }
  async stop() {
    if (this.node) { this.node.port.onmessage = null; this.node.port.close(); this.node.disconnect(); }
    this.stream?.getTracks().forEach(track => track.stop());
    if (this.context) { this.context.onstatechange = null; await this.context.close(); }
    this.node = undefined; this.stream = undefined; this.context = undefined;
  }
}
