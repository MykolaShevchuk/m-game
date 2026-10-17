import type { Point } from '@/core/Input';

export function pointIn(p: Point, x: number, y: number, w: number, h: number) {
  return p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
}

/** Index of the first card whose rect contains the point, or -1. */
export function hitCardIndex(
  p: Point,
  count: number,
  cardW: number,
  cardH: number,
  gap: number,
  startX: number,
  y: number,
): number {
  for (let i = 0; i < count; i++) {
    const x = startX + i * (cardW + gap);
    if (pointIn(p, x, y, cardW, cardH)) return i;
  }
  return -1;
}
