import { CONFIG } from '@/config';
import type { Input } from '@/core/Input';
import { clamp } from '@/core/math';
import { Entity } from './Entity';

export class Player extends Entity {
  constructor(
    x: number,
    y: number,
    private input: Input,
  ) {
    super(x, y, CONFIG.player.size, CONFIG.player.size);
  }

  update(dt: number) {
    const { x, y } = this.input.axis();
    this.x = clamp(this.x + x * CONFIG.player.speed * dt, 0, CONFIG.width - this.w);
    this.y = clamp(this.y + y * CONFIG.player.speed * dt, 0, CONFIG.height - this.h);
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = CONFIG.colors.player;
    ctx.fillRect(this.x, this.y, this.w, this.h);
  }
}
