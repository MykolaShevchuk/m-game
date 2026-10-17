import { CONFIG } from '@/config';
import { RESOURCES, type Inventory } from '@/resources';
import { drawResource } from './drawResource';
import { drawText } from './text';

const SLOT = 52;
const PAD = 8;
const ICON = 20;

/** Bottom-left row with every resource type; uncollected ones are dimmed. */
export function drawInventory(ctx: CanvasRenderingContext2D, inventory: Inventory) {
  const w = RESOURCES.length * SLOT + PAD;
  const h = ICON + PAD * 2;
  const x = 12;
  const y = CONFIG.height - h - 12;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();

  RESOURCES.forEach((r, i) => {
    const count = inventory[r.id];
    const sx = x + PAD + i * SLOT;
    ctx.globalAlpha = count > 0 ? 1 : 0.35;
    drawResource(ctx, r.id, sx + ICON / 2, y + h / 2, ICON);
    drawText(ctx, String(count), sx + ICON + 5, y + h / 2 + 1, 14);
    ctx.globalAlpha = 1;
  });
}
