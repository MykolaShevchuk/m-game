import type { BuildingDef } from '@/buildings';

/** Soft painted house — same flat fills / soft shadow as terrain props. */
export function drawHouse(ctx: CanvasRenderingContext2D, def: BuildingDef, x: number, y: number, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  const { w, h } = def;
  const roofH = h * 0.4;
  const bodyY = y + roofH * 0.55;
  const bodyH = h - roofH * 0.55;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.ellipse(x + w / 2 + 2, y + h * 0.92, w * 0.45, h * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = def.wall;
  ctx.beginPath();
  ctx.roundRect(x + 2, bodyY, w - 4, bodyH - 2, 2);
  ctx.fill();
  ctx.fillStyle = shade(def.wall, 1.15);
  ctx.fillRect(x + 4, bodyY + 2, (w - 8) * 0.35, bodyH - 6);

  if (def.id === 'emberKeep') drawBattlements(ctx, x + 2, bodyY, w - 4, def.trim);
  if (def.id === 'cottage') drawChimney(ctx, x + w * 0.78, y + 4, def.wall, def.trim);
  if (def.id === 'crystalLodge') drawCrystals(ctx, x + w / 2, y + 6, def.trim);
  if (def.id === 'barracks') drawBanner(ctx, x + w * 0.82, bodyY - 2, def.trim);

  ctx.fillStyle = def.roof;
  ctx.beginPath();
  ctx.moveTo(x - 2, bodyY + 3);
  ctx.lineTo(x + w / 2, y);
  ctx.lineTo(x + w + 2, bodyY + 3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(def.roof, 1.2);
  ctx.beginPath();
  ctx.moveTo(x + w * 0.2, bodyY + 2);
  ctx.lineTo(x + w / 2, y + 4);
  ctx.lineTo(x + w / 2, bodyY + 2);
  ctx.closePath();
  ctx.fill();

  const doorW = Math.max(6, w * 0.16);
  const doorH = bodyH * 0.45;
  ctx.fillStyle = def.trim;
  ctx.fillRect(x + w / 2 - doorW / 2, y + h - doorH - 2, doorW, doorH);

  const win = Math.max(4, w * 0.1);
  const winY = bodyY + bodyH * 0.28;
  const winColor = def.id === 'emberKeep' ? '#a88850' : '#7a9aa8';
  ctx.fillStyle = winColor;
  ctx.fillRect(x + w * 0.18, winY, win, win);
  ctx.fillRect(x + w * 0.72 - win, winY, win, win);

  ctx.restore();
}

function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * k)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * k)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * k)));
  return `rgb(${r},${g},${b})`;
}

function drawChimney(ctx: CanvasRenderingContext2D, x: number, y: number, wall: string, trim: string) {
  ctx.fillStyle = shade(wall, 0.9);
  ctx.fillRect(x, y, 8, 16);
  ctx.fillStyle = trim;
  ctx.fillRect(x - 1, y, 10, 4);
}

function drawBattlements(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, color: string) {
  ctx.fillStyle = color;
  const n = 5;
  const tw = w / (n * 2);
  for (let i = 0; i < n; i++) ctx.fillRect(x + i * tw * 2, y - 5, tw, 6);
}

function drawCrystals(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - 7);
  ctx.lineTo(x + 4, y + 2);
  ctx.lineTo(x - 4, y + 2);
  ctx.closePath();
  ctx.fill();
}

function drawBanner(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.strokeStyle = '#4a3a28';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + 28);
  ctx.lineTo(x, y - 14);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - 14);
  ctx.lineTo(x + 12, y - 6);
  ctx.lineTo(x, y + 2);
  ctx.closePath();
  ctx.fill();
}
