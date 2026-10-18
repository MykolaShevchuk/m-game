import { CONFIG } from '@/config';
import type { Inventory } from '@/resources';
import { canAffordTroop, troopCostList, type TroopDef } from '@/troops';
import { drawResource } from './drawResource';
import { drawText } from './text';
import { drawTroop } from './drawTroop';
import type { MenuCardHit, MenuLayout } from './buildMenu';

const CARD_W = 140;
const CARD_H = 120;
const GAP = 10;

export function troopMenuCards(troops: TroopDef[], layout: MenuLayout = {}): MenuCardHit[] {
  const originX = layout.originX ?? 0;
  const viewW = layout.viewW ?? CONFIG.width;
  const viewH = layout.viewH ?? CONFIG.height;
  const n = Math.max(1, troops.length);
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
  return troops.map((_, i) => ({
    index: i,
    x: x + 8 * scale + i * (cardW + gap),
    y: y + 26 * scale,
    w: cardW,
    h: cardH,
  }));
}

export function drawTroopMenu(
  ctx: CanvasRenderingContext2D,
  inventory: Inventory,
  troops: TroopDef[],
  selected: TroopDef,
  layout: MenuLayout = {},
) {
  const originX = layout.originX ?? 0;
  const viewW = layout.viewW ?? CONFIG.width;
  const viewH = layout.viewH ?? CONFIG.height;
  const n = Math.max(1, troops.length);
  const maxW = viewW - 16;
  const natural = n * CARD_W + (n - 1) * GAP + 16;
  const scale = Math.min(1, maxW / natural);
  const cardW = CARD_W * scale;
  const gap = GAP * scale;
  const w = n * cardW + (n - 1) * gap + 16 * scale;
  const h = CARD_H * scale + 40 * scale;
  const x = originX + (viewW - w) / 2;
  const y = viewH - h - 12;
  const close = layout.closeHint ?? 'F to close';
  const touch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  drawText(
    ctx,
    touch
      ? `Recruit  ·  tap to hire  ·  ${close}`
      : `Recruit  ·  1-${troops.length}  ·  Enter  ·  ${close}`,
    originX + viewW / 2,
    y + 14 * scale,
    Math.max(10, 12 * scale),
    'center',
  );

  troops.forEach((t, i) => {
    const cx = x + 8 * scale + i * (cardW + gap);
    const cy = y + 26 * scale;
    const active = t.id === selected.id;
    const ok = canAffordTroop(inventory, t);
    ctx.fillStyle = active ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)';
    ctx.strokeStyle = active ? (ok ? '#81c784' : '#ef5350') : 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = active ? 2 : 1;
    ctx.beginPath();
    ctx.roundRect(cx, cy, cardW, CARD_H * scale - 8 * scale, 8);
    ctx.fill();
    ctx.stroke();

    ctx.globalAlpha = ok ? 1 : 0.45;
    drawTroop(ctx, t, cx + cardW / 2, cy + 24 * scale, 20 * scale);
    drawText(ctx, `${i + 1}. ${t.name}`, cx + cardW / 2, cy + 48 * scale, Math.max(10, 12 * scale), 'center');
    ctx.globalAlpha = ok ? 0.75 : 0.35;
    drawText(ctx, t.description, cx + cardW / 2, cy + 64 * scale, Math.max(9, 10 * scale), 'center');
    ctx.globalAlpha = ok ? 1 : 0.45;
    troopCostList(t).forEach(([id, n], k) => {
      const count = troopCostList(t).length;
      const ix = cx + cardW / 2 - (count - 1) * 16 * scale + k * 32 * scale;
      const iy = cy + 84 * scale;
      drawResource(ctx, id, ix - 6 * scale, iy, 12 * scale);
      drawText(ctx, String(n), ix + 5 * scale, iy + 1, Math.max(9, 11 * scale));
    });
    ctx.globalAlpha = 1;
  });
}
