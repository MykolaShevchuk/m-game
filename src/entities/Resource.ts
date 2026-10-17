import { CONFIG } from '@/config';
import { rand } from '@/core/math';
import type { ResourceId } from '@/resources';
import { drawResource } from '@/ui/drawResource';
import { Entity } from './Entity';

export class Resource extends Entity {
  private t = rand(0, Math.PI * 2);

  constructor(
    x: number,
    y: number,
    readonly type: ResourceId,
  ) {
    super(x, y, CONFIG.resource.size, CONFIG.resource.size);
  }

  update(dt: number) {
    this.t += dt * 3;
  }

  render(ctx: CanvasRenderingContext2D) {
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;
    const bob = Math.sin(this.t) * 0.8;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(cx, this.y + this.h, this.w * 0.38, this.w * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    drawResource(ctx, this.type, cx, cy - 1 + bob, this.w);
  }
}
