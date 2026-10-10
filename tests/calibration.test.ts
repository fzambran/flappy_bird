import { describe, expect, it } from 'vitest';
import { CalibrationSession } from '../src/calibration';
const reading = (timestamp: number, frequencyHz: number | null = 100, rms = .2, confidence = 1) => ({timestamp, frequencyHz, rms, confidence});
function ready() {
  const session = new CalibrationSession(0);
  for (let i=0;i<80;i++) session.ingest(reading(i*25,null,.001,0));
  session.tick(2000);
  return session;
}
function capture(session: CalibrationSession, start: number, hz = 100) {
  for (let i=0;i<=80;i++) session.ingest(reading(start+i*25,hz));
}
describe('calibration capture', () => {
  it('waits for microphone samples and gives unlimited preparation plus two seconds countdown', () => {
    const empty = new CalibrationSession(0); empty.tick(10000); expect(empty.stage).toBe('noise');
    const session = ready(); session.tick(30000); expect(session.stage).toBe('ready-low');
    session.startTone(30000); session.tick(31999); expect(session.stage).toBe('prepare-low');
    session.ingest(reading(31000)); expect(session.low).toHaveLength(0);
    session.tick(32000); expect(session.stage).toBe('low');
    session.tick(90000); expect(session.stage).toBe('low');
  });
  it('requires two actual seconds and reports recognition for both tones', () => {
    const session=ready(); session.startTone(2000); session.tick(4000);
    for(let i=0;i<80;i++) session.ingest(reading(4000+i*25));
    expect(session.feedback).toBe('recognized'); expect(session.stage).toBe('low');
    session.ingest(reading(6000)); expect(session.stage).toBe('ready-high');
    session.startTone(10000); session.tick(12000); capture(session,12000,200);
    expect(session.feedback).toBe('recognized'); expect(session.stage).toBe('complete');
    expect(session.result()).toEqual({lowHz:100,highHz:200,noiseFloor:.003});
  });
  it('does not count silence, unreliable audio or missing frames as voice time', () => {
    const session=ready(); session.startTone(2000); session.tick(4000);
    session.ingest(reading(4000)); session.ingest(reading(4025));
    session.ingest(reading(4050,null,0)); expect(session.feedback).toBe('quiet');
    session.ingest(reading(10000)); session.ingest(reading(10025));
    session.ingest(reading(10050,100,.2,.3)); expect(session.feedback).toBe('unstable');
    session.ingest(reading(20000)); session.ingest(reading(30000));
    expect(session.validSeconds).toBeCloseTo(.05); expect(session.stage).toBe('low');
    expect(()=>session.result()).toThrow('dos segundos');
  });
  it('explains an insufficient high tone and waits until it is recognized', () => {
    const session=ready(); session.startTone(2000); session.tick(4000); capture(session,4000);
    session.startTone(6000); session.tick(8000); capture(session,8000,120);
    expect(session.feedback).toBe('too-low'); expect(session.validSeconds).toBe(0);
    expect(session.high).toHaveLength(0); expect(session.stage).toBe('high');
    capture(session,20000,200); expect(session.result().highHz).toBe(200);
  });
});
