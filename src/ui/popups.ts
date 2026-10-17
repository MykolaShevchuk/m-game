const LIFETIME = 0.9;
const RISE = 28;

interface Popup {
  text: string;
  color: string;
  x: number;
  y: number;
  age: number;
}

/** Short floating labels in world space, e.g. "+1 Wood". */
export class Popups {
  private items: Popup[] = [];

  add(text: string, color: string, x: number, y: number) {
    this.items.push({ text, color, x, y, age: 0 });
  }

  update(dt: number) {
    for (const p of this.items) p.age += dt;
    this.items = this.items.filter((p) => p.age < LIFETIME);
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    for (const p of this.items) {
      const k = p.age / LIFETIME;
      const y = p.y - k * RISE;
      ctx.globalAlpha = 1 - k * k;
      ctx.strokeText(p.text, p.x, y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, y);
    }
    ctx.globalAlpha = 1;
  }
}
