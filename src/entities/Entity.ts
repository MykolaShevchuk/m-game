import type { Rect } from '@/core/math';

export abstract class Entity implements Rect {
  alive = true;

  constructor(
    public x: number,
    public y: number,
    public w: number,
    public h: number,
  ) {}

  abstract update(dt: number): void;
  abstract render(ctx: CanvasRenderingContext2D): void;
}
