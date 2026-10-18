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

function rgbShade(c: [number, number, number], k: number, a = 1) {
  return `rgba(${Math.round(c[0] * k)}, ${Math.round(c[1] * k)}, ${Math.round(c[2] * k)}, ${a})`;
}

/** Packed-earth market clearing with a worn path and fence posts. */
export function drawVillageGround(ctx: CanvasRenderingContext2D, x: number, y: number, theme: IslandTheme) {
  const cx = x + VILLAGE_W / 2;
  const cy = y + VILLAGE_H * 0.58;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.26)';
  ctx.beginPath();
  ctx.ellipse(cx + 4, cy + 6, 74, 38, -0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = rgbCss(theme.sand, 0.78);
  ctx.beginPath();
  ctx.ellipse(cx, cy, 70, 34, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgbCss(theme.sand, 0.92);
  ctx.beginPath();
  ctx.ellipse(cx - 8, cy - 6, 42, 18, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Cobble flecks
  ctx.fillStyle = rgbShade(theme.rockLow, 0.95, 0.35);
  for (let i = 0; i < 18; i++) {
    const a = i * 2.4;
    const rx = cx + Math.cos(a) * (12 + (i % 5) * 8);
    const ry = cy + Math.sin(a * 1.3) * (6 + (i % 4) * 5);
    ctx.beginPath();
    ctx.ellipse(rx, ry, 3.2, 2.1, a, 0, Math.PI * 2);
    ctx.fill();
  }

  // Path to the stall
  ctx.fillStyle = rgbCss(theme.sand, 0.68);
  ctx.beginPath();
  ctx.ellipse(cx, cy + 10, 11, 22, 0.12, 0, Math.PI * 2);
  ctx.fill();

  // Grass fringe
  ctx.strokeStyle = rgbShade(theme.grass, 0.9, 0.55);
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const px = cx + Math.cos(a) * 66;
    const py = cy + Math.sin(a) * 32;
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(a) * 4, py - 5);
  }
  ctx.stroke();
}

export function drawVillageFence(ctx: CanvasRenderingContext2D, x: number, y: number, theme: IslandTheme) {
  const wood = rgbCss(theme.rockLow, 0.7);
  const posts: [number, number][] = [
    [x + 4, y + 48],
    [x + 22, y + 118],
    [x + 154, y + 46],
    [x + 164, y + 108],
    [x + 88, y + 122],
  ];
  ctx.strokeStyle = rgbShade(theme.rockLow, 0.55, 0.7);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(posts[0][0], posts[0][1] - 6);
  ctx.lineTo(posts[1][0], posts[1][1] - 6);
  ctx.moveTo(posts[2][0], posts[2][1] - 6);
  ctx.lineTo(posts[3][0], posts[3][1] - 6);
  ctx.stroke();
  for (const [px, py] of posts) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(px + 1, py + 2, 3, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = wood;
    ctx.fillRect(px - 1.5, py - 12, 3, 14);
    ctx.fillStyle = rgbShade(theme.rockLow, 0.95, 1);
    ctx.fillRect(px - 2, py - 13, 4, 2);
  }
}

/** Compact painted hut with chimney, windows, and a framed door. */
export function drawVillageHut(ctx: CanvasRenderingContext2D, hut: VillageHut, variant = 0) {
  const { x, y, w, h, wall, roof, trim } = hut;
  const roofH = h * 0.42;
  const bodyY = y + roofH * 0.52;
  const bodyH = h - roofH * 0.52;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(x + w / 2 + 2, y + h * 0.92, w * 0.46, h * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = wall;
  ctx.beginPath();
  ctx.roundRect(x + 2, bodyY, w - 4, bodyH - 2, 3);
  ctx.fill();
  ctx.fillStyle = shade(wall, 1.14);
  ctx.fillRect(x + 3, bodyY + 2, (w - 6) * 0.34, bodyH - 6);
  ctx.fillStyle = shade(wall, 0.82);
  ctx.fillRect(x + w - 6, bodyY + 3, 3, bodyH - 7);

  if (variant % 2 === 0) {
    ctx.fillStyle = shade(wall, 0.88);
    ctx.fillRect(x + w * 0.74, y + 2, 7, bodyY - y + 4);
    ctx.fillStyle = trim;
    ctx.fillRect(x + w * 0.74 - 1, y + 1, 9, 3);
    ctx.fillStyle = 'rgba(90, 90, 90, 0.35)';
    ctx.beginPath();
    ctx.ellipse(x + w * 0.74 + 3.5, y - 1, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(x - 3, bodyY + 4);
  ctx.lineTo(x + w / 2, y - 1);
  ctx.lineTo(x + w + 3, bodyY + 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(roof, 1.22);
  ctx.beginPath();
  ctx.moveTo(x + w * 0.18, bodyY + 3);
  ctx.lineTo(x + w / 2, y + 2);
  ctx.lineTo(x + w / 2 + 1, bodyY + 3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = shade(roof, 0.78);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.18, bodyY + 1);
  ctx.lineTo(x + w / 2, y + 6);
  ctx.moveTo(x + w * 0.82, bodyY + 1);
  ctx.lineTo(x + w / 2, y + 6);
  ctx.stroke();

  const doorW = Math.max(6, w * 0.18);
  const doorH = bodyH * 0.46;
  const doorX = x + w / 2 - doorW / 2;
  const doorY = y + h - doorH - 2;
  ctx.fillStyle = shade(trim, 0.75);
  ctx.fillRect(doorX - 1, doorY - 1, doorW + 2, doorH + 1);
  ctx.fillStyle = trim;
  ctx.fillRect(doorX, doorY, doorW, doorH);
  ctx.fillStyle = shade(trim, 1.25);
  ctx.fillRect(doorX + 1, doorY + 2, 2, doorH - 4);
  ctx.fillStyle = '#c4a574';
  ctx.beginPath();
  ctx.arc(doorX + doorW - 2.5, doorY + doorH * 0.55, 1.1, 0, Math.PI * 2);
  ctx.fill();

  const win = Math.max(3.5, w * 0.11);
  const winY = bodyY + bodyH * 0.26;
  drawWindow(ctx, x + w * 0.16, winY, win, variant === 1);
  drawWindow(ctx, x + w * 0.72 - win, winY, win, variant !== 1);

  if (variant === 2) {
    ctx.fillStyle = '#6a8a48';
    ctx.fillRect(x + 5, y + h - 6, w * 0.22, 4);
    ctx.fillStyle = '#d45a7a';
    ctx.beginPath();
    ctx.arc(x + 9, y + h - 8, 2, 0, Math.PI * 2);
    ctx.arc(x + 14, y + h - 9, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWindow(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, lit: boolean) {
  ctx.fillStyle = '#3a4248';
  ctx.fillRect(x - 1, y - 1, s + 2, s + 2);
  ctx.fillStyle = lit ? '#d4c070' : '#6a8894';
  ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = 'rgba(40, 36, 28, 0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + s / 2, y);
  ctx.lineTo(x + s / 2, y + s);
  ctx.moveTo(x, y + s / 2);
  ctx.lineTo(x + s, y + s / 2);
  ctx.stroke();
}

export function drawVillageStall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  theme: IslandTheme,
  ware: ResourceId,
  extra?: ResourceId,
) {
  const { w, h } = VILLAGE_STALL;
  const canopy = rgbCss(theme.treeColors[0] ?? theme.grass, 0.95);
  const wood = '#6a4a2c';

  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.ellipse(x + w / 2 + 2, y + h, w * 0.46, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = wood;
  ctx.fillRect(x + 4, y + 12, 3.5, h - 14);
  ctx.fillRect(x + w - 8, y + 12, 3.5, h - 14);
  ctx.fillRect(x + 4, y + 12, w - 8, 3);

  // Striped awning
  ctx.beginPath();
  ctx.moveTo(x - 4, y + 16);
  ctx.lineTo(x + w / 2, y - 2);
  ctx.lineTo(x + w + 4, y + 16);
  ctx.closePath();
  ctx.fillStyle = canopy;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(255, 248, 230, 0.28)';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(x - 4 + i * 9, y + 16);
    ctx.lineTo(x + w / 2, y - 2);
    ctx.lineTo(x - 4 + (i + 0.45) * 9, y + 16);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = rgbShade(theme.forest, 0.65, 0.85);
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#8a6238';
  ctx.beginPath();
  ctx.roundRect(x + 1, y + h - 12, w - 2, 10, 2);
  ctx.fill();
  ctx.fillStyle = '#c4a06a';
  ctx.fillRect(x + 2, y + h - 12, w - 4, 3);

  drawCrate(ctx, x - 8, y + h - 10);
  drawCrate(ctx, x + w - 2, y + h - 8);

  drawResource(ctx, ware, x + w * 0.35, y + h - 20, 13);
  if (extra) drawResource(ctx, extra, x + w * 0.68, y + h - 19, 11);

  // Hanging lantern
  ctx.strokeStyle = '#5a4030';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.18, y + 14);
  ctx.lineTo(x + w * 0.18, y + 20);
  ctx.stroke();
  ctx.fillStyle = '#e8c36a';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.18, y + 23, 3, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 210, 80, 0.28)';
  ctx.beginPath();
  ctx.arc(x + w * 0.18, y + 23, 7, 0, Math.PI * 2);
  ctx.fill();
}

function drawCrate(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.beginPath();
  ctx.ellipse(x + 6, y + 8, 6, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8a6238';
  ctx.beginPath();
  ctx.roundRect(x, y, 11, 9, 1);
  ctx.fill();
  ctx.strokeStyle = '#5a3e22';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, 10, 8);
  ctx.beginPath();
  ctx.moveTo(x + 1, y + 4.5);
  ctx.lineTo(x + 10, y + 4.5);
  ctx.stroke();
}

export function drawWell(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.ellipse(x + 1, y + 12, 12, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#8a9094';
  ctx.beginPath();
  ctx.ellipse(x, y + 8, 11, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6a7074';
  ctx.beginPath();
  ctx.ellipse(x, y + 8, 11, 7, 0, Math.PI * 0.55, Math.PI * 1.15);
  ctx.fill();
  ctx.fillStyle = '#9aa0a4';
  ctx.beginPath();
  ctx.ellipse(x - 3, y + 6, 4, 2.4, -0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#2e5470';
  ctx.beginPath();
  ctx.ellipse(x, y + 8, 6, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(150, 200, 220, 0.4)';
  ctx.beginPath();
  ctx.ellipse(x - 1.5, y + 7, 2.6, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#5a4030';
  ctx.fillRect(x - 10, y - 11, 3, 16);
  ctx.fillRect(x + 7, y - 11, 3, 16);
  ctx.fillRect(x - 10, y - 13, 20, 3);
  ctx.strokeStyle = '#c4a574';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, y - 11);
  ctx.lineTo(x, y + 4);
  ctx.stroke();
  ctx.fillStyle = '#6a4a2c';
  ctx.fillRect(x - 3, y + 3, 6, 4);
}

export function drawBarrel(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.beginPath();
  ctx.ellipse(x + 1, y + 8, 6, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7a5230';
  ctx.beginPath();
  ctx.ellipse(x, y, 6, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c4a06a';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(x, y - 1, 5.6, 2.2, 0, 0, Math.PI * 2);
  ctx.ellipse(x, y + 4, 5.4, 2, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = shade('#7a5230', 1.2);
  ctx.beginPath();
  ctx.ellipse(x - 2, y - 2, 2, 3, -0.3, 0, Math.PI * 2);
  ctx.fill();
}

/** Soft silhouette villagers matching troop/character style. */
export function drawVillager(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  shirt: string,
  t: number,
  kind: 'keeper' | 'helper' = 'keeper',
) {
  const bob = Math.sin(t * 2 + x * 0.05) * 1.1;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.ellipse(x + 1, y + 9, 6.5, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.ellipse(x, y + 1.5 + bob, 5.4, 6.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.beginPath();
  ctx.ellipse(x - 1.6, y + bob, 2.2, 3, -0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(40, 36, 28, 0.55)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 5, y + 2 + bob);
  ctx.lineTo(x - 7, y + 6 + bob);
  ctx.moveTo(x + 5, y + 2 + bob);
  ctx.lineTo(x + 7, y + 5 + bob);
  ctx.stroke();

  ctx.fillStyle = '#c4a074';
  ctx.beginPath();
  ctx.ellipse(x, y - 5.6 + bob, 3.6, 3.7, 0, 0, Math.PI * 2);
  ctx.fill();

  if (kind === 'keeper') {
    ctx.fillStyle = '#4a3a28';
    ctx.beginPath();
    ctx.ellipse(x, y - 8.2 + bob, 4.2, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 4.2, y - 8.2 + bob, 8.4, 2);
  } else {
    ctx.fillStyle = '#6a8a48';
    ctx.beginPath();
    ctx.arc(x + 3.5, y - 4 + bob, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawVillageSign(ctx: CanvasRenderingContext2D, x: number, y: number, name: string) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath();
  ctx.ellipse(x, y + 10, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5a4030';
  ctx.fillRect(x - 2, y - 2, 4, 14);
  ctx.fillStyle = '#8a6238';
  ctx.beginPath();
  ctx.roundRect(x - 62, y - 16, 124, 18, 3);
  ctx.fill();
  ctx.strokeStyle = '#5a3e22';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = '#c4a06a';
  ctx.fillRect(x - 58, y - 14, 116, 3);
  drawText(ctx, name, x, y - 6, 11, 'center');
}
