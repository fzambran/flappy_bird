import { describe, it, expect } from 'vitest';
import { detectPitch } from '../src/audio/yin';
import { calibrate, normalizePitch, VoiceControl } from '../src/control';
import { Game, WORLD } from '../src/game';
const rate = 48000;
function tone(hz: number, amplitude = 0.2, harmonics = false) { return Float32Array.from({length:2048},(_,i)=>amplitude*(Math.sin(2*Math.PI*hz*i/rate)+(harmonics?0.5*Math.sin(4*Math.PI*hz*i/rate):0))); }
const calibration = {lowHz:100,highHz:400,noiseFloor:0.003};
describe('YIN',()=>{
  for(const hz of [100,200,400]) for(const harmonics of [false,true]) it(`${hz} Hz, harmonics=${harmonics}`,()=>{ const reading=detectPitch(tone(hz,0.2,harmonics),rate); expect(reading.frequencyHz).not.toBeNull(); expect(Math.abs(reading.frequencyHz!-hz)/hz).toBeLessThan(0.03); expect(reading.confidence).toBeGreaterThan(.85); });
  it('rejects silence and deterministic noise',()=>{ expect(detectPitch(new Float32Array(2048),rate).frequencyHz).toBeNull(); let seed=123; const noise=Float32Array.from({length:2048},()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed/2**32-.5)*.2;});expect(detectPitch(noise,rate).frequencyHz).toBeNull(); });
  it('volume does not change pitch',()=>{ expect(Math.abs(detectPitch(tone(200,.05),rate).frequencyHz!-detectPitch(tone(200,.4),rate).frequencyHz!)).toBeLessThan(1); });
});
describe('calibration and control',()=>{
  it('validates sample counts and five semitones',()=>{expect(()=>calibrate([],[],[])).toThrow('muestras');expect(()=>calibrate(Array(80).fill(.001),Array(100).fill(100),Array(100).fill(120))).toThrow('semitonos');expect(calibrate(Array(80).fill(.001),Array(100).fill(100),Array(100).fill(200)).highHz).toBe(200);});
  it('maps logarithmically and clamps',()=>{expect(normalizePitch(100,calibration)).toBe(0);expect(normalizePitch(200,calibration)).toBe(.5);expect(normalizePitch(400,calibration)).toBe(1);expect(normalizePitch(50,calibration)).toBe(0);expect(normalizePitch(800,calibration)).toBe(1);});
  it('holds silence and rejects unreliable readings',()=>{const c=new VoiceControl();c.ingest({frequencyHz:400,confidence:1,rms:.2,timestamp:0},calibration);c.ingest({frequencyHz:null,confidence:0,rms:0,timestamp:25},calibration);c.ingest({frequencyHz:100,confidence:.3,rms:.2,timestamp:50},calibration);expect(c.target).toBe(1);c.update(.12);expect(c.height).toBeCloseTo(.5+.5*(1-Math.exp(-1)));});
  it('suppresses an isolated pitch outlier',()=>{const c=new VoiceControl();[200,200,400,200,200].forEach((frequencyHz,i)=>c.ingest({frequencyHz,confidence:1,rms:.2,timestamp:i*25},calibration));expect(c.target).toBe(.5);});
  it('smoothing is frame rate independent',()=>{const a=new VoiceControl(),b=new VoiceControl();a.target=b.target=1;for(let i=0;i<60;i++)a.update(1/60);for(let i=0;i<120;i++)b.update(1/120);expect(a.height).toBeCloseTo(b.height,10);});
});
describe('game',()=>{
  it('first arrival is at four seconds and counts once',()=>{const g=new Game(()=>.5);for(let i=0;i<239;i++)g.update(1/60,.5);expect(g.obstacles[0].x).toBeGreaterThan(WORLD.birdX+WORLD.radius);g.update(1/60,.5);expect(g.obstacles[0].x).toBeCloseTo(WORLD.birdX+WORLD.radius);for(let i=0;i<60;i++)g.update(1/60,.5);expect(g.score).toBe(1);for(let i=0;i<60;i++)g.update(1/60,.5);expect(g.score).toBe(1);});
  it('collision ends and freezes the simulation; reset clears state',()=>{const g=new Game(()=>.5);for(let i=0;i<260;i++)g.update(1/60,1);expect(g.ended).toBe(true);const time=g.elapsed;g.update(1,.5);expect(g.elapsed).toBe(time);g.reset();expect(g.score).toBe(0);expect(g.elapsed).toBe(0);expect(g.obstacles).toHaveLength(0);expect(g.ended).toBe(false);});
  it('supports a deterministic minute and bounded gap changes',()=>{let seed=42;const g=new Game(()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;});let lastCenter=WORLD.height/2;for(let i=0;i<3600;i++){const imminent=g.obstacles.find(p=>p.x+WORLD.pipeWidth>WORLD.birdX-WORLD.radius);const height=imminent?(WORLD.height-WORLD.margin-imminent.center)/(WORLD.height-2*WORLD.margin):.5;const count=g.obstacles.length;g.update(1/60,height);if(g.obstacles.length>count){const center=g.obstacles.at(-1)!.center;expect(Math.abs(center-lastCenter)).toBeLessThanOrEqual(WORLD.height*.2+1e-6);lastCenter=center;}expect(g.ended).toBe(false);}expect(g.elapsed).toBeCloseTo(60);expect(g.score).toBeGreaterThan(15);});
  it('same speed at 30 and 120 fps',()=>{const a=new Game(()=>.5),b=new Game(()=>.5);for(let i=0;i<60;i++)a.update(1/30,.5);for(let i=0;i<240;i++)b.update(1/120,.5);expect(a.obstacles[0].x).toBeCloseTo(b.obstacles[0].x,8);});
});
