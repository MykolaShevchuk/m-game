import { CHEST_SIZE } from '@/chests';
import { drawChest } from '@/ui/drawChest';
import { Entity } from './Entity';

export { CHEST_SIZE };

export class Chest extends Entity {
  opened = false;
  /** Server id when playing online. */
  netId?: number;

  constructor(x: number, y: number) {
    super(x, y, CHEST_SIZE, CHEST_SIZE * 0.85);
  }

  update() {}

  render(ctx: CanvasRenderingContext2D) {
    drawChest(ctx, this.x, this.y, this.w, this.h, this.opened);
  }
}
