import { VILLAGE_H, VILLAGE_STALL, VILLAGE_W, rgbCss, type VillageHut } from '@/villages';
import type { ResourceId } from '@/resources';
import type { IslandTheme } from '@/world/themes';
import { drawResource } from './drawResource';
import { drawText } from './text';

function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * k)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * k)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * k)));
  return `rgb(${r},${g},${b})`;
}

/** Soft packed-earth clearing, same language as terrain props. */
export function drawVillageGround(ctx: CanvasRenderingContext2D, x: number, y: number, theme: IslandTheme) {
  const cx = x + VILLAGE_W / 2;
  const cy = y + VILLAGE_H * 0.58;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.beginPath();
  ctx.ellipse(cx + 3, cy + 4, 62, 30, -0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = rgbCss(theme.sand, 0.88);
  ctx.beginPath();
  ctx.ellipse(cx, cy, 58, 27, -0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = rgbCss(theme.sand, 1.08);
  ctx.beginPath();
  ctx.ellipse(cx - 14, cy - 4, 22, 10, 0.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = rgbCss(theme.dry, 0.85);
  ctx.beginPath();
  ctx.ellipse(cx + 16, cy + 6, 16, 7, -0.25, 0, Math.PI * 2);
  ctx.fill();

  // Worn path toward the stall.
  ctx.fillStyle = rgbCss(theme.sand, 0.72);
  ctx.beginPath();
  ctx.ellipse(cx, cy + 8, 10, 18, 0.15, 0, Math.PI * 2);
  ctx.fill();
}

/** Compact painted hut — soft fills like player buildings / terrain. */
export function drawVillageHut(ctx: CanvasRenderingContext2D, hut: VillageHut) {
  const { x, y, w, h, wall, roof, trim } = hut;
  const roofH = h * 0.4;
  const bodyY = y + roofH * 0.55;
  const bodyH = h - roofH * 0.55;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.ellipse(x + w / 2 + 1, y + h * 0.9, w * 0.42, h * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = wall;
  ctx.beginPath();
  ctx.roundRect(x + 2, bodyY, w - 4, bodyH - 2, 2);
  ctx.fill();
  ctx.fillStyle = shade(wall, 1.12);
  ctx.fillRect(x + 3, bodyY + 2, (w - 6) * 0.32, bodyH - 6);

  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(x - 1, bodyY + 3);
  ctx.lineTo(x + w / 2, y);
  ctx.lineTo(x + w + 1, bodyY + 3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(roof, 1.18);
  ctx.beginPath();
  ctx.moveTo(x + w * 0.22, bodyY + 2);
  ctx.lineTo(x + w / 2, y + 3);
  ctx.lineTo(x + w / 2, bodyY + 2);
  ctx.closePath();
  ctx.fill();

  const doorW = Math.max(5, w * 0.18);
  const doorH = bodyH * 0.42;
  ctx.fillStyle = trim;
  ctx.fillRect(x + w / 2 - doorW / 2, y + h - doorH - 2, doorW, doorH);

  const win = Math.max(3, w * 0.1);
  ctx.fillStyle = '#7a9aa8';
  ctx.fillRect(x + w * 0.18, bodyY + bodyH * 0.28, win, win);
}

export function drawVillageStall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  theme: IslandTheme,
  ware: ResourceId,
) {
  const { w, h } = VILLAGE_STALL;
  const canopy = rgbCss(theme.treeColors[0] ?? theme.grass, 0.95);
  const wood = '#6a4a2c';

  ctx.fillStyle = 'rgba(0, 0, 0, 0.26)';
  ctx.beginPath();
  ctx.ellipse(x + w / 2 + 1, y + h - 1, w * 0.4, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Posts
  ctx.fillStyle = wood;
  ctx.fillRect(x + 5, y + 14, 3.5, h - 16);
  ctx.fillRect(x + w - 8.5, y + 14, 3.5, h - 16);

  // Soft canopy lobes
  ctx.fillStyle = canopy;
  ctx.beginPath();
  ctx.ellipse(x + w * 0.28, y + 10, w * 0.32, 8, -0.15, 0, Math.PI * 2);
  ctx.ellipse(x + w * 0.72, y + 10, w * 0.32, 8, 0.15, 0, Math.PI * 2);
  ctx.ellipse(x + w * 0.5, y + 6, w * 0.38, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgbCss(theme.treeColors[0] ?? theme.grass, 1.2);
  ctx.beginPath();
  ctx.ellipse(x + w * 0.42, y + 4, w * 0.2, 4, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // Counter
  ctx.fillStyle = '#8a6238';
  ctx.beginPath();
  ctx.roundRect(x + 2, y + h - 11, w - 4, 9, 2);
  ctx.fill();
  ctx.fillStyle = shade('#8a6238', 1.15);
  ctx.fillRect(x + 3, y + h - 10, w - 6, 3);

  drawResource(ctx, ware, x + w / 2, y + h - 20, 13);
}

export function drawWell(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.ellipse(x + 1, y + 11, 11, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#8a9094';
  ctx.beginPath();
  ctx.ellipse(x, y + 7, 10, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade('#8a9094', 1.15);
  ctx.beginPath();
  ctx.ellipse(x - 2, y + 5, 4, 2.5, -0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#3a5870';
  ctx.beginPath();
  ctx.ellipse(x, y + 7, 5.5, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(120, 170, 190, 0.35)';
  ctx.beginPath();
  ctx.ellipse(x - 1, y + 6, 2.5, 1.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Soft wooden frame
  ctx.fillStyle = '#5a4030';
  ctx.fillRect(x - 9, y - 10, 3, 14);
  ctx.fillRect(x + 6, y - 10, 3, 14);
  ctx.fillRect(x - 9, y - 12, 18, 3);
}

/** Soft silhouette villagers matching troop/character style. */
export function drawVillager(ctx: CanvasRenderingContext2D, x: number, y: number, shirt: string, t: number) {
  const bob = Math.sin(t * 2 + x * 0.05) * 1.1;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.ellipse(x + 1, y + 9, 6.5, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.ellipse(x, y + 1.5 + bob, 5.2, 6.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.beginPath();
  ctx.ellipse(x - 1.5, y + bob, 2.2, 3, -0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#b89068';
  ctx.beginPath();
  ctx.ellipse(x, y - 5.5 + bob, 3.5, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.beginPath();
  ctx.ellipse(x - 1, y - 6.5 + bob, 1.4, 1.2, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawVillageSign(ctx: CanvasRenderingContext2D, x: number, y: number, name: string) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.roundRect(x - 66, y - 9, 132, 18, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.beginPath();
  ctx.roundRect(x - 64, y - 8, 128, 7, 4);
  ctx.fill();
  drawText(ctx, name, x, y + 1, 11, 'center');
}
