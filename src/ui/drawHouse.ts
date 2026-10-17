import type { BuildingDef } from '@/buildings';

/** Draws a house with its footprint top-left at (x, y). */
export function drawHouse(ctx: CanvasRenderingContext2D, def: BuildingDef, x: number, y: number, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  const { w, h } = def;
  const roofH = h * 0.42;
  const bodyY = y + roofH * 0.55;
  const bodyH = h - roofH * 0.55;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.ellipse(x + w / 2 + 4, y + h * 0.9, w * 0.48, h * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = def.wall;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x + 2, bodyY, w - 4, bodyH - 2, 3);
  ctx.fill();
  ctx.stroke();

  if (def.id === 'emberKeep') drawBattlements(ctx, x + 2, bodyY, w - 4, def.trim);
  if (def.id === 'cottage') drawChimney(ctx, x + w * 0.78, y + 4, def.wall, def.trim);
  if (def.id === 'crystalLodge') drawCrystals(ctx, x + w / 2, y + 6, def.trim);

  ctx.fillStyle = def.roof;
  ctx.beginPath();
  ctx.moveTo(x - 3, bodyY + 4);
  ctx.lineTo(x + w / 2, y);
  ctx.lineTo(x + w + 3, bodyY + 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.18, bodyY);
  ctx.lineTo(x + w / 2, y + 4);
  ctx.lineTo(x + w / 2, bodyY);
  ctx.closePath();
  ctx.fill();

  const doorW = Math.max(6, w * 0.18);
  const doorH = bodyH * 0.45;
  ctx.fillStyle = def.trim;
  ctx.fillRect(x + w / 2 - doorW / 2, y + h - doorH - 2, doorW, doorH);
  ctx.strokeRect(x + w / 2 - doorW / 2, y + h - doorH - 2, doorW, doorH);

  const win = Math.max(5, w * 0.12);
  ctx.fillStyle = def.id === 'emberKeep' ? '#ffb14a' : '#9fd8ef';
  ctx.fillRect(x + w * 0.18, bodyY + bodyH * 0.28, win, win);
  ctx.fillRect(x + w * 0.72 - win, bodyY + bodyH * 0.28, win, win);
  ctx.strokeRect(x + w * 0.18, bodyY + bodyH * 0.28, win, win);
  ctx.strokeRect(x + w * 0.72 - win, bodyY + bodyH * 0.28, win, win);

  ctx.restore();
}

function drawChimney(ctx: CanvasRenderingContext2D, x: number, y: number, wall: string, trim: string) {
  ctx.fillStyle = wall;
  ctx.fillRect(x, y, 8, 16);
  ctx.strokeRect(x, y, 8, 16);
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
  ctx.moveTo(x, y - 8);
  ctx.lineTo(x + 5, y + 2);
  ctx.lineTo(x - 5, y + 2);
  ctx.closePath();
  ctx.fill();
}
