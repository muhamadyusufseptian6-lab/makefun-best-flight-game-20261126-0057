// Screenshot staging: pose the game into four real, playable states so the
// screenshots show the flight game at its best. Every pose is a state the
// game itself can reach by playing; nothing is drawn outside the game code.
import { RINGS, RUNWAYS } from './config.js';
import { startMission } from './missions.js';
import { makePlane } from './plane.js';

function posePlane(G, x, y, heading, altitude, speed, throttle, fuel) {
  const p = G.plane;
  p.x = x; p.y = y; p.heading = heading;
  p.altitude = altitude; p.speed = speed; p.throttle = throttle;
  p.fuel = fuel; p.bank = 0; p.climbRate = 0;
  p.crashed = false; p.landed = false; p.onGround = altitude <= 0.5;
  p.gearDown = altitude < 300;
}

export function applyShot(G, n) {
  // Freeze the simulation so the staged pose holds exactly for the capture.
  G.frozen = true;
  if (n === 1) {
    // COVER — chase view: plane over the sea, ring just ahead, Karang runway
    // and its island in the distance, full HUD lit.
    startMission(G.ms, 0, G.plane, makePlane);
    G.ms.objectiveIndex = 1; // ring objective active
    G.ms.score = 100;
    G.ms.timeInMission = 42;
    const ring = RINGS[0];
    const heading = Math.atan2(ring.y - 1620, ring.x - 1050);
    posePlane(G, 1050, 1620, heading, 1300, 280, 0.7, 78);
    G.ms.toast = 'Cincin Pemanasan di depan — 1.200 ft!';
    G.ms.toastTime = 3.0;
    G.state = 'flying';
  } else if (n === 2) {
    // Last ring of mission 2, low over Pulau Senja — island below, ring ahead.
    startMission(G.ms, 1, G.plane, makePlane);
    G.ms.objectiveIndex = 6; // seventh ring
    for (let i = 0; i < 6; i++) G.ms.ringsDone.add(i);
    G.ms.score = 900;
    G.ms.timeInMission = 210;
    const ring = RINGS[6];
    const heading = Math.atan2(ring.y - 2220, ring.x - 1850);
    posePlane(G, 1850, 2220, heading, 2000, 300, 0.75, 58);
    G.ms.toast = 'Cincin 7 dari 7 — terakhir, jangan sampai lepas!';
    G.ms.toastTime = 3.0;
    G.state = 'flying';
  } else if (n === 3) {
    // Final approach to RWY Karang: low, slow, gear down, just at the
    // threshold inside the graded approach corridor.
    startMission(G.ms, 0, G.plane, makePlane);
    G.ms.objectiveIndex = 2; // landing objective active
    G.ms.score = 250;
    G.ms.timeInMission = 128;
    const rw = RUNWAYS.find((r) => r.id === 'karang');
    posePlane(G, rw.x - 170, rw.y, rw.heading, 95, 118, 0.28, 41);
    G.plane.gearDown = true;
    G.ms.toast = 'Final — RWY Karang di depan!';
    G.ms.toastTime = 3.0;
    G.state = 'flying';
  } else if (n === 4) {
    // Mission complete: score breakdown over the parked plane on RWY Karang.
    startMission(G.ms, 0, G.plane, makePlane);
    G.ms.objectiveIndex = 3;
    G.ms.completed = true;
    G.ms.missionScore = 640;
    G.ms.score = 640;
    G.ms.timeInMission = 151;
    G.ms.lastLandingQuality = 'perfect';
    const rw = RUNWAYS.find((r) => r.id === 'karang');
    posePlane(G, rw.x, rw.y, rw.heading, 0, 0, 0, 52);
    G.state = 'missionComplete';
  }
}
