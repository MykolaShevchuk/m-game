import { CONFIG } from '@/config';
import { rand } from '@/core/math';
import { Entity } from './Entity';

export class Coin extends Entity {
  private t = rand(0, Math.PI * 2);

  constructor() {
    const s = CONFIG.coin.size;
    super(rand(s, CONFIG.width - s * 2), rand(s, CONFIG.height - s * 2), s, s);
  }

  update(dt: number) {
    this.t += dt * 4;
  }

  render(ctx: CanvasRenderingContext2D) {
    const r = this.w / 2;
    ctx.fillStyle = CONFIG.colors.coin;
    ctx.beginPath();
    ctx.arc(this.x + r, this.y + r, r * (0.85 + Math.sin(this.t) * 0.15), 0, Math.PI * 2);
    ctx.fill();
  }
}
