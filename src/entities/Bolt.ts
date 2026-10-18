import { Entity } from './Entity';

const SIZE = 10;

export class Bolt extends Entity {
  life: number;
  readonly maxLife: number;

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
    this.maxLife = lifetime;
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
    const speed = Math.hypot(this.vx, this.vy) || 1;
    const ang = Math.atan2(this.vy, this.vx);
    const fade = Math.min(1, this.life / Math.min(0.2, this.maxLife));

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.globalAlpha *= fade;

    // Motion trail
    for (let i = 4; i >= 1; i--) {
      const back = -i * 7;
      ctx.globalAlpha = fade * (0.12 + 0.1 * (5 - i));
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.ellipse(back, 0, r * (1.1 + i * 0.25), r * (0.55 - i * 0.05), 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = fade;
    // Outer glow
    ctx.fillStyle = this.color;
    ctx.globalAlpha = 0.35 * fade;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 2.2, r * 1.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body — elongated along travel
    ctx.globalAlpha = fade;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.85, r * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hot core
    ctx.fillStyle = '#fff8e7';
    ctx.globalAlpha = 0.85 * fade;
    ctx.beginPath();
    ctx.ellipse(r * 0.25, 0, r * 0.7, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tip spark
    ctx.globalAlpha = fade;
    ctx.beginPath();
    ctx.moveTo(r * 1.9, 0);
    ctx.lineTo(r * 1.1, -r * 0.45);
    ctx.lineTo(r * 1.1, r * 0.45);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // Ground shadow (unrotated)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.beginPath();
    ctx.ellipse(cx - (this.vx / speed) * 2, cy + r * 0.7, r * 0.9, r * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
