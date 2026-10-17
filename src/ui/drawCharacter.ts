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

  if (def.id === 'wizard') drawStaff(ctx, cx + r * 0.85, cy, r, def.accent);

  ctx.fillStyle = def.id === 'alien' ? def.accent : def.color;
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.2, r * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const headY = cy - r * 0.45;
  const headR = r * 0.38;

  if (def.id === 'alien') {
    drawAlienHead(ctx, cx, headY - r * 0.1, headR * 1.25, def.color);
    ctx.restore();
    return;
  }

  ctx.fillStyle = def.id === 'knight' ? def.color : '#f1c9a0';
  ctx.beginPath();
  ctx.arc(cx, headY, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (def.id === 'knight') {
    drawVisor(ctx, cx, headY, headR);
    drawShield(ctx, cx - r * 0.75, cy + r * 0.2, r, def.accent);
  }
  if (def.id === 'wizard') {
    drawBeard(ctx, cx, headY, headR);
    drawHat(ctx, cx, headY, headR, def.color, def.accent);
  }

  ctx.restore();
}

function drawAlienHead(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, skin: string) {
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
  for (const side of [-1, 1]) {
    const tipX = x + side * r * 0.9;
    const tipY = y - r * 1.9;
    ctx.beginPath();
    ctx.moveTo(x + side * r * 0.35, y - r * 0.8);
    ctx.quadraticCurveTo(x + side * r * 0.5, y - r * 1.6, tipX, tipY);
    ctx.stroke();
    ctx.fillStyle = '#ff5cf0';
    ctx.shadowColor = '#ff5cf0';
    ctx.shadowBlur = r * 0.6;
    ctx.beginPath();
    ctx.arc(tipX, tipY, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.15, r * 1.05, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#0e0e14';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + side * r * 0.45, y + r * 0.1, r * 0.38, r * 0.22, side * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + side * r * 0.45 - r * 0.1, y + r * 0.02, r * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBeard(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.fillStyle = '#eef0f2';
  ctx.beginPath();
  ctx.moveTo(x - r * 0.85, y + r * 0.05);
  ctx.quadraticCurveTo(x - r * 0.6, y + r * 1.4, x, y + r * 1.9);
  ctx.quadraticCurveTo(x + r * 0.6, y + r * 1.4, x + r * 0.85, y + r * 0.05);
  ctx.quadraticCurveTo(x, y + r * 0.45, x - r * 0.85, y + r * 0.05);
  ctx.fill();
  ctx.stroke();
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

function drawHat(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, star: string) {
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
  ctx.fillStyle = star;
  for (const [sx, sy, s] of [
    [-0.25, -1.0, 0.18],
    [0.25, -1.5, 0.13],
  ]) {
    drawStar(ctx, x + sx * r, y + sy * r, s * r);
  }
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
  ctx.fill();
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
