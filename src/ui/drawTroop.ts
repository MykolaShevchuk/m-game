import type { TroopDef } from '@/troops';

function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * k)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * k)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * k)));
  return `rgb(${r},${g},${b})`;
}

/** Soft prop-style troop — matches terrain / character silhouettes. */
export function drawTroop(
  ctx: CanvasRenderingContext2D,
  def: TroopDef,
  cx: number,
  cy: number,
  size: number,
  opts: { facing?: { x: number; y: number } } = {},
) {
  const r = size / 2;
  const facing = opts.facing ?? { x: 1, y: 0 };
  const flip = facing.x < -0.05 ? -1 : 1;

  ctx.save();

  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.85, r * 0.75, r * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(cx, cy);
  ctx.scale(flip, 1);

  ctx.fillStyle = def.color;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.15, r * 0.55, r * 0.58, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(def.color, 1.2);
  ctx.beginPath();
  ctx.ellipse(-r * 0.12, r * 0.05, r * 0.22, r * 0.28, -0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#b89068';
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.38, r * 0.32, r * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();

  if (def.id === 'scout') {
    ctx.fillStyle = def.accent;
    ctx.beginPath();
    ctx.moveTo(-r * 0.28, -r * 0.55);
    ctx.lineTo(r * 0.28, -r * 0.55);
    ctx.lineTo(0, -r * 0.95);
    ctx.closePath();
    ctx.fill();
  } else if (def.id === 'soldier' || def.id === 'knight') {
    ctx.fillStyle = def.accent;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.55, r * 0.38, r * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    if (def.id === 'knight') {
      ctx.fillStyle = shade(def.accent, 1.15);
      ctx.beginPath();
      ctx.moveTo(-r * 0.12, -r * 0.7);
      ctx.lineTo(r * 0.12, -r * 0.7);
      ctx.lineTo(0, -r * 1.05);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = shade(def.accent, 0.85);
    ctx.lineWidth = Math.max(1.5, r * (def.id === 'knight' ? 0.2 : 0.16));
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(r * 0.55, -r * 0.1);
    ctx.lineTo(r * 0.55, r * 0.55);
    ctx.stroke();
  } else if (def.id === 'champion') {
    ctx.fillStyle = def.accent;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.55, r * 0.42, r * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shade(def.accent, 0.8);
    ctx.lineWidth = Math.max(2, r * 0.22);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(r * 0.5, -r * 0.2);
    ctx.lineTo(r * 0.75, r * 0.65);
    ctx.stroke();
    ctx.fillStyle = shade(def.accent, 1.1);
    ctx.beginPath();
    ctx.moveTo(r * 0.55, r * 0.55);
    ctx.lineTo(r * 0.95, r * 0.7);
    ctx.lineTo(r * 0.6, r * 0.85);
    ctx.closePath();
    ctx.fill();
  } else if (def.id === 'archer') {
    ctx.fillStyle = def.accent;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.55, r * 0.3, r * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shade(def.accent, 0.95);
    ctx.lineWidth = Math.max(1.5, r * 0.12);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(r * 0.55, r * 0.05, r * 0.42, -1.1, 1.1);
    ctx.stroke();
    ctx.strokeStyle = '#c8b898';
    ctx.lineWidth = Math.max(1, r * 0.06);
    ctx.beginPath();
    ctx.moveTo(r * 0.55 + Math.cos(-1.1) * r * 0.42, r * 0.05 + Math.sin(-1.1) * r * 0.42);
    ctx.lineTo(r * 0.55 + Math.cos(1.1) * r * 0.42, r * 0.05 + Math.sin(1.1) * r * 0.42);
    ctx.stroke();
  } else {
    // Guard shield
    ctx.fillStyle = def.accent;
    ctx.beginPath();
    ctx.moveTo(-r * 0.65, -r * 0.15);
    ctx.lineTo(-r * 0.15, -r * 0.2);
    ctx.lineTo(-r * 0.12, r * 0.35);
    ctx.quadraticCurveTo(-r * 0.4, r * 0.5, -r * 0.65, r * 0.28);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}
