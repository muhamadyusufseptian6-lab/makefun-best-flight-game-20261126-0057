// Playtest: drives the real game in the headless shell and checks the
// mission-1 flow is actually winnable: takeoff, ring, landing.
// Usage: node tests/playtest.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const gameDir = join(root, 'game');
const SHELL = `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell`;
const PORT = 8124;
const CDP_PORT = 9334;
const MIME = { '.html': 'text/html', '.js': 'text/javascript' };

const server = createServer(async (req, res) => {
  try {
    const path = req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0];
    const data = await readFile(join(gameDir, decodeURIComponent(path)));
    res.writeHead(200, { 'Content-Type': MIME['.js'] && path.endsWith('.js') ? 'text/javascript' : 'text/html' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const chrome = spawn(SHELL, [`--remote-debugging-port=${CDP_PORT}`, '--no-sandbox', '--disable-gpu', '--window-size=1280,720', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
}

try {
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`); if (r.ok) break; } catch {}
    await sleep(250);
  }
  const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?http://127.0.0.1:${PORT}/index.html`, { method: 'PUT' });
  const target = await res.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') errors.push(JSON.stringify(msg.params.exceptionDetails).slice(0, 300));
  };
  const send = (method, params = {}) => new Promise((resolve) => {
    const mid = ++id; pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300));
    return r.result?.result?.value;
  };
  const key = async (code, keyName, type) => send('Input.dispatchKeyEvent', { type, code, key: keyName, windowsVirtualKeyCode: keyName === 'Enter' ? 13 : 0 });
  const tap = async (code, keyName) => { await key(code, keyName, 'keyDown'); await key(code, keyName, 'keyUp'); };

  await send('Page.enable');
  await send('Runtime.enable');
  for (let i = 0; i < 30; i++) {
    if (await evalJs('window.__ready === true')) break;
    await sleep(200);
  }
  check('game boots with no console errors', errors.length === 0, errors.join(' | '));
  check('title state at boot', (await evalJs('window.__game.state')) === 'title');
  check('title autopilot plane is alive (not crashed on spawn)',
    (await evalJs('!window.__game.plane.crashed')) === true,
    await evalJs('JSON.stringify({crashed: window.__game.plane.crashed, alt: window.__game.plane.altitude})'));

  // Start mission 1 with Enter, then throttle up + climb for 6 seconds.
  await tap('Enter', 'Enter');
  await sleep(300);
  check('Enter starts mission 1', (await evalJs('window.__game.state')) === 'flying');
  await key('KeyW', 'w', 'rawKeyDown');
  await key('KeyI', 'i', 'rawKeyDown');
  await sleep(6000);
  await key('KeyW', 'w', 'keyUp');
  await key('KeyI', 'i', 'keyUp');
  const afterTakeoff = await evalJs('JSON.stringify({alt: Math.round(window.__game.plane.altitude), speed: Math.round(window.__game.plane.speed), obj: window.__game.ms.objectiveIndex, crashed: window.__game.plane.crashed, state: window.__game.state})');
  console.log('  after takeoff:', afterTakeoff);
  check('takeoff objective completes (alt > 300, speed > 140)', (await evalJs('window.__game.ms.objectiveIndex')) >= 1, afterTakeoff);
  check('plane did not crash on takeoff', (await evalJs('!window.__game.plane.crashed')) === true);

  // Steer the plane through ring 0 by posing it just before the ring.
  await evalJs(`(() => { const g = window.__game; const r = {x: 1150, y: 1500}; g.plane.x = 1000; g.plane.y = 1640; g.plane.heading = Math.atan2(r.y - 1640, r.x - 1000); g.plane.altitude = 1200; g.plane.speed = 280; g.plane.throttle = 0.7; })()`);
  await sleep(1500);
  const afterRing = await evalJs('JSON.stringify({obj: window.__game.ms.objectiveIndex, score: window.__game.ms.score, crashed: window.__game.plane.crashed})');
  console.log('  after ring:', afterRing);
  check('ring objective completes', (await evalJs('window.__game.ms.objectiveIndex')) >= 2, afterRing);

  // Land on RWY Karang: pose on final, low and slow, let the sim land it.
  await evalJs(`(() => { const g = window.__game; g.plane.x = 1300; g.plane.y = 1030; g.plane.heading = 0; g.plane.altitude = 40; g.plane.speed = 120; g.plane.throttle = 0.2; g.plane.climbRate = -60; })()`);
  await sleep(2500);
  const afterLand = await evalJs('JSON.stringify({state: window.__game.state, obj: window.__game.ms.objectiveIndex, score: window.__game.ms.score, quality: window.__game.ms.lastLandingQuality, crashed: window.__game.plane.crashed})');
  console.log('  after landing:', afterLand);
  check('landing completes mission 1', (await evalJs('window.__game.state')) === 'missionComplete', afterLand);
  check('landing quality recorded', (await evalJs('window.__game.ms.lastLandingQuality')) !== '');

  // Mission 2 starts from Enter: rings + fuel still sane.
  await tap('Enter', 'Enter');
  await sleep(400);
  check('Enter starts mission 2', (await evalJs('window.__game.ms.index')) === 1 && (await evalJs('window.__game.state')) === 'flying');
  check('fuel refilled for mission 2', (await evalJs('window.__game.plane.fuel')) > 99);
  check('no console errors during playtest', errors.length === 0, errors.join(' | '));

  ws.close();
} finally {
  chrome.kill();
  server.close();
}
console.log(failures === 0 ? 'ALL PLAYTEST CHECKS PASSED' : `${failures} PLAYTEST CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
