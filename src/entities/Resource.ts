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
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, this.y + this.h, this.w * 0.4, this.w * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 245, 200, ${0.22 + Math.sin(this.t * 1.5) * 0.08})`;
    ctx.beginPath();
    ctx.arc(cx, cy - 2, this.w * 0.72, 0, Math.PI * 2);
    ctx.fill();
    drawResource(ctx, this.type, cx, cy - 2 + Math.sin(this.t) * 1.5, this.w);
  }
}
