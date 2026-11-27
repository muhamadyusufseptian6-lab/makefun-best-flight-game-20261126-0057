// Missions: objectives, scoring, and the sortie flow.
// A mission is a list of objectives; each completed objective pays points and
// the mission ends with a landing-quality + time + fuel bonus.
import { MISSIONS, RINGS, RUNWAYS, DEPOTS, SCORES } from './config.js';
import { distance } from './random.js';
import { landingCheck } from './plane.js';

export function makeMissionState() {
  return {
    index: 0,
    objectiveIndex: 0,
    score: 0,
    missionScore: 0,
    timeInMission: 0,
    completed: false,
    failed: false,
    failReason: '',
    toast: '',
    toastTime: 0,
    ringsDone: new Set(),
    refueled: false,
    landings: 0,
    lastLandingQuality: '',
  };
}

export function currentMission(ms) {
  return MISSIONS[ms.index];
}

export function currentObjective(ms) {
  const m = currentMission(ms);
  return m ? m.objectives[ms.objectiveIndex] : null;
}

export function missionDone(ms) {
  const m = currentMission(ms);
  return m && ms.objectiveIndex >= m.objectives.length;
}

export function objectiveTarget(ms) {
  const o = currentObjective(ms);
  if (!o) return null;
  if (o.type === 'ring') {
    const r = RINGS[o.ring];
    return { x: r.x, y: r.y, alt: r.alt, label: `CINCIN ${o.ring + 1}` };
  }
  if (o.type === 'land') {
    const rw = RUNWAYS.find((r) => r.id === o.runway);
    return { x: rw.x, y: rw.y, alt: 0, label: rw.label };
  }
  if (o.type === 'refuel') {
    return { x: DEPOTS[1].x, y: DEPOTS[1].y, alt: 0, label: DEPOTS[1].label };
  }
  if (o.type === 'flyto') return { x: o.x, y: o.y, alt: 0, label: 'PULAU BADAI' };
  if (o.type === 'takeoff') return { x: 720, y: 2090, alt: 300, label: 'LEPAS LANDAS' };
  return null;
}

function setToast(ms, text) {
  ms.toast = text;
  ms.toastTime = 3.2;
}

function completeObjective(ms, points, label) {
  ms.score += points;
  ms.missionScore += points;
  ms.objectiveIndex += 1;
  setToast(ms, `✓ ${label}  +${points}`);
  if (missionDone(ms)) {
    const timeBonus = Math.max(0, Math.round((240 - ms.timeInMission) * SCORES.timeBonusPerSecond));
    ms.score += timeBonus;
    ms.missionScore += timeBonus;
    ms.completed = true;
    setToast(ms, `MISI SELESAI! Bonus waktu +${timeBonus}`);
  }
}

// Called every fixed step while flying. Returns events for sound/particles.
export function updateMission(ms, plane, fx, fxApi, audioApi) {
  const events = [];
  ms.timeInMission += 1 / 60;
  if (ms.toastTime > 0) ms.toastTime -= 1 / 60;
  if (ms.completed || ms.failed) return events;

  const o = currentObjective(ms);
  if (!o) return events;

  if (o.type === 'takeoff') {
    if (plane.altitude > 300 && plane.speed > 140) {
      completeObjective(ms, SCORES.objective, 'Lepas landas!');
      events.push('takeoff');
    }
    return events;
  }

  if (o.type === 'ring') {
    const r = RINGS[o.ring];
    const d = distance(plane.x, plane.y, r.x, r.y);
    const altOk = Math.abs(plane.altitude - r.alt) < 320;
    if (d < 62 && altOk) {
      ms.ringsDone.add(o.ring);
      completeObjective(ms, SCORES.ring, `Cincin ${o.ring + 1} dilewati!`);
      events.push('ring');
    } else if (d < 62 && !altOk) {
      setToast(ms, `Ketinggian salah! Cincin ini di ${r.alt.toLocaleString('en-US')} ft — kamu di ${Math.round(plane.altitude)} ft`);
      ms.toastTime = 1.2;
    }
    return events;
  }

  if (o.type === 'refuel') {
    const depot = DEPOTS[1];
    const d = distance(plane.x, plane.y, depot.x, depot.y);
    if (d < 70 && plane.altitude < 260 && plane.speed < 170) {
      if (plane.fuel < 99) {
        plane.fuel = Math.min(100, plane.fuel + 55 * (1 / 60));
        if (!ms.refueled) {
          ms.refueled = true;
          events.push('refuel');
        }
        if (plane.fuel >= 99.5) {
          completeObjective(ms, SCORES.objective, 'Tangki penuh — gas lagi!');
          events.push('refueled');
        }
      }
    }
    return events;
  }

  if (o.type === 'flyto') {
    if (distance(plane.x, plane.y, o.x, o.y) < 320) {
      completeObjective(ms, SCORES.objective, 'Sampai di Pulau Badai!');
      events.push('flyto');
    }
    return events;
  }

  if (o.type === 'land') {
    const rw = RUNWAYS.find((r) => r.id === o.runway);
    const res = landingCheck(plane, rw);
    if (res && res.result === 'landed') {
      const pts = res.quality === 'perfect' ? SCORES.landingPerfect
        : res.quality === 'good' ? SCORES.landingGood : SCORES.landingRough;
      ms.lastLandingQuality = res.quality;
      ms.landings += 1;
      plane.landed = true;
      plane.speed = 0;
      plane.throttle = 0;
      plane.altitude = 0;
      completeObjective(ms, pts, `Mendarat ${res.quality === 'perfect' ? 'SEMPURNA' : res.quality === 'good' ? 'bagus' : 'kasar'}!`);
      events.push('landed');
    } else if (res && res.result === 'crash') {
      plane.crashed = true;
      plane.crashReason = res.reason;
      events.push('crash');
    }
    return events;
  }
  return events;
}

// Start the next mission: reset the plane to the home runway, fresh fuel.
export function startMission(ms, index, plane, makePlaneFn) {
  ms.index = index;
  ms.objectiveIndex = 0;
  ms.missionScore = 0;
  ms.timeInMission = 0;
  ms.completed = false;
  ms.failed = false;
  ms.ringsDone = new Set();
  ms.refueled = false;
  const fresh = makePlaneFn(720, 2090, 0);
  Object.assign(plane, fresh);
  setToast(ms, MISSIONS[index].name);
}
