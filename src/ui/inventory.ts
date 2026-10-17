import { CONFIG } from '@/config';
import { RESOURCES, type Inventory } from '@/resources';
import { drawResource } from './drawResource';
import { drawText } from './text';

const SLOT = 86;
const PAD = 14;
const ICON = 36;
const COUNT = 18;

export interface InventoryLayout {
  /** Viewport left edge (for split screen). */
  originX?: number;
  /** Viewport width; defaults to full canvas. */
  viewW?: number;
  viewH?: number;
  /** Scale down icons when the half-screen is narrow. */
  scale?: number;
}

export function inventoryHeight(scale = 1) {
  return ICON * scale + PAD * scale * 2;
}

/** Bottom-left row with every resource type; uncollected ones are dimmed. */
export function drawInventory(ctx: CanvasRenderingContext2D, inventory: Inventory, layout: InventoryLayout = {}) {
  const originX = layout.originX ?? 0;
  const viewW = layout.viewW ?? CONFIG.width;
  const viewH = layout.viewH ?? CONFIG.height;
  const scale = layout.scale ?? 1;
  const slot = SLOT * scale;
  const pad = PAD * scale;
  const icon = ICON * scale;
  const w = Math.min(RESOURCES.length * slot + pad * 2, viewW - 16);
  const h = inventoryHeight(scale);
  const x = originX + 8;
  const y = viewH - h - 12;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12);
  ctx.fill();

  RESOURCES.forEach((r, i) => {
    const count = inventory[r.id];
    const sx = x + pad + i * slot;
    if (sx + icon > x + w) return;
    ctx.globalAlpha = count > 0 ? 1 : 0.35;
    drawResource(ctx, r.id, sx + icon / 2, y + h / 2, icon);
    drawText(ctx, String(count), sx + icon + 8 * scale, y + h / 2 + 1, Math.max(13, COUNT * scale));
    ctx.globalAlpha = 1;
  });
}
