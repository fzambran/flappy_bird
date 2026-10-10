import { it, expect } from 'vitest';
import { detectPitch } from '../src/audio/yin';
import { VoiceControl } from '../src/control';
import { Game, WORLD } from '../src/game';

it('flies for a minute through YIN and smoothed pitch control with seeded obstacles and breathing gaps', () => {
  let seed = 42;
  const game = new Game(() => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; });
  const control = new VoiceControl();
  const calibration = { lowHz: 100, highHz: 400, noiseFloor: 0.003 };
  const sampleRate = 48000, dt = 0.025;
  let lastPitch = 200, movements = 0;
  for (let frame = 0; frame < 2400; frame++) {
    const imminent = game.obstacles.find(p => p.x + WORLD.pipeWidth >= WORLD.birdX - WORLD.radius);
    const target = imminent ? (WORLD.height - WORLD.margin - imminent.center) / (WORLD.height - 2 * WORLD.margin) : 0.5;
    const frequency = calibration.lowHz * (calibration.highHz / calibration.lowHz) ** target;
    if (Math.abs(frequency - lastPitch) > 5) { movements++; lastPitch = frequency; }
    // Brief breathing after each crossing: silence must preserve the last target.
    const breathing = frame % 120 >= 100 && frame % 120 < 108;
    const samples = Float32Array.from({ length: 2048 }, (_, i) => breathing ? 0 :
      0.15 * Math.sin(2 * Math.PI * frequency * i / sampleRate) +
      0.03 * Math.sin(4 * Math.PI * frequency * i / sampleRate));
    const reading = detectPitch(samples, sampleRate, frame * dt * 1000);
    const before = control.target;
    control.ingest(reading, calibration);
    if (breathing) expect(control.target).toBe(before);
    control.update(dt);
    game.update(dt, control.height);
    expect(game.ended).toBe(false);
  }
  expect(game.elapsed).toBeCloseTo(60);
  expect(game.score).toBeGreaterThan(15);
  expect(movements).toBeGreaterThan(10);
}, 20000);
