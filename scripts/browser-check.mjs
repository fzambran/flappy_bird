import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const wavPath = path.join(os.tmpdir(), `vuelo-test-${process.pid}.wav`);
const baseUrl = process.env.GAME_URL || 'http://127.0.0.1:5173';
const rate = 48000, seconds = 90;
const buffer = Buffer.alloc(44 + rate * seconds * 2);
buffer.write('RIFF'); buffer.writeUInt32LE(buffer.length - 8, 4);
buffer.write('WAVEfmt ', 8); buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 2, 28);
buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
buffer.write('data', 36); buffer.writeUInt32LE(buffer.length - 44, 40);
for (let i = 0; i < rate * seconds; i++) {
  const t = i / rate;
  const hz = t < 2 ? 0 : t < 12 ? 100 : t < 20 ? 200 : Math.sqrt(20000);
  buffer.writeInt16LE(hz ? Math.round(Math.sin(2 * Math.PI * hz * t) * 6000) : 0, 44 + i * 2);
}
fs.writeFileSync(wavPath, buffer);
let browser, deniedBrowser;
const heading = (page, name) => page.getByRole('heading', { name, exact: true }).waitFor();
const click = (page, name) => page.getByRole('button', { name, exact: true }).first().click();
async function freezeCheck(page) {
  await page.waitForTimeout(200); // Let the throttled telemetry show the paused time.
  const time = await page.locator('#time').textContent();
  await page.waitForTimeout(1100);
  assert.equal(await page.locator('#time').textContent(), time, 'Pause must freeze game time');
}
async function simulateLostTrack(page) {
  // A synthetic ended event verifies the recovery path, not physical unplugging.
  await page.evaluate(() => {
    const track = window.testStreams.at(-1).getAudioTracks()[0];
    track.stop(); track.dispatchEvent(new Event('ended'));
  });
  await heading(page, 'El audio se interrumpió');
}
try {
  browser = await chromium.launch({ headless: true, channel: 'chrome', args: [
    '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
    `--use-file-for-fake-audio-capture=${wavPath}`,
  ] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
  page.setDefaultTimeout(16000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    // Keep obstacle centers at the midpoint to make this recovery test reproducible.
    Math.random = () => 0.5;
    const native = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    window.testStreams = [];
    navigator.mediaDevices.getUserMedia = async (...args) => {
      const stream = await native(...args); window.testStreams.push(stream); return stream;
    };
  });
  await page.goto(baseUrl);
  await click(page, 'Conectar micrófono');
  await heading(page, 'Vamos con el tono grave');
  await page.waitForTimeout(4000);
  await heading(page, 'Vamos con el tono grave');
  await click(page, 'Empezar tono grave');
  await page.getByText(/Tono grave reconocido/).waitFor();
  await page.screenshot({ path: path.join(os.tmpdir(), 'vuelo-calibration.png'), fullPage: true });
  await heading(page, 'Tono grave registrado');
  await click(page, 'Empezar tono agudo');
  await page.getByText(/Tono agudo reconocido/).waitFor();
  await heading(page, 'Tu rango está listo');
  assert.match(await page.locator('#message').textContent(), /100–200 Hz/);
  await click(page, 'Practicar'); await page.waitForFunction(() => Math.abs(parseFloat(document.querySelector('#pitch').textContent) - 141) < 3);
  const pitch = parseFloat(await page.locator('#pitch').textContent());
  assert.ok(Number.isFinite(pitch) && Math.abs(pitch - 141) < 3, 'Detected pitch must be about 141 Hz');
  const level = parseFloat(await page.locator('#level').textContent());
  assert.ok(Number.isFinite(level) && level > -30 && level < -10, 'Signal level must be reported in dBFS');
  console.log(`Calibration 100–200 Hz; detected ${pitch} Hz, ${level} dBFS.`);

  await click(page, 'Comenzar partida'); await page.waitForTimeout(1000);
  assert.equal(await page.locator('#mode').textContent(), 'En vuelo');
  await click(page, 'Pausar'); await heading(page, 'Vuelo en pausa'); await freezeCheck(page);
  await click(page, 'Continuar'); await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(os.tmpdir(), 'vuelo-game.png'), fullPage: true });

  await simulateLostTrack(page); await freezeCheck(page);
  // A background event must not overwrite the only reconnection action.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await heading(page, 'El audio se interrumpió');
  await page.evaluate(() => { delete document.hidden; });
  await click(page, 'Reconectar'); await heading(page, 'Micrófono conectado');
  await click(page, 'Continuar');
  // The new capture starts with the WAV again. The ensuing low tone moves the bird
  // below the first gap and exercises collision through the real audio graph.
  await heading(page, 'Buen vuelo');
  await simulateLostTrack(page);
  await click(page, 'Reconectar'); await heading(page, 'Micrófono conectado');
  await click(page, 'Continuar'); await heading(page, 'Buen vuelo');
  await click(page, 'Volver a jugar'); await page.waitForTimeout(200);
  assert.equal(await page.locator('#score').textContent(), '0 puntos');
  assert.equal(await page.locator('#time').textContent(), '00:00');
  assert.equal(await page.locator('#mode').textContent(), 'En vuelo');
  // Active-game visibility event is simulated separately from actual OS focus.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await heading(page, 'Pestaña en pausa'); await freezeCheck(page);
  await page.evaluate(() => { delete document.hidden; });
  await click(page, 'Continuar');
  await click(page, 'Desconectar micrófono');
  await page.getByRole('button', { name: 'Conectar micrófono', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.testStreams.every(s => s.getTracks().every(t => t.readyState === 'ended'))), true);
  assert.deepEqual(errors, []);
  console.log('Worklet, practice, pause, simulated lost track/visibility, recovery, collision, replay and cleanup passed.');

  const missing = await browser.newPage();
  await missing.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('No device', 'NotFoundError'); };
  });
  await missing.goto(baseUrl); await click(missing, 'Conectar micrófono');
  await heading(missing, 'Necesitamos el micrófono');
  assert.match(await missing.locator('#message').textContent(), /No se encontró un micrófono/);
  await missing.close();
  console.log('Simulated missing-device error passed.');

  deniedBrowser = await chromium.launch({ headless: true, channel: 'chrome' });
  const denied = await deniedBrowser.newPage();
  await denied.goto(baseUrl); await click(denied, 'Conectar micrófono');
  await heading(denied, 'Necesitamos el micrófono');
  assert.match(await denied.locator('#message').textContent(), /permiso.*rechazado/);
  console.log('Permission-denied error passed.');
} finally {
  await browser?.close(); await deniedBrowser?.close(); fs.rmSync(wavPath, { force: true });
}
