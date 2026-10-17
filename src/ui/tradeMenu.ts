import { CONFIG } from '@/config';
import { RESOURCE_BY_ID, type Inventory } from '@/resources';
import { canAffordOffer, type TradeOffer } from '@/villages';
import type { MenuCardHit, MenuLayout } from './buildMenu';
import { drawResource } from './drawResource';
import { drawText } from './text';

const CARD_W = 150;
const CARD_H = 108;
const GAP = 10;

export function tradeMenuCards(count: number, layout: MenuLayout = {}): MenuCardHit[] {
  const originX = layout.originX ?? 0;
  const viewW = layout.viewW ?? CONFIG.width;
  const viewH = layout.viewH ?? CONFIG.height;
  const n = count;
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
  return Array.from({ length: n }, (_, i) => ({
    index: i,
    x: x + 8 * scale + i * (cardW + gap),
    y: y + 26 * scale,
    w: cardW,
    h: cardH,
  }));
}

export function drawTradeMenu(
  ctx: CanvasRenderingContext2D,
  inventory: Inventory,
  offers: TradeOffer[],
  selected: number,
  title: string,
  layout: MenuLayout = {},
) {
  const originX = layout.originX ?? 0;
  const viewW = layout.viewW ?? CONFIG.width;
  const viewH = layout.viewH ?? CONFIG.height;
  const n = offers.length;
  const maxW = viewW - 16;
  const natural = n * CARD_W + (n - 1) * GAP + 16;
  const scale = Math.min(1, maxW / Math.max(1, natural));
  const cardW = CARD_W * scale;
  const gap = GAP * scale;
  const w = n * cardW + (n - 1) * gap + 16 * scale;
  const h = CARD_H * scale + 40 * scale;
  const x = originX + (viewW - w) / 2;
  const y = viewH - h - 12;
  const close = layout.closeHint ?? 'F to close';
  const touch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.58)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  drawText(
    ctx,
    touch ? `${title}  ·  tap to trade  ·  ${close}` : `${title}  ·  1-${n}  ·  Enter  ·  ${close}`,
    originX + viewW / 2,
    y + 14 * scale,
    Math.max(11, 13 * scale),
    'center',
  );

  const cards = tradeMenuCards(n, layout);
  offers.forEach((offer, i) => {
    const card = cards[i];
    const ok = canAffordOffer(inventory, offer);
    ctx.fillStyle = i === selected ? 'rgba(255, 213, 79, 0.18)' : 'rgba(255, 255, 255, 0.06)';
    ctx.strokeStyle = i === selected ? '#ffd54f' : 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = i === selected ? 2 : 1;
    ctx.beginPath();
    ctx.roundRect(card.x, card.y, card.w, card.h, 8);
    ctx.fill();
    ctx.stroke();

    ctx.globalAlpha = ok ? 1 : 0.4;
    const cx = card.x + card.w / 2;
    drawResource(ctx, offer.giveId, cx - 22 * scale, card.y + 28 * scale, 22 * scale);
    drawText(ctx, `×${offer.giveN}`, cx + 8 * scale, card.y + 28 * scale, Math.max(12, 14 * scale));
    drawText(ctx, '↓', cx, card.y + 50 * scale, Math.max(12, 16 * scale), 'center');
    drawResource(ctx, offer.getId, cx - 22 * scale, card.y + 72 * scale, 22 * scale);
    drawText(ctx, `×${offer.getN}`, cx + 8 * scale, card.y + 72 * scale, Math.max(12, 14 * scale));
    ctx.globalAlpha = 1;
    const stock = offer.stock > 0 ? `${offer.stock} left` : 'sold out';
    ctx.globalAlpha = 0.8;
    drawText(
      ctx,
      ok ? stock : offer.stock <= 0 ? 'sold out' : `need ${RESOURCE_BY_ID[offer.giveId].name}`,
      cx,
      card.y + card.h - 10 * scale,
      Math.max(9, 11 * scale),
      'center',
    );
    ctx.globalAlpha = 1;
  });
}
