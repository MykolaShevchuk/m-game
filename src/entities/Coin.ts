import { CONFIG } from '@/config';
import { rand } from '@/core/math';
import { Entity } from './Entity';

export class Coin extends Entity {
  private t = rand(0, Math.PI * 2);

  constructor(x: number, y: number) {
    super(x, y, CONFIG.coin.size, CONFIG.coin.size);
  }

  update(dt: number) {
    this.t += dt * 2;
  }

  render(ctx: CanvasRenderingContext2D) {
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;
    const r = (this.w / 2) * (0.94 + Math.sin(this.t) * 0.04);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.7, r * 0.7, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = CONFIG.colors.coin;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(232, 210, 140, 0.55)';
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.2, cy - r * 0.25, r * 0.35, r * 0.22, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}
