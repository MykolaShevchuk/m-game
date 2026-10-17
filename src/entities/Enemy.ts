import { CONFIG } from '@/config';
import { rand } from '@/core/math';
import { Entity } from './Entity';

export class Enemy extends Entity {
  private vx: number;
  private vy: number;

  constructor(x: number, y: number) {
    super(x, y, CONFIG.enemy.size, CONFIG.enemy.size);
    const angle = rand(0, Math.PI * 2);
    const speed = rand(CONFIG.enemy.minSpeed, CONFIG.enemy.maxSpeed);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
  }

  update(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.x < 0 || this.x + this.w > CONFIG.width) this.vx *= -1;
    if (this.y < 0 || this.y + this.h > CONFIG.height) this.vy *= -1;
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = CONFIG.colors.enemy;
    ctx.fillRect(this.x, this.y, this.w, this.h);
  }
}
