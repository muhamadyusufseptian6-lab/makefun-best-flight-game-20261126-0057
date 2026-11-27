// World: deterministic archipelago terrain, pre-rendered once to an offscreen canvas.
// The terrain is drawn once at load; every frame just draws the pre-rendered image.
import { WORLD, ISLANDS, RUNWAYS, DEPOTS, COLORS } from './config.js';
import { mulberry32, range, clamp } from './random.js';

// Analytic terrain height (feet) at a world point: islands are smooth hills,
// the sea is 0. Airfields are graded flat — a runway and its approach
// corridor, and each fuel depot, are at sea level so takeoff, refuel and
// landing are possible there. Used for crash checks and warnings.
export function terrainHeightAt(x, y) {
  let h = 0;
  for (const isl of ISLANDS) {
    const dx = (x - isl.x) / isl.rx;
    const dy = (y - isl.y) / isl.ry;
    const d2 = dx * dx + dy * dy;
    if (d2 < 1) {
      const fall = Math.pow(1 - d2, 1.4);
      h = Math.max(h, isl.peak * fall);
    }
  }
  // Flatten the graded airfield around each runway: fully flat over the
  // strip and its near corridor, ramping back to the hill outside it.
  for (const rw of RUNWAYS) {
    const dx = x - rw.x;
    const dy = y - rw.y;
    const along = Math.cos(-rw.heading) * dx + Math.sin(-rw.heading) * dy;
    const across = -Math.sin(-rw.heading) * dx + Math.cos(-rw.heading) * dy;
    const aIn = rw.length / 2 + 30;
    const cIn = rw.width / 2 + 30;
    const aOut = rw.length / 2 + 110;
    const cOut = rw.width / 2 + 110;
    if (Math.abs(along) < aOut && Math.abs(across) < cOut) {
      const t = Math.max((Math.abs(along) - aIn) / (aOut - aIn), (Math.abs(across) - cIn) / (cOut - cIn));
      h *= smoothstep(0, 1, t);
    }
  }
  // Flatten the ground under each fuel depot.
  for (const depot of DEPOTS) {
    const dist = Math.hypot(x - depot.x, y - depot.y);
    if (dist < 110) h *= smoothstep(0.3, 1, dist / 110);
  }
  return h;
}

function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

export function islandAt(x, y) {
  for (const isl of ISLANDS) {
    const dx = (x - isl.x) / isl.rx;
    const dy = (y - isl.y) / isl.ry;
    if (dx * dx + dy * dy < 1) return isl;
  }
  return null;
}

function drawIsland(ctx, isl, rng) {
  // Shallow-water halo.
  ctx.save();
  ctx.fillStyle = 'rgba(120, 210, 220, 0.35)';
  ctx.beginPath();
  ctx.ellipse(isl.x, isl.y, isl.rx * 1.18, isl.ry * 1.18, 0, 0, Math.PI * 2);
  ctx.fill();
  // Sand beach.
  ctx.fillStyle = COLORS.sand;
  ctx.beginPath();
  ctx.ellipse(isl.x, isl.y, isl.rx, isl.ry, 0, 0, Math.PI * 2);
  ctx.fill();
  // Grass interior.
  ctx.fillStyle = COLORS.grass;
  ctx.beginPath();
  ctx.ellipse(isl.x, isl.y, isl.rx * 0.86, isl.ry * 0.84, 0, 0, Math.PI * 2);
  ctx.fill();
  // Forest patches.
  ctx.fillStyle = COLORS.forest;
  for (let i = 0; i < 9; i++) {
    const fx = isl.x + range(rng, -0.6, 0.6) * isl.rx;
    const fy = isl.y + range(rng, -0.55, 0.55) * isl.ry;
    const fr = range(rng, 18, 46);
    ctx.beginPath();
    ctx.ellipse(fx, fy, fr, fr * 0.7, range(rng, 0, 3), 0, Math.PI * 2);
    ctx.fill();
  }
  // Elevation shading: the hill reads darker toward its peak, so the
  // pilot can see where the ground is high before the warning fires.
  const shade = ctx.createRadialGradient(isl.x, isl.y, 0, isl.x, isl.y, Math.max(isl.rx, isl.ry));
  shade.addColorStop(0, 'rgba(20, 50, 20, 0.35)');
  shade.addColorStop(0.7, 'rgba(20, 50, 20, 0.10)');
  shade.addColorStop(1, 'rgba(20, 50, 20, 0)');
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.ellipse(isl.x, isl.y, isl.rx * 0.86, isl.ry * 0.84, 0, 0, Math.PI * 2);
  ctx.fill();
  // River on the big islands: a blue ribbon from the hill to the sea.
  if (isl.rx > 300) {
    ctx.strokeStyle = 'rgba(70, 160, 220, 0.9)';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(isl.x - isl.rx * 0.2, isl.y - isl.ry * 0.3);
    ctx.bezierCurveTo(
      isl.x + isl.rx * 0.1, isl.y,
      isl.x + isl.rx * 0.35, isl.y + isl.ry * 0.3,
      isl.x + isl.rx * 0.95, isl.y + isl.ry * 0.55,
    );
    ctx.stroke();
  }
  // Town: a little grid of roofs + a road to the runway.
  if (isl.town) {
    const tx = isl.x - isl.rx * 0.45;
    const ty = isl.y - isl.ry * 0.45;
    ctx.fillStyle = COLORS.townRoof;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 5; c++) {
        const w = range(rng, 10, 18);
        const h = range(rng, 8, 14);
        ctx.fillRect(tx + c * 26 + range(rng, -3, 3), ty + r * 22 + range(rng, -3, 3), w, h);
      }
    }
    ctx.strokeStyle = '#c9b183';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(tx + 60, ty + 40);
    ctx.lineTo(isl.x, isl.y + isl.ry * 0.75);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRunway(ctx, rw) {
  ctx.save();
  ctx.translate(rw.x, rw.y);
  ctx.rotate(rw.heading);
  // Graded field around the strip — the flat ground the height function knows.
  ctx.fillStyle = '#cdb87a';
  roundRectPath(ctx, -rw.length / 2 - 110, -rw.width / 2 - 110, rw.length + 220, rw.width + 220, 40);
  ctx.fill();
  // Asphalt strip.
  ctx.fillStyle = COLORS.runway;
  ctx.fillRect(-rw.length / 2, -rw.width / 2, rw.length, rw.width);
  // Centre dashes.
  ctx.fillStyle = COLORS.runwayLine;
  for (let d = -rw.length / 2 + 24; d < rw.length / 2 - 20; d += 44) {
    ctx.fillRect(d, -2, 26, 4);
  }
  // Threshold bars.
  ctx.fillStyle = '#f2f7ff';
  for (let i = -1; i <= 1; i++) {
    ctx.fillRect(-rw.length / 2 + 8, i * 12 - 3, 18, 6);
    ctx.fillRect(rw.length / 2 - 26, i * 12 - 3, 18, 6);
  }
  ctx.restore();
  // Label beside the strip.
  ctx.save();
  ctx.fillStyle = 'rgba(242, 247, 255, 0.95)';
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(rw.label, rw.x, rw.y + rw.width / 2 + 24);
  ctx.restore();
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawDepot(ctx, depot) {
  ctx.save();
  ctx.translate(depot.x, depot.y);
  ctx.fillStyle = '#ffb52e';
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a2a3a';
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('F', 0, 1);
  ctx.strokeStyle = '#ffb52e';
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.arc(0, 0, 40, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(242, 247, 255, 0.95)';
  ctx.font = 'bold 13px monospace';
  ctx.fillText(depot.label, 0, 58);
  ctx.restore();
}

// Pre-render the whole archipelago once. Returns an offscreen canvas.
export function buildTerrainCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = WORLD.width;
  canvas.height = WORLD.height;
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(WORLD.seed);

  // Sea: deep blue with a soft vignette toward the edges.
  const sea = ctx.createLinearGradient(0, 0, WORLD.width, WORLD.height);
  sea.addColorStop(0, COLORS.seaDeep);
  sea.addColorStop(0.5, '#0d4d78');
  sea.addColorStop(1, COLORS.seaDeep);
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  // Faint current lines on the water.
  ctx.strokeStyle = 'rgba(140, 220, 235, 0.10)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    const y = range(rng, 0, WORLD.height);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(
      WORLD.width * 0.3, y + range(rng, -60, 60),
      WORLD.width * 0.7, y + range(rng, -60, 60),
      WORLD.width, y + range(rng, -40, 40),
    );
    ctx.stroke();
  }

  for (const isl of ISLANDS) drawIsland(ctx, isl, rng);
  for (const rw of RUNWAYS) drawRunway(ctx, rw);
  for (const depot of DEPOTS) drawDepot(ctx, depot);

  // Island name labels, big enough to read from the air.
  ctx.fillStyle = 'rgba(10, 30, 55, 0.85)';
  ctx.font = 'bold 26px monospace';
  ctx.textAlign = 'center';
  for (const isl of ISLANDS) {
    ctx.fillText(isl.name, isl.x, isl.y - isl.ry * 0.55);
  }
  return canvas;
}

// Drifting clouds: screen-space blobs, drawn between terrain and plane.
export function makeClouds(count, rng) {
  const clouds = [];
  for (let i = 0; i < count; i++) {
    clouds.push({
      x: rng() * WORLD.viewWidth * 1.4,
      y: rng() * WORLD.viewHeight * 1.2,
      s: range(rng, 60, 190),
      speed: range(rng, 6, 22),
      alpha: range(rng, 0.10, 0.22),
    });
  }
  return clouds;
}

export function updateClouds(clouds, dt) {
  for (const c of clouds) {
    c.x += c.speed * dt;
    if (c.x - c.s > WORLD.viewWidth) {
      c.x = -c.s;
      c.y = Math.random() * WORLD.viewHeight;
    }
  }
}

export function drawCloud(ctx, c) {
  ctx.save();
  ctx.globalAlpha = c.alpha;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, c.s, c.s * 0.38, 0, 0, Math.PI * 2);
  ctx.ellipse(c.x - c.s * 0.5, c.y + 6, c.s * 0.6, c.s * 0.3, 0, 0, Math.PI * 2);
  ctx.ellipse(c.x + c.s * 0.5, c.y + 8, c.s * 0.65, c.s * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Rain streaks for mission 3 (storm). Pooled, screen-space.
export function makeRain(count) {
  const drops = [];
  for (let i = 0; i < count; i++) {
    drops.push({ x: Math.random() * WORLD.viewWidth, y: Math.random() * WORLD.viewHeight, l: 14 + Math.random() * 18 });
  }
  return drops;
}

export function drawRain(ctx, drops, dt, wind) {
  ctx.save();
  ctx.strokeStyle = 'rgba(180, 210, 235, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const d of drops) {
    d.y += d.l * 22 * dt;
    d.x += wind * dt * 40;
    if (d.y > WORLD.viewHeight) { d.y = -20; d.x = Math.random() * WORLD.viewWidth; }
    if (d.x > WORLD.viewWidth) d.x = -10;
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(d.x + wind * 3, d.y + d.l);
  }
  ctx.stroke();
  ctx.restore();
}

export function clampToWorld(x, y, margin) {
  return {
    x: clamp(x, margin, WORLD.width - margin),
    y: clamp(y, margin, WORLD.height - margin),
  };
}
