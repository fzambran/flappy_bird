import './style.css';
import { Microphone } from './audio/microphone';
import type { PitchReading } from './audio/yin';
import { VoiceControl, type Calibration } from './control';
import { CalibrationSession, CALIBRATION_SECONDS, type CalibrationStage } from './calibration';
import { Game, WORLD } from './game';

type Mode = 'inicio' | 'calibración' | 'práctica' | 'partida' | 'fin';
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `<main><header><a class="brand" href="./">◉ VUELO VOCAL</a><span class="tag">Un pequeño juego para tu voz</span></header><section class="intro"><div><p class="eyebrow">EL TONO MARCA EL CAMINO</p><h1>Encuentra tu vuelo.</h1><p>Tararea grave para bajar y agudo para subir.<br>Respira cuando quieras: tu altura se mantiene.</p></div><div class="steps"><span>01 · Conecta</span><span>02 · Calibra</span><span>03 · Vuela</span></div></section><section class="play"><div class="topbar"><span id="mode">Preparado para despegar</span><div><span id="time">00:00</span><strong id="score">0 puntos</strong></div></div><div class="stage"><canvas width="960" height="540" aria-label="Juego de vuelo controlado por tono de voz"></canvas><div id="overlay" class="overlay"><div><p class="eyebrow" id="overlay-label">TU VOZ, TUS ALAS</p><h2 id="title">Un vuelo diferente</h2><p id="message">Conecta tu micrófono y encuentra un rango cómodo.<br>No hace falta cantar fuerte.</p><div id="calibration-feedback" hidden><p id="tone-status" role="status"></p><progress id="calibration-progress" max="2" value="0" aria-label="Segundos de tono reconocido"></progress><p id="capture-time"></p></div><div id="actions"></div></div></div></div><div class="telemetry"><div><small>TONO</small><strong id="pitch">— Hz</strong></div><div><small>SEÑAL</small><strong id="signal">Sin micrófono</strong><span id="level" class="level">— dBFS</span></div><div><small>CONFIANZA</small><strong id="confidence">—</strong></div><div class="meter"><small>ALTURA OBJETIVO</small><progress id="height" max="1" value="0.5"></progress></div></div></section><div class="toolbar" id="toolbar"></div><p class="footnote">Audio procesado en tu navegador · Sin grabaciones · Usa un tono sostenido o tarareo</p></main>`;
const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = document.querySelector('canvas')!;
const ctx = canvas.getContext('2d')!;
const mic = new Microphone();
const control = new VoiceControl();
const game = new Game();
let mode: Mode = 'inicio', paused = false, connected = false, busy = false;
let calibration: Calibration | undefined;
let latest: PitchReading = { frequencyHz: null, confidence: 0, rms: 0, timestamp: 0 };
let calibrationSession = new CalibrationSession(performance.now());
let displayedStage: CalibrationStage | undefined;
let validAt = 0;
let devHeight: number | null = null;
function button(label: string, action: () => void | Promise<void>, secondary = false) {
  const b = document.createElement('button'); b.textContent = label; b.className = secondary ? 'secondary' : ''; b.onclick = () => { void action(); }; return b;
}
function show(title: string, message: string, buttons: HTMLButtonElement[] = []) {
  element('calibration-feedback').hidden = true;
  element('overlay').hidden = false; element('title').textContent = title; element('message').textContent = message;
  element('actions').replaceChildren(...buttons);
}
function hide() { element('overlay').hidden = true; }
function toolbar() {
  const buttons: HTMLElement[] = [];
  if (connected && mode !== 'inicio' && mode !== 'calibración') {
    if (mode !== 'fin') buttons.push(button(paused ? 'Continuar' : 'Pausar', () => paused ? resume() : pause('Vuelo en pausa', 'Toma aire. Continúa cuando estés listo.'), true));
    if (mode === 'práctica') buttons.push(button('Comenzar partida', startGame));
    buttons.push(button('Recalibrar', beginCalibration, true));
  }
  if (connected) buttons.push(button('Desconectar micrófono', disconnect, true));
  element('toolbar').replaceChildren(...buttons);
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('debug')) {
    const label = document.createElement('label'); label.textContent = 'Altura de prueba (solo desarrollo) ';
    const input = document.createElement('input'); input.type = 'range'; input.min = '0'; input.max = '1'; input.step = '0.01'; input.value = String(control.height);
    input.oninput = () => { devHeight = Number(input.value); }; label.append(input);
    buttons.push(label); element('toolbar').append(label);
  }
}
function read(reading: PitchReading) {
  latest = reading;
  if (paused) return;
  if (mode === 'calibración') {
    if (calibrationSession.ingest(reading)) validAt = performance.now();
  } else if (calibration && control.ingest(reading, calibration)) validAt = performance.now();
}
function errorText(error: unknown) {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError') return 'El permiso del micrófono fue rechazado. Habilítalo en los permisos del navegador y vuelve a conectar.';
  if (name === 'NotFoundError') return 'No se encontró un micrófono. Conecta uno y vuelve a intentarlo.';
  if (name === 'NotReadableError') return 'No se pudo abrir el micrófono. Revisa si otra aplicación lo está usando.';
  return error instanceof Error ? error.message : 'No se pudo conectar el micrófono.';
}
async function connect() {
  if (busy) return; busy = true;
  show('Conectando…', 'Acepta el permiso de micrófono en el navegador.');
  try { await mic.start(read, lost); connected = true; beginCalibration(); }
  catch (error) { show('Necesitamos el micrófono', errorText(error), [button('Volver a conectar', connect)]); }
  finally { busy = false; }
}
function lost() {
  if (!connected) return;
  paused = true; connected = false; toolbar();
  show('El audio se interrumpió', 'La partida está detenida. Reconecta el micrófono para continuar con tu calibración.', [button('Reconectar', reconnect), button('Volver al inicio', disconnect, true)]);
}
async function reconnect() {
  if (busy) return; busy = true;
  try {
    await mic.start(read, lost); connected = true;
    if (mode === 'calibración' || !calibration) beginCalibration();
    else { paused = true; show('Micrófono conectado', 'Tu calibración se conserva.', [button('Continuar', resume)]); toolbar(); }
  } catch (error) { show('No se pudo reconectar', errorText(error), [button('Reintentar', reconnect)]); }
  finally { busy = false; }
}
async function disconnect() {
  connected = false; await mic.stop(); mode = 'inicio'; paused = false; latest.frequencyHz = null; toolbar();
  show('Un vuelo diferente', 'Conecta tu micrófono y encuentra un rango cómodo. No hace falta cantar fuerte.', [button('Conectar micrófono', connect)]);
}
function beginCalibration() {
  if (!connected) return;
  paused = false; mode = 'calibración'; calibrationSession = new CalibrationSession(performance.now()); displayedStage = undefined; devHeight = null; toolbar();
  renderCalibration(performance.now());
}
function renderCalibration(now: number) {
  const session = calibrationSession;
  const stage = session.stage;
  if (displayedStage !== stage) {
    displayedStage = stage;
    if (stage === 'noise') show('Escucha del ambiente', 'Guarda silencio mientras medimos el ruido del micrófono.');
    else if (stage === 'ready-low') show('Vamos con el tono grave', 'Tómate tu tiempo. Pulsa el botón cuando estés listo para tararear un tono grave cómodo.', [button('Empezar tono grave', () => session.startTone(performance.now()))]);
    else if (stage === 'ready-high') show('Tono grave registrado', `${Math.round(session.lowHz)} Hz. Ahora prepara un tono más agudo. Pulsa el botón cuando estés listo.`, [button('Empezar tono agudo', () => session.startTone(performance.now()))]);
    else if (stage === 'prepare-low' || stage === 'prepare-high') show('Prepárate', 'Tendrás dos segundos para prepararte. Después empieza a tararear, sin forzar la voz.');
    else if (stage === 'low' || stage === 'high') {
      show(stage === 'low' ? 'Tu tono grave cómodo' : 'Tu tono agudo cómodo', 'Acumularemos al menos dos segundos de tono reconocido. Puedes respirar: no hay límite de tiempo.', [button('Volver a empezar', beginCalibration, true)]);
      element('calibration-feedback').hidden = false;
    }
  }
  if (stage === 'noise') element('title').textContent = session.remaining(now) > 0 ? `Escucha del ambiente · ${Math.ceil(session.remaining(now))} s` : 'Esperando señal del micrófono…';
  else if (stage === 'prepare-low' || stage === 'prepare-high') element('title').textContent = `Prepárate para el tono ${stage === 'prepare-low' ? 'grave' : 'agudo'} · ${Math.ceil(session.remaining(now))} s`;
  else if (stage === 'low' || stage === 'high') {
    const tone = stage === 'low' ? 'grave' : 'agudo';
    const feedback = session.feedback;
    element('tone-status').textContent = feedback === 'recognized' ? `Tono ${tone} reconocido · ${Math.round(session.frequencyHz!)} Hz` : feedback === 'too-low' ? 'Este tono todavía es demasiado grave. Prueba uno más agudo, sin forzarte.' : feedback === 'unstable' ? 'Escucho sonido, pero no un tono estable. Prueba un tarareo o una vocal sostenida.' : feedback === 'quiet' ? 'Esperando tu voz… Acércate al micrófono si estás tarareando.' : `Esperando un tono ${tone}…`;
    element('tone-status').dataset.recognized = String(feedback === 'recognized');
    element<HTMLProgressElement>('calibration-progress').value = session.validSeconds;
    element('capture-time').textContent = `${session.validSeconds.toFixed(1)} / ${CALIBRATION_SECONDS.toFixed(1)} s de tono reconocido`;
  }
}
function finishCalibration() {
  try {
    calibration = calibrationSession.result(); control.reset(); mode = 'práctica'; game.reset(); toolbar();
    show('Tu rango está listo', `${Math.round(calibration.lowHz)}–${Math.round(calibration.highHz)} Hz. Prueba subir y bajar antes de jugar.`, [button('Practicar', hide)]);
  } catch (error) { paused = true; show('Repitamos la calibración', errorText(error), [button('Repetir', beginCalibration)]); }
}
function showResult() {
  show('Buen vuelo', `${game.score} puntos en ${Math.floor(game.elapsed)} segundos. Prueba otra vez con el mismo rango.`, [button('Volver a jugar', startGame), button('Practicar', () => { mode = 'práctica'; game.reset(); hide(); toolbar(); }, true)]);
}
function startGame() { if (!calibration || !connected) return; game.reset(); paused = false; mode = 'partida'; devHeight = null; hide(); toolbar(); }
function pause(title: string, message: string) {
  if (!connected || mode === 'inicio' || mode === 'fin') return;
  paused = true; show(title, message, [button(mode === 'calibración' ? 'Repetir calibración' : 'Continuar', mode === 'calibración' ? beginCalibration : resume)]); toolbar();
}
async function resume() {
  if (!connected) return;
  try { await mic.resume(); paused = false; if (mode === 'fin') showResult(); else hide(); toolbar(); }
  catch (error) { lost(); }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) pause('Pestaña en pausa', 'El juego se detuvo mientras estabas en otra pestaña.'); });
window.addEventListener('pagehide', () => { connected = false; void mic.stop(); });
function draw() {
  const {width:w, height:h} = WORLD;
  ctx.clearRect(0,0,w,h);
  const sky = ctx.createLinearGradient(0,0,0,h); sky.addColorStop(0,'#d8f0ef'); sky.addColorStop(1,'#f9f5df'); ctx.fillStyle=sky; ctx.fillRect(0,0,w,h);
  ctx.fillStyle='#fff9';
  for (const [x,y] of [[90,95],[470,68],[790,140]]) { ctx.beginPath(); ctx.ellipse(x,y,70,18,0,0,Math.PI*2); ctx.fill(); }
  ctx.fillStyle='#c1dcd0'; ctx.beginPath(); ctx.moveTo(0,h); for(let x=0;x<=w;x+=20) ctx.lineTo(x, h-75-Math.sin(x/140)*25); ctx.lineTo(w,h); ctx.fill();
  if (mode === 'partida' || mode === 'fin') for (const pipe of game.obstacles) {
    const gap = h * WORLD.gap / 2; ctx.fillStyle='#357c6c'; ctx.fillRect(pipe.x,0,WORLD.pipeWidth,pipe.center-gap); ctx.fillRect(pipe.x,pipe.center+gap,WORLD.pipeWidth,h);
    ctx.fillStyle='#64a48a'; ctx.fillRect(pipe.x+6,0,10,pipe.center-gap); ctx.fillRect(pipe.x+6,pipe.center+gap,10,h);
  }
  if (mode === 'práctica') {
    const targetY = game.birdY(control.target); ctx.strokeStyle='#3d8c7988'; ctx.setLineDash([8,8]); ctx.beginPath(); ctx.moveTo(0,targetY); ctx.lineTo(w,targetY); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle='#356558'; ctx.font='15px system-ui'; ctx.fillText('Altura objetivo',w-150, Math.max(20,targetY-12));
  }
  const y=game.birdY(control.height);
  ctx.save(); ctx.translate(WORLD.birdX,y); ctx.rotate((control.height-control.target)*0.7);
  ctx.fillStyle='#e9a847'; ctx.beginPath(); ctx.ellipse(0,0,22,17,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#ca792f'; ctx.beginPath(); ctx.ellipse(-8,5,11,7,-0.3,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(9,-6,7,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#233b39'; ctx.beginPath(); ctx.arc(11,-6,3,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#df713e'; ctx.beginPath(); ctx.moveTo(19,-1); ctx.lineTo(32,4); ctx.lineTo(19,8); ctx.fill(); ctx.restore();
  ctx.fillStyle='#86b69a'; ctx.fillRect(0,h-9,w,9);
}
let previous = performance.now(), uiAt=0;
function frame(now: number) {
  const dt = Math.min((now-previous)/1000,0.05); previous=now;
  if (!paused) {
    if (mode === 'calibración') {
      calibrationSession.tick(now);
      if (calibrationSession.stage === 'complete') finishCalibration();
      else renderCalibration(now);
    }
    if (mode === 'práctica' || mode === 'partida') {
      if (devHeight !== null) control.target = devHeight;
      control.update(dt);
      if (mode === 'partida') {
        game.update(dt,control.height);
        if (game.ended) { mode='fin'; toolbar(); showResult(); }
      }
    }
  }
  if (now-uiAt > 100) {
    uiAt=now;
    element('pitch').textContent=connected && latest.frequencyHz ? `${Math.round(latest.frequencyHz)} Hz` : '— Hz';
    element('level').textContent = !connected ? '— dBFS' : latest.rms > 0 ? `${(20 * Math.log10(latest.rms)).toFixed(1)} dBFS` : '−∞ dBFS';
    element('confidence').textContent=connected ? `${Math.round(latest.confidence*100)} %` : '—';
    element('signal').textContent=!connected ? 'Sin micrófono' : now-validAt<250 ? 'Tono estable' : latest.rms>0.003 ? 'Buscando tono' : 'Silencio';
    element<HTMLProgressElement>('height').value=control.target;
    element('mode').textContent=paused ? 'En pausa' : ({inicio:'Preparado para despegar',calibración:'Calibrando tu voz',práctica:'Práctica libre',partida:'En vuelo',fin:'Partida terminada'}[mode]);
    element('score').textContent=`${game.score} puntos`;
    const seconds=Math.floor(game.elapsed); element('time').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  }
  draw(); requestAnimationFrame(frame);
}
show('Un vuelo diferente','Conecta tu micrófono y encuentra un rango cómodo. No hace falta cantar fuerte.',[button('Conectar micrófono',connect)]);
requestAnimationFrame(frame);
