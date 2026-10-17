import type { CharacterDef } from '@/characters';

/** Draws a character centered on (cx, cy); `size` is the overall body diameter. */
export function drawCharacter(ctx: CanvasRenderingContext2D, def: CharacterDef, cx: number, cy: number, size: number) {
  const r = size / 2;
  ctx.save();
  ctx.lineWidth = Math.max(1, size / 16);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';

  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.85, r * 0.9, r * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  if (def.id === 'mage') drawStaff(ctx, cx + r * 0.85, cy, r, def.accent);
  if (def.id === 'scout') drawBow(ctx, cx + r * 0.8, cy, r);

  ctx.fillStyle = def.color;
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.2, r * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const headY = cy - r * 0.45;
  const headR = r * 0.38;
  ctx.fillStyle = def.id === 'knight' ? def.color : '#f1c9a0';
  ctx.beginPath();
  ctx.arc(cx, headY, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (def.id === 'scout') drawHood(ctx, cx, headY, headR, def.accent);
  if (def.id === 'knight') {
    drawVisor(ctx, cx, headY, headR);
    drawShield(ctx, cx - r * 0.75, cy + r * 0.2, r, def.accent);
  }
  if (def.id === 'mage') drawHat(ctx, cx, headY, headR, def.color);

  ctx.restore();
}

function drawHood(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.15, Math.PI * 0.95, Math.PI * 2.05);
  ctx.lineTo(x + r * 0.2, y - r * 1.6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawBow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.strokeStyle = '#7a4a22';
  ctx.lineWidth = Math.max(1.5, r / 6);
  ctx.beginPath();
  ctx.arc(x - r * 0.4, y, r * 0.8, -Math.PI / 2.4, Math.PI / 2.4);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.4 + Math.cos(-Math.PI / 2.4) * r * 0.8, y + Math.sin(-Math.PI / 2.4) * r * 0.8);
  ctx.lineTo(x - r * 0.4 + Math.cos(Math.PI / 2.4) * r * 0.8, y + Math.sin(Math.PI / 2.4) * r * 0.8);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
}

function drawVisor(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.fillStyle = '#1b1d22';
  ctx.fillRect(x - r * 0.65, y - r * 0.12, r * 1.3, r * 0.28);
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.moveTo(x - r * 0.15, y - r);
  ctx.lineTo(x + r * 0.15, y - r);
  ctx.lineTo(x, y - r * 1.7);
  ctx.closePath();
  ctx.fill();
}

function drawShield(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const w = r * 0.75;
  const h = r * 0.95;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y - h / 2);
  ctx.lineTo(x + w / 2, y - h / 2);
  ctx.lineTo(x + w / 2, y + h * 0.1);
  ctx.quadraticCurveTo(x + w / 2, y + h / 2, x, y + h * 0.6);
  ctx.quadraticCurveTo(x - w / 2, y + h / 2, x - w / 2, y + h * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f1f1f1';
  ctx.fillRect(x - w * 0.08, y - h * 0.38, w * 0.16, h * 0.8);
  ctx.fillRect(x - w * 0.35, y - h * 0.12, w * 0.7, h * 0.16);
}

function drawHat(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y - r * 0.55, r * 1.35, r * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - r * 0.8, y - r * 0.6);
  ctx.lineTo(x + r * 0.8, y - r * 0.6);
  ctx.lineTo(x + r * 0.4, y - r * 2.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawStaff(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, glow: string) {
  ctx.strokeStyle = '#6b4423';
  ctx.lineWidth = Math.max(1.5, r / 7);
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.9);
  ctx.lineTo(x, y - r * 1.1);
  ctx.stroke();
  ctx.fillStyle = glow;
  ctx.shadowColor = glow;
  ctx.shadowBlur = r * 0.8;
  ctx.beginPath();
  ctx.arc(x, y - r * 1.2, r * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
}
