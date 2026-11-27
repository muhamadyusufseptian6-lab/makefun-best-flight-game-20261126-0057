// Rendering: chase view over the pre-rendered archipelago, the courier plane,
// glowing rings, a lit-up instrument HUD, a tactical map, and every screen.
import { WORLD, COLORS, RINGS, RUNWAYS, DEPOTS, PLANE } from './config.js';
import { clamp, lerp, angleDiff } from './random.js';
import { drawCloud, drawRain } from './world.js';
import { drawParticles, drawFloatTexts } from './particles.js';
import { currentMission, currentObjective, objectiveTarget } from './missions.js';

const VW = WORLD.viewWidth;
const VH = WORLD.viewHeight;

function panel(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = COLORS.hudPanel;
  ctx.strokeStyle = 'rgba(55, 224, 255, 0.35)';
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function bar(ctx, x, y, w, h, frac, color, bg) {
  ctx.save();
  ctx.fillStyle = bg || 'rgba(255,255,255,0.15)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
  ctx.restore();
}

// Camera scale: higher altitude pulls the camera back so more terrain shows.
export function cameraScale(altitude) {
  return lerp(1.02, 0.58, clamp(altitude / 4200, 0, 1));
}

function drawRing(ctx, ring, active, time) {
  const pulse = active ? 1 + Math.sin(time * 5) * 0.08 : 1;
  const r = 62 * pulse;
  ctx.save();
  ctx.translate(ring.x, ring.y);
  ctx.strokeStyle = active ? '#ffb52e' : 'rgba(255, 181, 46, 0.45)';
  ctx.lineWidth = active ? 10 : 6;
  ctx.shadowColor = '#ffb52e';
  ctx.shadowBlur = active ? 22 : 8;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = active ? 'rgba(255, 181, 46, 0.16)' : 'rgba(255, 181, 46, 0.07)';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = active ? '#ffe9b0' : 'rgba(255, 233, 176, 0.6)';
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${ring.alt.toLocaleString('en-US')} FT`, 0, -r - 10);
  ctx.restore();
}

function drawPlane(ctx, plane, time) {
  const alt = plane.altitude;
  const shadowScale = clamp(1 - alt / 6000, 0.45, 1);
  const shadowOff = alt * 0.03;
  // Shadow on the terrain below — the altitude cue.
  ctx.save();
  ctx.translate(plane.x + shadowOff, plane.y + shadowOff * 1.4);
  ctx.rotate(plane.heading);
  ctx.globalAlpha = 0.30 * shadowScale;
  ctx.fillStyle = '#04101f';
  ctx.beginPath();
  ctx.ellipse(0, 0, 30 * shadowScale, 12 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(plane.x, plane.y);
  ctx.rotate(plane.heading);
  ctx.rotate(plane.bank * 0.55); // bank tilts the airframe in the chase view
  const s = 1 + clamp(alt / 9000, 0, 0.12);
  ctx.scale(s, s);

  // Propeller blur.
  ctx.fillStyle = 'rgba(220, 235, 255, 0.35)';
  ctx.beginPath();
  ctx.ellipse(30, 0, 5, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wings (swept, lightning-yellow tips).
  ctx.fillStyle = '#1d5fb8';
  ctx.beginPath();
  ctx.moveTo(2, -4); ctx.lineTo(-8, -34); ctx.lineTo(-16, -34); ctx.lineTo(-10, 0);
  ctx.closePath();
  ctx.moveTo(2, 4); ctx.lineTo(-8, 34); ctx.lineTo(-16, 34); ctx.lineTo(-10, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffd23e';
  ctx.fillRect(-17, -36, 4, 6);
  ctx.fillRect(-17, 30, 4, 6);

  // Tail.
  ctx.fillStyle = '#174a8f';
  ctx.beginPath();
  ctx.moveTo(-22, -3); ctx.lineTo(-32, -14); ctx.lineTo(-32, -10); ctx.lineTo(-24, 0);
  ctx.moveTo(-22, 3); ctx.lineTo(-32, 14); ctx.lineTo(-32, 10); ctx.lineTo(-24, 0);
  ctx.fill();

  // Fuselage with the lightning livery.
  ctx.fillStyle = '#2f7fe0';
  ctx.beginPath();
  ctx.ellipse(2, 0, 30, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.moveTo(14, -3); ctx.lineTo(4, -3); ctx.lineTo(8, 1); ctx.lineTo(-2, 1);
  ctx.lineTo(6, 5); ctx.lineTo(0, 5); ctx.lineTo(12, -1); ctx.lineTo(18, -1);
  ctx.closePath();
  ctx.fill();

  // Canopy.
  ctx.fillStyle = '#bfe9ff';
  ctx.beginPath();
  ctx.ellipse(10, 0, 8, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Nav lights: red port, green starboard.
  ctx.fillStyle = '#ff4b3e';
  ctx.beginPath(); ctx.arc(-14, -33, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#39ff6a';
  ctx.beginPath(); ctx.arc(-14, 33, 2.5, 0, Math.PI * 2); ctx.fill();

  // Landing gear when low.
  if (plane.gearDown && alt < 300) {
    ctx.fillStyle = '#222';
    ctx.fillRect(-6, -10, 3, 5);
    ctx.fillRect(-6, 5, 3, 5);
    ctx.fillRect(14, -8, 3, 4);
    ctx.fillRect(14, 4, 3, 4);
  }
  ctx.restore();
}

function drawAttitude(ctx, x, y, r, plane) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(-plane.bank * 0.8);
  const pitchOff = clamp(plane.climbRate / 620, -1, 1) * r * 0.55;
  ctx.fillStyle = '#2f7fd8';
  ctx.fillRect(-r, -r + pitchOff, r * 2, r);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-r, pitchOff, r * 2, r);
  ctx.strokeStyle = '#f2f7ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, pitchOff);
  ctx.lineTo(r, pitchOff);
  ctx.stroke();
  ctx.rotate(plane.bank * 0.8);
  // Fixed wings marker.
  ctx.fillStyle = '#ffd23e';
  ctx.fillRect(-r * 0.62, -2, r * 0.4, 4);
  ctx.fillRect(r * 0.22, -2, r * 0.4, 4);
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = 'rgba(55, 224, 255, 0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawCompass(ctx, x, y, w, heading) {
  const deg = ((heading * 180 / Math.PI) % 360 + 360) % 360;
  ctx.save();
  ctx.fillStyle = COLORS.hudPanel;
  roundRect(ctx, x, y, w, 34, 6);
  ctx.fill();
  ctx.beginPath();
  ctx.rect(x, y, w, 34);
  ctx.clip();
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  const labels = [[0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'], [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW']];
  for (const [d, label] of labels) {
    let diff = d - deg;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    const px = x + w / 2 + diff * 2.1;
    if (px < x - 20 || px > x + w + 20) continue;
    ctx.fillStyle = d % 90 === 0 ? '#ffb52e' : '#9fc6e8';
    ctx.fillText(label, px, y + 21);
  }
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y + 2);
  ctx.lineTo(x + w / 2 - 5, y + 9);
  ctx.lineTo(x + w / 2 + 5, y + 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawWindIndicator(ctx, p) {
  // Mission 3 storm only: the sideways push already exists in the flight
  // model (plane.windPush) — this makes it visible so the pilot can fight it.
  const w = p.windPush;
  const frac = clamp(Math.abs(w) / 26, 0, 1);
  const dir = w >= 0 ? 1 : -1;
  panel(ctx, 150, 244, 114, 54);
  ctx.fillStyle = COLORS.hudCyan;
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('ANGIN BADAI', 160, 262);
  // Arrow: points where the wind shoves the plane, length = strength.
  // Centered in the panel so it never pokes past the panel edge.
  const half = 7 + frac * 14;
  const cx = 186;
  const ay = 282;
  const ax0 = cx - dir * half;
  const ax1 = cx + dir * half;
  ctx.save();
  ctx.strokeStyle = COLORS.hudAmber;
  ctx.fillStyle = COLORS.hudAmber;
  ctx.lineWidth = 3;
  ctx.shadowColor = '#ff9d00';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(ax0, ay);
  ctx.lineTo(ax1, ay);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ax1 + dir * 8, ay);
  ctx.lineTo(ax1, ay - 5);
  ctx.lineTo(ax1, ay + 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Strength in knots, same px/s -> KT scale as the speed readout (* 0.9).
  const kt = Math.round(Math.abs(w) * 0.9);
  ctx.fillStyle = kt >= 20 ? COLORS.hudRed : (kt >= 12 ? COLORS.hudAmber : COLORS.hudGreen);
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`${kt} KT`, 256, 286);
}

function drawMinimap(ctx, G) {
  const mw = 210, mh = 140;
  const x = VW - mw - 16, y = VH - mh - 16;
  panel(ctx, x, y, mw, mh);
  const sx = mw / WORLD.width, sy = mh / WORLD.height;
  const sxm = (mw - 8) / WORLD.width, sym = (mh - 8) / WORLD.height;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 4, y + 4, mw - 8, mh - 8);
  ctx.clip();
  ctx.drawImage(G.terrain, x + 4, y + 4, mw - 8, mh - 8);
  // Target marker.
  const t = objectiveTarget(G.ms);
  if (t) {
    ctx.fillStyle = '#ffb52e';
    ctx.beginPath();
    ctx.arc(x + 4 + t.x * sxm, y + 4 + t.y * sym, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Plane.
  ctx.fillStyle = '#fff';
  ctx.save();
  ctx.translate(x + 4 + G.plane.x * sxm, y + 4 + G.plane.y * sym);
  ctx.rotate(G.plane.heading);
  ctx.beginPath();
  ctx.moveTo(7, 0); ctx.lineTo(-5, -4); ctx.lineTo(-5, 4); ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.save();
  ctx.fillStyle = 'rgba(242, 247, 255, 0.9)';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('PETA — V', x + 8, y + 14);
  ctx.restore();
}

function drawHud(ctx, G) {
  const p = G.plane;
  const ms = G.ms;
  ctx.save();
  ctx.textBaseline = 'alphabetic';

  // Left instrument stack: speed, altitude, heading.
  panel(ctx, 14, 14, 250, 96);
  ctx.fillStyle = COLORS.hudCyan;
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('KECEPATAN', 26, 34);
  ctx.fillText('KETINGGIAN', 26, 62);
  ctx.fillText('ARAH', 26, 90);
  ctx.fillStyle = COLORS.hudWhite;
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(p.speed * 0.9)}`, 196, 38);
  ctx.fillText(`${Math.round(p.altitude).toLocaleString('en-US')}`, 196, 66);
  const deg = ((p.heading * 180 / Math.PI) % 360 + 360) % 360;
  ctx.fillText(`${String(Math.round(deg)).padStart(3, '0')}°`, 196, 94);
  ctx.fillStyle = COLORS.hudAmber;
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('KT', 202, 38);
  ctx.fillText('FT', 202, 66);

  // Attitude indicator + throttle + g-meter.
  drawAttitude(ctx, 84, 172, 52, p);
  ctx.fillStyle = COLORS.hudCyan;
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SIKAP', 84, 240);
  panel(ctx, 150, 128, 114, 108);
  ctx.fillStyle = COLORS.hudCyan;
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('THROTTLE', 160, 146);
  bar(ctx, 160, 152, 94, 10, p.throttle, '#ffd23e');
  ctx.fillText('G-METER', 160, 182);
  const gColor = p.gForce > 4 ? COLORS.hudRed : (p.gForce > 3 ? COLORS.hudAmber : COLORS.hudGreen);
  ctx.fillStyle = gColor;
  ctx.font = 'bold 20px monospace';
  ctx.fillText(`${p.gForce.toFixed(1)} g`, 160, 206);
  ctx.fillStyle = COLORS.hudCyan;
  ctx.font = 'bold 11px monospace';
  ctx.fillText(p.gForce > 4 ? 'AWAS — G TINGGI' : 'AMAN', 160, 226);

  // Storm wind indicator — mission 3 only, below the throttle panel.
  if (G.ms.index === 2) drawWindIndicator(ctx, p);

  // Right stack: score, time, fuel, hull.
  panel(ctx, VW - 264, 14, 250, 96);
  const m = currentMission(ms);
  ctx.fillStyle = COLORS.hudCyan;
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('SKOR', VW - 252, 34);
  ctx.fillText('WAKTU', VW - 252, 62);
  ctx.fillText('MISI', VW - 252, 90);
  ctx.fillStyle = COLORS.hudWhite;
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`${ms.score}`, VW - 76, 38);
  const t = Math.floor(ms.timeInMission);
  ctx.fillText(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`, VW - 76, 66);
  ctx.font = 'bold 13px monospace';
  ctx.fillText(m ? `${m.id}/3` : '—', VW - 76, 90);
  ctx.fillStyle = COLORS.hudAmber;
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('PTS', VW - 70, 38);

  // Fuel + hull gauges.
  panel(ctx, VW - 264, 118, 250, 64);
  ctx.fillStyle = COLORS.hudCyan;
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('BAHAN BAKAR', VW - 252, 136);
  const fuelColor = p.fuel < 20 ? COLORS.hudRed : (p.fuel < 45 ? COLORS.hudAmber : COLORS.hudGreen);
  bar(ctx, VW - 252, 142, 226, 12, p.fuel / 100, fuelColor);
  ctx.fillStyle = COLORS.hudCyan;
  ctx.fillText('BADAN PESAWAT', VW - 252, 168);
  bar(ctx, VW - 252, 172, 226, 8, p.hull / 100, p.hull < 35 ? COLORS.hudRed : COLORS.hudGreen);

  // Compass strip top-center.
  drawCompass(ctx, VW / 2 - 130, 14, 260, p.heading);

  // Objective banner.
  const o = currentObjective(ms);
  if (o && !ms.completed) {
    const target = objectiveTarget(ms);
    const dist = target ? Math.round(Math.hypot(target.x - p.x, target.y - p.y) / 10) * 10 : 0;
    panel(ctx, VW / 2 - 260, 56, 520, 44);
    ctx.fillStyle = COLORS.hudAmber;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${m.name}  ·  ${o.text}`, VW / 2, 76);
    if (target) {
      ctx.fillStyle = COLORS.hudCyan;
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`TARGET ${target.label} — ${dist} m`, VW / 2, 93);
    }
  }

  // Toast.
  if (ms.toastTime > 0) {
    ctx.save();
    ctx.globalAlpha = clamp(ms.toastTime, 0, 1);
    ctx.fillStyle = '#7dff5e';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(ms.toast, VW / 2, 140);
    ctx.restore();
  }

  // Warnings.
  const warns = [];
  if (p.speed < PLANE_STALL && p.altitude > 60) warns.push('STALL — TAMBAH THROTTLE!');
  if (p.fuel < 20 && p.fuel > 0) warns.push('BAHAN BAKAR MENIPIS!');
  if (p.fuel <= 0) warns.push('BAHAN BAKAR HABIS — MELUNCUR!');
  const ground = G.groundHeight;
  if (ground !== undefined && p.altitude - ground < 220 && p.altitude > 0 && ground > 0) warns.push('TERRAIN — NAIK!');
  if (warns.length && Math.floor(G.time * 2.5) % 2 === 0) {
    ctx.fillStyle = COLORS.hudRed;
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(warns[0], VW / 2, VH - 180);
  }

  drawMinimap(ctx, G);

  // Controls hint, first seconds only.
  if (G.time < 14 && G.state === 'flying') {
    ctx.save();
    ctx.globalAlpha = clamp(14 - G.time, 0, 1) * 0.9;
    ctx.fillStyle = 'rgba(242, 247, 255, 0.95)';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('W/S throttle · A/D belok · I/K naik-turun · V peta · P jeda · M suara', 16, VH - 24);
    ctx.restore();
  }
  ctx.restore();
}

const PLANE_STALL = PLANE.stallSpeed;

function drawTargetArrow(ctx, G) {
  const t = objectiveTarget(G.ms);
  if (!t || G.state !== 'flying') return;
  const p = G.plane;
  const scale = cameraScale(p.altitude);
  const sx = (t.x - p.x) * scale + VW / 2;
  const sy = (t.y - p.y) * scale + VH * 0.55;
  if (sx > 40 && sx < VW - 40 && sy > 40 && sy < VH - 40) return; // on screen already
  const cx = VW / 2, cy = VH * 0.55;
  const ang = Math.atan2(sy - cy, sx - cx);
  const ex = cx + Math.cos(ang) * (VW / 2 - 46);
  const ey = cy + Math.sin(ang) * (VH / 2 - 46);
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(ang);
  ctx.fillStyle = '#ffb52e';
  ctx.beginPath();
  ctx.moveTo(16, 0); ctx.lineTo(-8, -10); ctx.lineTo(-4, 0); ctx.lineTo(-8, 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawWorld(ctx, G) {
  const p = G.plane;
  const scale = cameraScale(p.altitude);
  const shakeX = (Math.random() - 0.5) * G.shake;
  const shakeY = (Math.random() - 0.5) * G.shake;
  ctx.save();
  ctx.translate(VW / 2 + shakeX, VH * 0.55 + shakeY);
  ctx.scale(scale, scale);
  ctx.translate(-p.x, -p.y);
  ctx.drawImage(G.terrain, 0, 0);
  // Rings: only the current mission's rings, done ones dimmed.
  const m = currentMission(G.ms);
  if (m) {
    for (const o of m.objectives) {
      if (o.type !== 'ring') continue;
      const ring = RINGS[o.ring];
      const done = G.ms.ringsDone.has(o.ring);
      if (!done) drawRing(ctx, ring, o === currentObjective(G.ms), G.time);
    }
  }
  // Depot beacons.
  for (const d of DEPOTS) {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.strokeStyle = 'rgba(255, 181, 46, 0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 46 + Math.sin(G.time * 3) * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  drawPlane(ctx, p, G.time);
  drawParticles(ctx, G.fx, 0, 0, 1);
  drawFloatTexts(ctx, G.ft, 0, 0, 1);
  ctx.restore();

  // Clouds drift above the world, below the HUD.
  for (const c of G.clouds) drawCloud(ctx, c);
  if (G.ms.index === 2 && G.state === 'flying') drawRain(ctx, G.rain, 1 / 60, p.windPush);
}

function drawTacticalMap(ctx, G) {
  ctx.save();
  ctx.fillStyle = 'rgba(4, 14, 28, 0.92)';
  ctx.fillRect(0, 0, VW, VH);
  const mw = 980, mh = 620;
  const ox = (VW - mw) / 2, oy = (VH - mh) / 2 + 10;
  ctx.drawImage(G.terrain, ox, oy, mw, mh);
  ctx.strokeStyle = 'rgba(55, 224, 255, 0.6)';
  ctx.lineWidth = 2;
  ctx.strokeRect(ox, oy, mw, mh);
  const sx = mw / WORLD.width, sy = mh / WORLD.height;
  // Route line from plane to target.
  const t = objectiveTarget(G.ms);
  ctx.save();
  ctx.strokeStyle = '#ffb52e';
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ox + G.plane.x * sx, oy + G.plane.y * sy);
  if (t) ctx.lineTo(ox + t.x * sx, oy + t.y * sy);
  ctx.stroke();
  ctx.setLineDash([]);
  // Runways + depots + rings.
  for (const rw of RUNWAYS) {
    ctx.fillStyle = '#f5d76e';
    ctx.fillRect(ox + rw.x * sx - 8, oy + rw.y * sy - 3, 16, 6);
  }
  for (const d of DEPOTS) {
    ctx.fillStyle = '#ffb52e';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('F', ox + d.x * sx, oy + d.y * sy + 5);
  }
  for (const r of RINGS) {
    ctx.strokeStyle = 'rgba(255, 181, 46, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ox + r.x * sx, oy + r.y * sy, 7, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Plane marker.
  ctx.fillStyle = '#fff';
  ctx.save();
  ctx.translate(ox + G.plane.x * sx, oy + G.plane.y * sy);
  ctx.rotate(G.plane.heading);
  ctx.beginPath();
  ctx.moveTo(12, 0); ctx.lineTo(-8, -7); ctx.lineTo(-8, 7); ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  // Title + legend.
  ctx.save();
  ctx.fillStyle = COLORS.hudWhite;
  ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PETA TAKTIS — KEPULAUAN PETIR', VW / 2, 34);
  ctx.font = 'bold 13px monospace';
  ctx.fillStyle = COLORS.hudCyan;
  ctx.fillText('V / klik untuk kembali terbang  ·  kuning = target  ·  F = depot bahan bakar  ·  lingkaran = cincin', VW / 2, VH - 18);
  ctx.restore();
}

function bigTitle(ctx, G) {
  ctx.save();
  const grad = ctx.createLinearGradient(0, 0, 0, VH);
  grad.addColorStop(0, 'rgba(4, 14, 28, 0.55)');
  grad.addColorStop(0.55, 'rgba(4, 14, 28, 0.15)');
  grad.addColorStop(1, 'rgba(4, 14, 28, 0.75)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VW, VH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 74px monospace';
  ctx.shadowColor = '#ff9d00';
  ctx.shadowBlur = 30;
  ctx.fillText('PETIR COURIER', VW / 2, 150);
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.hudWhite;
  ctx.font = 'bold 22px monospace';
  ctx.fillText('3 misi  ·  7 cincin  ·  9 pulau  ·  1 tangki bahan bakar', VW / 2, 192);
  ctx.fillStyle = COLORS.hudCyan;
  ctx.font = 'bold 16px monospace';
  ctx.fillText('Kurir kilat antar pulau — paketnya Bu Lastri, suratnya Pak RT, nyawamu sendiri.', VW / 2, 222);
  ctx.restore();
}

function drawTitle(ctx, G) {
  bigTitle(ctx, G);
  ctx.save();
  ctx.textAlign = 'center';
  const lines = [
    'MISI 1 — Paket Kilat: antar resep sambal ke Pulau Karang',
    'MISI 2 — Tujuh Cincin Petir: lewati 7 cincin di ketinggian yang pas',
    'MISI 3 — Badai Terakhir: isi bensin, terbang menembus angin ke Pulau Badai',
  ];
  ctx.font = 'bold 16px monospace';
  lines.forEach((l, i) => {
    ctx.fillStyle = i === 0 ? '#7dff5e' : 'rgba(242, 247, 255, 0.9)';
    ctx.fillText(l, VW / 2, 300 + i * 30);
  });
  ctx.fillStyle = COLORS.hudWhite;
  ctx.font = 'bold 15px monospace';
  ctx.fillText('W/S throttle   ·   A/D belok   ·   I/K naik-turun   ·   V peta   ·   P jeda   ·   M suara', VW / 2, 430);
  if (Math.floor(G.time * 1.6) % 2 === 0) {
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 26px monospace';
    ctx.fillText('TEKAN ENTER UNTUK TERBANG', VW / 2, 500);
  }
  ctx.fillStyle = 'rgba(242, 247, 255, 0.6)';
  ctx.font = '13px monospace';
  ctx.fillText('Pesawat autopilot sedang demo di belakang layar ini — dia terbang sendiri.', VW / 2, 560);
  ctx.restore();
}

function drawCenterScreen(ctx, G, title, lines, accent) {
  ctx.save();
  ctx.fillStyle = 'rgba(4, 14, 28, 0.72)';
  ctx.fillRect(0, 0, VW, VH);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent || COLORS.hudAmber;
  ctx.font = 'bold 44px monospace';
  ctx.fillText(title, VW / 2, 220);
  ctx.fillStyle = COLORS.hudWhite;
  ctx.font = 'bold 18px monospace';
  lines.forEach((l, i) => ctx.fillText(l, VW / 2, 280 + i * 34));
  ctx.restore();
}

export function render(ctx, G) {
  ctx.clearRect(0, 0, VW, VH);
  ctx.fillStyle = COLORS.skyTop;
  ctx.fillRect(0, 0, VW, VH);

  if (G.state === 'title') {
    drawWorld(ctx, G);
    drawTitle(ctx, G);
    return;
  }

  drawWorld(ctx, G);
  drawTargetArrow(ctx, G);
  drawHud(ctx, G);

  if (G.state === 'map') {
    drawTacticalMap(ctx, G);
  } else if (G.state === 'paused') {
    drawCenterScreen(ctx, G, 'JEDA', ['P — lanjut terbang', 'R — mulai dari awal misi'], COLORS.hudCyan);
  } else if (G.state === 'crashed') {
    drawCenterScreen(ctx, G, 'PESAWAT JATUH!', [
      G.plane.crashReason || 'Kamu jatuh.',
      `Skor misi ini: ${G.ms.missionScore} pts`,
      'R — coba lagi misi ini',
    ], COLORS.hudRed);
  } else if (G.state === 'missionComplete') {
    const m = currentMission(G.ms);
    drawCenterScreen(ctx, G, 'MISI SELESAI!', [
      m ? m.title : '',
      `Skor misi: ${G.ms.missionScore} pts   ·   Total: ${G.ms.score} pts`,
      `Bahan bakar tersisa: ${Math.round(G.plane.fuel)}%  ·  Pendaratan: ${G.ms.lastLandingQuality || '—'}`,
      'ENTER — misi berikutnya',
    ], COLORS.hudGreen);
  } else if (G.state === 'gameComplete') {
    drawCenterScreen(ctx, G, 'SEMUA PAKET SAMPAI!', [
      'Bu Lastri dapat resepnya. Pak RT dapat balasan suratnya.',
      `SKOR AKHIR: ${G.ms.score} pts`,
      `Waktu total: ${Math.floor(G.ms.timeInMission / 60)} menit terbang`,
      'R — terbang lagi dari Misi 1',
    ], '#ffd23e');
  }
}
