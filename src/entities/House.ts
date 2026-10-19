import type { BuildingDef } from '@/buildings';
import type { ResourceId } from '@/resources';
import { drawHouse } from '@/ui/drawHouse';
import { Entity } from './Entity';

export class House extends Entity {
  /** Seconds elapsed toward the next production tick. */
  private produceTimer = 0;
  /** Server id when playing online. */
  netId?: number;

  constructor(
    x: number,
    y: number,
    readonly def: BuildingDef,
    readonly ownerId = 0,
  ) {
    super(x, y, def.w, def.h);
  }

  /** 0..1 fill toward the next produced resource. */
  get produceProgress() {
    const every = this.def.produces?.every;
    if (!every) return 0;
    return Math.min(1, this.produceTimer / every);
  }

  /** Seconds until the next resource. */
  get produceCooldownLeft() {
    const every = this.def.produces?.every;
    if (!every) return 0;
    return Math.max(0, every - this.produceTimer);
  }

  /** Returns a resource id when this building finishes a production tick. */
  update(dt: number): ResourceId | null {
    const prod = this.def.produces;
    if (!prod) return null;
    this.produceTimer += dt;
    if (this.produceTimer < prod.every) return null;
    this.produceTimer -= prod.every;
    return prod.resource;
  }

  render(ctx: CanvasRenderingContext2D) {
    drawHouse(ctx, this.def, this.x, this.y);
    if (this.def.produces) this.drawCooldown(ctx);
  }

  private drawCooldown(ctx: CanvasRenderingContext2D) {
    const barW = this.w * 0.7;
    const barH = 4;
    const x = this.x + (this.w - barW) / 2;
    const y = this.y - 8;
    const progress = this.produceProgress;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.roundRect(x - 1, y - 1, barW + 2, barH + 2, 2);
    ctx.fill();

    ctx.fillStyle = progress >= 1 ? '#81c784' : this.def.trim;
    ctx.beginPath();
    ctx.roundRect(x, y, Math.max(0, barW * progress), barH, 1);
    ctx.fill();
  }
}
