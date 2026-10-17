import type { TroopDef } from '@/troops';

/** Draws a troop centered on (cx, cy). */
export function drawTroop(ctx: CanvasRenderingContext2D, def: TroopDef, cx: number, cy: number, size: number) {
  const r = size / 2;
  ctx.save();
  ctx.lineWidth = Math.max(1, size / 14);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';

  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.85, r * 0.85, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = def.color;
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.15, r * 0.65, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f1c9a0';
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.4, r * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (def.id === 'scout') {
    ctx.fillStyle = def.accent;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.35, cy - r * 0.55);
    ctx.lineTo(cx + r * 0.35, cy - r * 0.55);
    ctx.lineTo(cx, cy - r * 1.05);
    ctx.closePath();
    ctx.fill();
  } else if (def.id === 'soldier') {
    ctx.fillStyle = def.accent;
    ctx.fillRect(cx - r * 0.55, cy - r * 0.55, r * 1.1, r * 0.22);
    ctx.strokeStyle = def.accent;
    ctx.lineWidth = Math.max(1.5, r * 0.18);
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.7, cy - r * 0.2);
    ctx.lineTo(cx + r * 0.7, cy + r * 0.7);
    ctx.stroke();
  } else {
    ctx.fillStyle = def.accent;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.7, cy - r * 0.15);
    ctx.lineTo(cx - r * 0.15, cy - r * 0.15);
    ctx.lineTo(cx - r * 0.15, cy + r * 0.35);
    ctx.quadraticCurveTo(cx - r * 0.4, cy + r * 0.55, cx - r * 0.7, cy + r * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.lineWidth = Math.max(1, size / 14);
    ctx.stroke();
  }

  ctx.restore();
}
