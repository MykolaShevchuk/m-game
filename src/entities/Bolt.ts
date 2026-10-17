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
    ctx.save();
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x + r, this.y + r, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff8e1';
    ctx.beginPath();
    ctx.arc(this.x + r, this.y + r, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
