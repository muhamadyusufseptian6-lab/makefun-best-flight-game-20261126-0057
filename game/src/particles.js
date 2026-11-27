// Object pooling: particles and floating score texts are pre-allocated once
// and toggled active — nothing is allocated inside the game loop.
const MAX_PARTICLES = 260;
const MAX_TEXTS = 18;

export function makeParticles() {
  const pool = [];
  for (let i = 0; i < MAX_PARTICLES; i++) {
    pool.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff', gravity: 0 });
  }
  return { pool, cursor: 0 };
}

export function spawnParticle(fx, x, y, vx, vy, life, size, color, gravity) {
  const p = fx.pool[fx.cursor];
  fx.cursor = (fx.cursor + 1) % fx.pool.length;
  p.active = true;
  p.x = x; p.y = y; p.vx = vx; p.vy = vy;
  p.life = life; p.maxLife = life; p.size = size; p.color = color;
  p.gravity = gravity || 0;
}

export function burst(fx, x, y, count, colors, speed, life, size) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    spawnParticle(fx, x, y, Math.cos(a) * s, Math.sin(a) * s,
      life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.8),
      colors[i % colors.length], 60);
  }
}

export function updateParticles(fx, dt) {
  for (const p of fx.pool) {
    if (!p.active) continue;
    p.life -= dt;
    if (p.life <= 0) { p.active = false; continue; }
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.pow(0.4, dt);
    p.vy *= Math.pow(0.4, dt);
  }
}

export function drawParticles(ctx, fx, camX, camY, scale) {
  for (const p of fx.pool) {
    if (!p.active) continue;
    const a = p.life / p.maxLife;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc((p.x - camX) * scale, (p.y - camY) * scale, Math.max(1, p.size * scale * a), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function makeFloatTexts() {
  const pool = [];
  for (let i = 0; i < MAX_TEXTS; i++) {
    pool.push({ active: false, x: 0, y: 0, life: 0, text: '', color: '#fff' });
  }
  return { pool, cursor: 0 };
}

export function spawnFloatText(ft, x, y, text, color) {
  const t = ft.pool[ft.cursor];
  ft.cursor = (ft.cursor + 1) % ft.pool.length;
  t.active = true;
  t.x = x; t.y = y; t.life = 1.6; t.text = text; t.color = color || '#7dff5e';
}

export function updateFloatTexts(ft, dt) {
  for (const t of ft.pool) {
    if (!t.active) continue;
    t.life -= dt;
    t.y -= 34 * dt;
    if (t.life <= 0) t.active = false;
  }
}

export function drawFloatTexts(ctx, ft, camX, camY, scale) {
  ctx.save();
  ctx.font = 'bold 17px monospace';
  ctx.textAlign = 'center';
  for (const t of ft.pool) {
    if (!t.active) continue;
    ctx.globalAlpha = Math.min(1, t.life);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, (t.x - camX) * scale, (t.y - camY) * scale);
  }
  ctx.restore();
}
