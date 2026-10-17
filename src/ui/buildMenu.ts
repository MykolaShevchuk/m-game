import { BUILDINGS, canAfford, costList, type BuildingDef } from '@/buildings';
import { CONFIG } from '@/config';
import type { Inventory } from '@/resources';
import { drawResource } from './drawResource';
import { drawText } from './text';

const CARD_W = 118;
const CARD_H = 86;
const GAP = 8;

export function drawBuildMenu(ctx: CanvasRenderingContext2D, inventory: Inventory, selected: BuildingDef) {
  const n = BUILDINGS.length;
  const w = n * CARD_W + (n - 1) * GAP + 16;
  const h = CARD_H + 40;
  const x = (CONFIG.width - w) / 2;
  const y = CONFIG.height - h - 12;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  drawText(ctx, 'Build  ·  1-5 to choose  ·  Enter to place  ·  B to close', CONFIG.width / 2, y + 16, 13, 'center');

  BUILDINGS.forEach((b, i) => {
    const cx = x + 8 + i * (CARD_W + GAP);
    const cy = y + 28;
    const active = b.id === selected.id;
    const ok = canAfford(inventory, b);
    ctx.fillStyle = active ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)';
    ctx.strokeStyle = active ? (ok ? '#81c784' : '#ef5350') : 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = active ? 2 : 1;
    ctx.beginPath();
    ctx.roundRect(cx, cy, CARD_W, CARD_H - 8, 8);
    ctx.fill();
    ctx.stroke();

    ctx.globalAlpha = ok ? 1 : 0.45;
    drawText(ctx, `${i + 1}. ${b.name}`, cx + 8, cy + 16, 13);
    costList(b).forEach(([id, n], k) => {
      const ix = cx + 12 + k * 36;
      const iy = cy + 48;
      drawResource(ctx, id, ix, iy, 16);
      drawText(ctx, String(n), ix + 12, iy + 1, 12);
    });
    ctx.globalAlpha = 1;
  });
}
