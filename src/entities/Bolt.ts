import { Entity } from './Entity';

const SIZE = 10;

export class Bolt extends Entity {
  life: number;

  constructor(
    x: number,
    y: number,
    readonly vx: number,
    readonly vy: number,
    readonly ownerId: number,
    readonly color: string,
    lifetime = 0.7,
  ) {
    super(x - SIZE / 2, y - SIZE / 2, SIZE, SIZE);
    this.life = lifetime;
  }

  update(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) this.alive = false;
  }

  render(ctx: CanvasRenderingContext2D) {
    const r = this.w / 2;
    const cx = this.x + r;
    const cy = this.y + r;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.5, r * 0.7, r * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 248, 230, 0.45)';
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.2, cy - r * 0.25, r * 0.35, r * 0.25, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}
