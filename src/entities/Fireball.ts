import { Entity } from './Entity';

const SPEED = 480;
const SIZE = 12;
const LIFETIME = 1.5;

export class Fireball extends Entity {
  private vx: number;
  private vy: number;
  private age = 0;

  constructor(x: number, y: number, targetX: number, targetY: number) {
    super(x - SIZE / 2, y - SIZE / 2, SIZE, SIZE);
    const dx = targetX - x;
    const dy = targetY - y;
    const len = Math.hypot(dx, dy) || 1;
    this.vx = (dx / len) * SPEED;
    this.vy = (dy / len) * SPEED;
  }

  update(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.age += dt;
    if (this.age > LIFETIME) this.alive = false;
  }

  render(ctx: CanvasRenderingContext2D) {
    const r = this.w / 2;
    ctx.save();
    ctx.shadowColor = '#ff7043';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#ff7043';
    ctx.beginPath();
    ctx.arc(this.x + r, this.y + r, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe082';
    ctx.beginPath();
    ctx.arc(this.x + r, this.y + r, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
