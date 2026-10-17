import type { TroopDef } from '@/troops';

function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * k)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * k)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * k)));
  return `rgb(${r},${g},${b})`;
}

/** Soft prop-style troop — matches terrain / character silhouettes. */
export function drawTroop(ctx: CanvasRenderingContext2D, def: TroopDef, cx: number, cy: number, size: number) {
  const r = size / 2;
  ctx.save();

  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.85, r * 0.75, r * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = def.color;
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.15, r * 0.55, r * 0.58, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(def.color, 1.2);
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.12, cy + r * 0.05, r * 0.22, r * 0.28, -0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#b89068';
  ctx.beginPath();
  ctx.ellipse(cx, cy - r * 0.38, r * 0.32, r * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();

  if (def.id === 'scout') {
    ctx.fillStyle = def.accent;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.28, cy - r * 0.55);
    ctx.lineTo(cx + r * 0.28, cy - r * 0.55);
    ctx.lineTo(cx, cy - r * 0.95);
    ctx.closePath();
    ctx.fill();
  } else if (def.id === 'soldier') {
    ctx.fillStyle = def.accent;
    ctx.beginPath();
    ctx.ellipse(cx, cy - r * 0.55, r * 0.38, r * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shade(def.accent, 0.85);
    ctx.lineWidth = Math.max(1.5, r * 0.16);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.55, cy - r * 0.1);
    ctx.lineTo(cx + r * 0.55, cy + r * 0.55);
    ctx.stroke();
  } else {
    ctx.fillStyle = def.accent;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.65, cy - r * 0.15);
    ctx.lineTo(cx - r * 0.15, cy - r * 0.2);
    ctx.lineTo(cx - r * 0.12, cy + r * 0.35);
    ctx.quadraticCurveTo(cx - r * 0.4, cy + r * 0.5, cx - r * 0.65, cy + r * 0.28);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}
