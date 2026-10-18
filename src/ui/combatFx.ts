export type SwingKind = 'slash' | 'cast' | 'clash';

export interface SwingFx {
  x: number;
  y: number;
  angle: number;
  range: number;
  cone: number;
  color: string;
  age: number;
  life: number;
  kind: SwingKind;
}

/** World-space attack flourishes (slash arcs, cast rings, clash sparks). */
export function drawSwingFx(ctx: CanvasRenderingContext2D, s: SwingFx) {
  const k = 1 - s.age / s.life;
  const t = s.age / s.life;
  ctx.save();
  if (s.kind === 'cast') drawCast(ctx, s, k, t);
  else if (s.kind === 'clash') drawClash(ctx, s, k);
  else drawSlash(ctx, s, k, t);
  ctx.restore();
}

function drawSlash(ctx: CanvasRenderingContext2D, s: SwingFx, k: number, t: number) {
  const sweep = s.cone * (0.55 + 0.45 * Math.min(1, t * 1.8));
  const a0 = s.angle - sweep;
  const a1 = s.angle + sweep * (0.35 + 0.65 * t);
  const rad = s.range * (0.5 + 0.5 * Math.min(1, t * 1.4));

  // Soft outer wash
  ctx.strokeStyle = s.color;
  ctx.globalAlpha = 0.18 * k;
  ctx.lineWidth = 14 + 10 * k;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(s.x, s.y, rad, a0, a1);
  ctx.stroke();

  // Main blade ribbon
  ctx.globalAlpha = 0.4 + 0.55 * k;
  ctx.lineWidth = 3.5 + 4 * k;
  ctx.beginPath();
  ctx.arc(s.x, s.y, rad, a0, a1);
  ctx.stroke();

  // Bright leading edge
  ctx.strokeStyle = '#fff8e7';
  ctx.globalAlpha = 0.55 * k;
  ctx.lineWidth = 1.5 + 1.5 * k;
  ctx.beginPath();
  ctx.arc(s.x, s.y, rad + 2, a0 + sweep * 0.35, a1);
  ctx.stroke();

  // Tip sparks along the leading edge
  const tip = a1;
  const tx = s.x + Math.cos(tip) * rad;
  const ty = s.y + Math.sin(tip) * rad;
  ctx.fillStyle = '#fff8e7';
  ctx.globalAlpha = 0.7 * k;
  for (let i = 0; i < 4; i++) {
    const ang = tip + (i - 1.5) * 0.22;
    const d = 6 + i * 3 * k;
    ctx.beginPath();
    ctx.arc(tx + Math.cos(ang) * d * 0.35, ty + Math.sin(ang) * d * 0.35, 1.6 + (3 - i) * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Afterimage arcs
  ctx.strokeStyle = s.color;
  ctx.globalAlpha = 0.2 * k;
  ctx.lineWidth = 2;
  for (let i = 1; i <= 2; i++) {
    const back = t - i * 0.12;
    if (back < 0) continue;
    const br = s.range * (0.45 + 0.4 * back);
    const bs = s.cone * (0.4 + 0.4 * back);
    ctx.beginPath();
    ctx.arc(s.x, s.y, br, s.angle - bs, s.angle + bs * back);
    ctx.stroke();
  }
}

function drawCast(ctx: CanvasRenderingContext2D, s: SwingFx, k: number, t: number) {
  const rad = s.range * (0.35 + 0.9 * t);
  ctx.strokeStyle = s.color;
  ctx.globalAlpha = 0.5 * k;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(s.x, s.y, rad, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 0.25 * k;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(s.x, s.y, rad * 0.65, 0, Math.PI * 2);
  ctx.stroke();

  // Spokes
  ctx.strokeStyle = '#fff8e7';
  ctx.globalAlpha = 0.45 * k;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) {
    const a = s.angle + (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(s.x + Math.cos(a) * rad * 0.2, s.y + Math.sin(a) * rad * 0.2);
    ctx.lineTo(s.x + Math.cos(a) * rad * 0.85, s.y + Math.sin(a) * rad * 0.85);
    ctx.stroke();
  }

  ctx.fillStyle = s.color;
  ctx.globalAlpha = 0.55 * k;
  ctx.beginPath();
  ctx.arc(s.x, s.y, 4 + 3 * k, 0, Math.PI * 2);
  ctx.fill();
}

function drawClash(ctx: CanvasRenderingContext2D, s: SwingFx, k: number) {
  ctx.strokeStyle = '#ffd54f';
  ctx.fillStyle = '#fff8e7';
  for (let i = 0; i < 8; i++) {
    const a = s.angle + (i / 8) * Math.PI * 2 + s.age * 8;
    const d = s.range * (0.3 + 0.7 * (1 - k));
    const x = s.x + Math.cos(a) * d;
    const y = s.y + Math.sin(a) * d;
    ctx.globalAlpha = 0.7 * k;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}
