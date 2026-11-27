// Flight model: fixed-step (60 Hz) plane physics. No variable dt here —
// the main loop feeds this a constant 1/60 step, so the flight is deterministic.
import { PLANE, WORLD, RUNWAYS } from './config.js';
import { clamp, angleDiff } from './random.js';
import { terrainHeightAt, clampToWorld, islandAt } from './world.js';

export function makePlane(startX, startY, startHeading) {
  return {
    x: startX,
    y: startY,
    heading: startHeading,
    bank: 0,
    speed: 0,
    altitude: 0,
    climbRate: 0,
    throttle: 0,
    fuel: PLANE.fuelCapacity,
    hull: PLANE.hullMax,
    onGround: true,
    gearDown: true,
    crashed: false,
    landed: false,
    gForce: 1,
    windPush: 0, // sideways wind (mission 3 storm)
  };
}

// input: { throttle: -1|0|1, turn: -1|0|1, pitch: -1|0|1 } — semantic actions.
export function updatePlane(p, input, dt, storm) {
  if (p.crashed) return;

  // Throttle.
  p.throttle = clamp(p.throttle + input.throttle * dt * 0.55, 0, 1);

  // Bank toward the turn input; bank bleeds back to level hands-off.
  const bankTarget = input.turn * PLANE.maxBank;
  p.bank += clamp(bankTarget - p.bank, -2.6 * dt, 2.6 * dt);
  if (input.turn === 0) p.bank *= Math.pow(0.25, dt);

  // Heading follows bank and speed: a banked plane turns.
  const turnRate = p.bank * (0.35 + p.speed / 300) * PLANE.turnAuthority;
  p.heading += turnRate * dt;

  // Climb / descend. Climbing costs speed, descending buys it back.
  const climbTarget = input.pitch * PLANE.climbRate;
  p.climbRate += clamp(climbTarget - p.climbRate, -900 * dt, 900 * dt);
  p.altitude = clamp(p.altitude + p.climbRate * dt, 0, PLANE.maxAltitude);
  p.speed -= (p.climbRate / PLANE.climbRate) * 55 * dt;

  // Speed chases the throttle setting.
  const targetSpeed = PLANE.minSpeed + p.throttle * (PLANE.maxSpeed - PLANE.minSpeed);
  const accel = p.speed < targetSpeed ? 95 : 150;
  p.speed += clamp(targetSpeed - p.speed, -accel * dt, accel * dt);

  // Stall: too slow and the plane sinks no matter what.
  if (p.speed < PLANE.stallSpeed && p.altitude > 0) {
    p.altitude = Math.max(0, p.altitude - (PLANE.stallSpeed - p.speed) * 1.6 * dt);
  }

  // Storm wind pushes the plane sideways (mission 3).
  if (storm) p.windPush = Math.sin(Date.now() / 900) * 26;
  else p.windPush *= 0.9;

  // Move.
  p.x += Math.cos(p.heading) * p.speed * dt + p.windPush * dt;
  p.y += Math.sin(p.heading) * p.speed * dt;
  const c = clampToWorld(p.x, p.y, 60);
  p.x = c.x;
  p.y = c.y;

  // G-force from the turn: bank + speed.
  p.gForce = 1 + Math.abs(p.bank) * (p.speed / 240) * 2.2;

  // Fuel burn.
  p.fuel = Math.max(0, p.fuel - (PLANE.fuelBurnIdle + p.throttle * PLANE.fuelBurnFull) * dt);

  // Ground contact.
  p.onGround = p.altitude <= 0.5;

  // Terrain collision: flying into a hill.
  const ground = terrainHeightAt(p.x, p.y);
  if (p.altitude < ground) {
    p.crashed = true;
    p.crashReason = `Menabrak bukit ${Math.round(ground)} ft di ${islandName(p.x, p.y)}`;
  }
  // Out of fuel over land or sea: glide down, then ditch — unless the plane
  // is sitting on a runway strip, where the landing logic decides instead
  // (so a touchdown on the last drop of fuel still counts as a landing).
  if (p.fuel <= 0 && p.altitude <= 0.5 && !overRunway(p)) {
    p.crashed = true;
    p.crashReason = 'Bahan bakar habis — mendarat darurat di laut';
  }
  if (p.fuel <= 0 && p.altitude > 0) {
    p.throttle = 0;
    p.climbRate = Math.min(p.climbRate, -120);
  }
}

function islandName(x, y) {
  const isl = islandAt(x, y);
  return isl ? isl.name : 'laut lepas';
}

// Is the plane over any runway strip (same strip math as landingCheck)?
function overRunway(p) {
  for (const rw of RUNWAYS) {
    const dx = p.x - rw.x;
    const dy = p.y - rw.y;
    const along = Math.cos(-rw.heading) * dx + Math.sin(-rw.heading) * dy;
    const across = -Math.sin(-rw.heading) * dx + Math.cos(-rw.heading) * dy;
    if (Math.abs(along) < rw.length / 2 && Math.abs(across) < rw.width / 2 + 14) return true;
  }
  return false;
}

// Heading the plane should fly to reach a target point.
export function headingTo(p, tx, ty) {
  return Math.atan2(ty - p.y, tx - p.x);
}

// Autopilot: steer gently toward a waypoint, hold altitude and throttle.
// Used on the title screen (attract mode) and for staged screenshots.
export function autopilotInput(p, tx, ty, targetAlt, targetThrottle) {
  const want = headingTo(p, tx, ty);
  const diff = angleDiff(p.heading, want);
  const turn = clamp(diff * 1.6, -1, 1);
  const pitch = clamp((targetAlt - p.altitude) / 500, -1, 1);
  const throttle = p.throttle < targetThrottle ? 1 : (p.throttle > targetThrottle + 0.05 ? -1 : 0);
  return { throttle, turn, pitch };
}

// Landing test: called when the plane is low over a runway.
export function landingCheck(p, runway) {
  const dx = p.x - runway.x;
  const dy = p.y - runway.y;
  const along = Math.cos(-runway.heading) * dx + Math.sin(-runway.heading) * dy;
  const across = -Math.sin(-runway.heading) * dx + Math.cos(-runway.heading) * dy;
  const onStrip = Math.abs(along) < runway.length / 2 && Math.abs(across) < runway.width / 2 + 14;
  if (!onStrip) return null;
  if (p.altitude > 45) return null;
  const headingErr = Math.abs(angleDiff(p.heading, runway.heading));
  const aligned = headingErr < 0.5 || headingErr > Math.PI - 0.5;
  if (!aligned) return { result: 'crash', reason: 'Mendarat miring — hidung pesawat membentur aspal' };
  if (p.speed > 175) return { result: 'crash', reason: 'Terlalu cepat — pesawat meluncur keluar runway' };
  if (p.climbRate < -260) return { result: 'crash', reason: 'Mendarat terlalu keras — roda patah' };
  const quality = Math.abs(across) < 9 && p.speed < 130 && p.climbRate > -120
    ? 'perfect' : (Math.abs(across) < 20 && p.speed < 155 ? 'good' : 'rough');
  return { result: 'landed', quality, across: Math.abs(across) };
}
