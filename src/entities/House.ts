import type { BuildingDef } from '@/buildings';
import { drawHouse } from '@/ui/drawHouse';
import { Entity } from './Entity';

export class House extends Entity {
  constructor(
    x: number,
    y: number,
    readonly def: BuildingDef,
  ) {
    super(x, y, def.w, def.h);
  }

  update() {}

  render(ctx: CanvasRenderingContext2D) {
    drawHouse(ctx, this.def, this.x, this.y);
  }
}
