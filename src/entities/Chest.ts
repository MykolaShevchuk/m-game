import { drawChest } from '@/ui/drawChest';
import { Entity } from './Entity';

export const CHEST_SIZE = 30;

export class Chest extends Entity {
  opened = false;

  constructor(x: number, y: number) {
    super(x, y, CHEST_SIZE, CHEST_SIZE * 0.85);
  }

  update() {}

  render(ctx: CanvasRenderingContext2D) {
    drawChest(ctx, this.x, this.y, this.w, this.h, this.opened);
  }
}
