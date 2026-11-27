// Petir Courier — main loop and state machine.
// Fixed timestep 60 Hz (accumulator, 250 ms cap); DPR-scaled canvas;
// terrain pre-rendered once; particles pooled; audio synthesized.
import { WORLD, RUNWAYS } from './config.js';
import { mulberry32 } from './random.js';
import { buildTerrainCanvas, makeClouds, updateClouds, makeRain, terrainHeightAt } from './world.js';
import { makePlane, updatePlane, autopilotInput } from './plane.js';
import { makeInput, attachInput, readActions, wasPressed, consumePressed, ACTIONS } from './input.js';
import { makeAudio, ensureAudio, updateEngineSound, playRing, playPickup, playLand, playCrash, playWarn, setMuted } from './audio.js';
import { makeParticles, burst, updateParticles, makeFloatTexts, spawnFloatText, updateFloatTexts } from './particles.js';
import { makeMissionState, currentMission, currentObjective, updateMission, startMission, missionDone } from './missions.js';
import { render } from './render.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function setupCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = WORLD.viewWidth * dpr;
  canvas.height = WORLD.viewHeight * dpr;
  canvas.style.width = `${WORLD.viewWidth}px`;
  canvas.style.height = `${WORLD.viewHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

setupCanvas();
window.addEventListener('resize', setupCanvas);

const rng = mulberry32(WORLD.seed);
const G = {
  terrain: buildTerrainCanvas(),
  clouds: makeClouds(14, rng),
  rain: makeRain(90),
  plane: makePlane(720, 2090, 0),
  ms: makeMissionState(),
  fx: makeParticles(),
  ft: makeFloatTexts(),
  audio: makeAudio(),
  input: makeInput(),
  state: 'title', // title | flying | map | paused | crashed | missionComplete | gameComplete
  time: 0,
  shake: 0,
  groundHeight: 0,
  autopilotTarget: 0,
  muted: false,
  shot: null,
  frozen: false, // screenshot staging: pose holds, clouds still drift
};

attachInput(G.input, canvas);
window.__game = G; // exposed for the screenshot harness

// Title-screen autopilot: lazy circuit around the home island.
const DEMO_WAYPOINTS = [
  { x: 1500, y: 900 }, { x: 2600, y: 1800 }, { x: 1850, y: 2250 }, { x: 700, y: 1900 },
];

function updateTitle(dt) {
  const wp = DEMO_WAYPOINTS[G.autopilotTarget];
  const input = autopilotInput(G.plane, wp.x, wp.y, 1500, 0.62);
  updatePlane(G.plane, input, dt, false);
  if (Math.hypot(wp.x - G.plane.x, wp.y - G.plane.y) < 260) {
    G.autopilotTarget = (G.autopilotTarget + 1) % DEMO_WAYPOINTS.length;
  }
}

function handleMissionEvents(events) {
  for (const ev of events) {
    if (ev === 'ring') {
      playRing(G.audio);
      burst(G.fx, G.plane.x, G.plane.y, 26, ['#ffd23e', '#fff3c4', '#ff9d00'], 260, 0.9, 3.5);
      spawnFloatText(G.ft, G.plane.x, G.plane.y - 40, '+150', '#ffd23e');
      G.shake = Math.max(G.shake, 3);
    } else if (ev === 'takeoff' || ev === 'flyto') {
      playPickup(G.audio);
      burst(G.fx, G.plane.x, G.plane.y, 18, ['#7dff5e', '#d8ffd0'], 200, 0.8, 3);
    } else if (ev === 'refuel') {
      playPickup(G.audio);
      spawnFloatText(G.ft, G.plane.x, G.plane.y - 40, 'MENGISI...', '#ffb52e');
    } else if (ev === 'refueled') {
      playPickup(G.audio);
      burst(G.fx, G.plane.x, G.plane.y, 20, ['#ffb52e', '#ffe9b0'], 220, 0.8, 3);
    } else if (ev === 'landed') {
      playLand(G.audio);
      burst(G.fx, G.plane.x, G.plane.y, 14, ['#d8e6f5', '#ffffff'], 120, 0.7, 3);
      G.shake = Math.max(G.shake, 2);
    } else if (ev === 'crash') {
      crashNow();
    }
  }
}

function crashNow() {
  if (G.state === 'crashed') return;
  G.state = 'crashed';
  playCrash(G.audio);
  burst(G.fx, G.plane.x, G.plane.y, 60, ['#ff5a4e', '#ffb52e', '#3a3f46', '#ffffff'], 380, 1.4, 5);
  G.shake = 14;
}

function updateFlying(dt) {
  const actions = readActions(G.input);
  const storm = G.ms.index === 2;
  updatePlane(G.plane, actions, dt, storm);
  G.groundHeight = terrainHeightAt(G.plane.x, G.plane.y);

  // Stall warning beep, throttled.
  if (G.plane.speed < 95 && G.plane.altitude > 60 && Math.floor(G.time * 2) % 2 === 0) playWarn(G.audio);

  const events = updateMission(G.ms, G.plane, G.fx, null, null);
  handleMissionEvents(events);

  if (G.plane.crashed && G.state === 'flying') crashNow();
  if (G.ms.completed && G.state === 'flying') {
    if (G.ms.index >= 2) {
      G.state = 'gameComplete';
    } else {
      G.state = 'missionComplete';
    }
  }
  // Fuel-station trickle: parked over a depot on the ground refuels too.
  if (G.plane.onGround) {
    for (const d of [{ x: 1120, y: 1780 }, { x: 1760, y: 1080 }]) {
      if (Math.hypot(d.x - G.plane.x, d.y - G.plane.y) < 70) {
        G.plane.fuel = Math.min(100, G.plane.fuel + 20 * dt);
      }
    }
  }
  updateEngineSound(G.audio, G.plane.throttle, G.plane.speed, true);
}

function update(dt) {
  G.time += dt;
  updateClouds(G.clouds, dt);
  updateParticles(G.fx, dt);
  updateFloatTexts(G.ft, dt);
  G.shake = Math.max(0, G.shake - 30 * dt);
  if (G.frozen) return; // staged screenshot pose: hold everything, keep clouds alive

  if (G.state === 'title') updateTitle(dt);
  else if (G.state === 'flying') updateFlying(dt);

  // Edge-triggered keys.
  if (wasPressed(G.input, ACTIONS.confirm)) {
    ensureAudio(G.audio);
    if (G.state === 'title') {
      startMission(G.ms, 0, G.plane, makePlane);
      G.state = 'flying';
    } else if (G.state === 'missionComplete') {
      startMission(G.ms, G.ms.index + 1, G.plane, makePlane);
      G.state = 'flying';
    }
  }
  if (wasPressed(G.input, ACTIONS.map)) {
    if (G.state === 'flying') G.state = 'map';
    else if (G.state === 'map') G.state = 'flying';
  }
  if (wasPressed(G.input, ACTIONS.pause)) {
    if (G.state === 'flying') G.state = 'paused';
    else if (G.state === 'paused') G.state = 'flying';
  }
  if (wasPressed(G.input, ACTIONS.mute)) {
    G.muted = !G.muted;
    setMuted(G.audio, G.muted);
  }
  if (wasPressed(G.input, ACTIONS.restart)) {
    if (G.state === 'crashed' || G.state === 'gameComplete' || G.state === 'paused') {
      const idx = G.state === 'gameComplete' ? 0 : G.ms.index;
      startMission(G.ms, idx, G.plane, makePlane);
      G.state = 'flying';
    }
  }
  consumePressed(G.input);
}

// Mouse: click the canvas to start from the title, or to leave the map.
canvas.addEventListener('pointerdown', () => {
  ensureAudio(G.audio);
  if (G.state === 'title') {
    startMission(G.ms, 0, G.plane, makePlane);
    G.state = 'flying';
  } else if (G.state === 'map') {
    G.state = 'flying';
  } else if (G.state === 'missionComplete') {
    startMission(G.ms, G.ms.index + 1, G.plane, makePlane);
    G.state = 'flying';
  }
});

// Touch buttons (shown on coarse pointers) drive the same semantic actions.
document.querySelectorAll('[data-touch]').forEach((btn) => {
  const name = btn.dataset.touch;
  const value = parseFloat(btn.dataset.value || '1');
  const on = (e) => { e.preventDefault(); ensureAudio(G.audio); G.input.touch[name] = value; };
  const off = (e) => { e.preventDefault(); G.input.touch[name] = 0; };
  btn.addEventListener('pointerdown', on);
  btn.addEventListener('pointerup', off);
  btn.addEventListener('pointerleave', off);
  btn.addEventListener('pointercancel', off);
});

// Fixed-timestep loop: 60 Hz simulation, render decoupled, 250 ms cap.
const TIMESTEP = 1000 / 60;
let lastTime = performance.now();
let accumulator = 0;

function gameLoop(now) {
  const frameTime = Math.min(now - lastTime, 250);
  lastTime = now;
  accumulator += frameTime;
  while (accumulator >= TIMESTEP) {
    update(TIMESTEP / 1000);
    accumulator -= TIMESTEP;
  }
  render(ctx, G);
  requestAnimationFrame(gameLoop);
}

// Screenshot staging (?shot=1..4) — real renders of the game's own code,
// posed by the game itself for the dossier's cover sheet.
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  G.shot = Number(shot);
  applyShot(G, G.shot);
  G.time = 20; // hide the first-seconds controls hint
}

requestAnimationFrame(gameLoop);
window.__ready = true;
