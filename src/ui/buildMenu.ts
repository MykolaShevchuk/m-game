import { BUILD_MENU, canAfford, costList, type BuildingDef } from '@/buildings';
import { CONFIG } from '@/config';
import type { Inventory } from '@/resources';
import { drawResource } from './drawResource';
import { drawText } from './text';

const CARD_W = 118;
const CARD_H = 86;
const GAP = 8;

export interface MenuLayout {
  originX?: number;
  viewW?: number;
  viewH?: number;
  closeHint?: string;
}

export interface MenuCardHit {
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function buildMenuCards(layout: MenuLayout = {}): MenuCardHit[] {
  const originX = layout.originX ?? 0;
  const viewW = layout.viewW ?? CONFIG.width;
  const viewH = layout.viewH ?? CONFIG.height;
  const n = BUILD_MENU.length;
  const maxW = viewW - 16;
  const natural = n * CARD_W + (n - 1) * GAP + 16;
  const scale = Math.min(1, maxW / natural);
  const cardW = CARD_W * scale;
  const gap = GAP * scale;
  const w = n * cardW + (n - 1) * gap + 16 * scale;
  const h = CARD_H * scale + 40 * scale;
  const x = originX + (viewW - w) / 2;
  const y = viewH - h - 12;
  const cardH = CARD_H * scale - 8 * scale;
  return BUILD_MENU.map((_, i) => ({
    index: i,
    x: x + 8 * scale + i * (cardW + gap),
    y: y + 26 * scale,
    w: cardW,
    h: cardH,
  }));
}

export function drawBuildMenu(
  ctx: CanvasRenderingContext2D,
  inventory: Inventory,
  selected: BuildingDef,
  layout: MenuLayout = {},
) {
  const originX = layout.originX ?? 0;
  const viewW = layout.viewW ?? CONFIG.width;
  const viewH = layout.viewH ?? CONFIG.height;
  const n = BUILD_MENU.length;
  const maxW = viewW - 16;
  const natural = n * CARD_W + (n - 1) * GAP + 16;
  const scale = Math.min(1, maxW / natural);
  const cardW = CARD_W * scale;
  const gap = GAP * scale;
  const w = n * cardW + (n - 1) * gap + 16 * scale;
  const h = CARD_H * scale + 40 * scale;
  const x = originX + (viewW - w) / 2;
  const y = viewH - h - 12;
  const close = layout.closeHint ?? 'B to close';
  const touch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  drawText(
    ctx,
    touch ? `Build  ·  tap to place  ·  ${close}` : `Build  ·  1-${n}  ·  Enter  ·  ${close}`,
    originX + viewW / 2,
    y + 14 * scale,
    Math.max(10, 12 * scale),
    'center',
  );

  BUILD_MENU.forEach((b, i) => {
    const cx = x + 8 * scale + i * (cardW + gap);
    const cy = y + 26 * scale;
    const active = b.id === selected.id;
    const ok = canAfford(inventory, b);
    ctx.fillStyle = active ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)';
    ctx.strokeStyle = active ? (ok ? '#81c784' : '#ef5350') : 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = active ? 2 : 1;
    ctx.beginPath();
    ctx.roundRect(cx, cy, cardW, CARD_H * scale - 8 * scale, 8);
    ctx.fill();
    ctx.stroke();

    ctx.globalAlpha = ok ? 1 : 0.45;
    drawText(ctx, `${i + 1}. ${b.name}`, cx + 6 * scale, cy + 14 * scale, Math.max(9, 12 * scale));
    ctx.globalAlpha = ok ? 0.7 : 0.35;
    const effect = b.produces
      ? `${b.effect} (×${b.produces.amount ?? 1}/${b.produces.every}s)`
      : b.effect;
    drawText(ctx, effect, cx + 6 * scale, cy + 30 * scale, Math.max(8, 10 * scale));
    costList(b).forEach(([id, n], k) => {
      const ix = cx + 10 * scale + k * 32 * scale;
      const iy = cy + 44 * scale;
      drawResource(ctx, id, ix, iy, 14 * scale);
      drawText(ctx, String(n), ix + 10 * scale, iy + 1, Math.max(9, 11 * scale));
    });
    ctx.globalAlpha = 1;
  });
}
