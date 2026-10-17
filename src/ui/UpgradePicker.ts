import type { Input } from '@/core/Input';
import type { Upgrade } from '@/upgrades';
import { drawText } from './text';

const CARD_W = 220;
const CARD_H = 200;
const GAP = 24;

export class UpgradePicker {
  private selected = 0;

  constructor(readonly options: Upgrade[]) {}

  /** Returns the chosen upgrade once the player confirms. */
  update(input: Input): Upgrade | null {
    const n = this.options.length;
    if (input.wasPressed('ArrowLeft', 'KeyA')) this.selected = (this.selected + n - 1) % n;
    if (input.wasPressed('ArrowRight', 'KeyD')) this.selected = (this.selected + 1) % n;
    for (let i = 0; i < n; i++) {
      if (input.wasPressed(`Digit${i + 1}`)) return this.options[i];
    }
    if (input.wasPressed('Enter', 'Space')) return this.options[this.selected];
    return null;
  }

  render(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.fillStyle = 'rgba(8, 10, 16, 0.7)';
    ctx.fillRect(0, 0, w, h);

    drawText(ctx, 'LEVEL UP!', w / 2, 100, 40, 'center');
    drawText(ctx, 'Choose an upgrade', w / 2, 140, 18, 'center');

    const n = this.options.length;
    const startX = (w - (n * CARD_W + (n - 1) * GAP)) / 2;
    const y = 175;

    this.options.forEach((u, i) => {
      const x = startX + i * (CARD_W + GAP);
      const active = i === this.selected;
      ctx.fillStyle = active ? 'rgba(40, 44, 58, 0.97)' : 'rgba(26, 29, 38, 0.95)';
      ctx.strokeStyle = active ? u.color : 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = active ? 3 : 1;
      ctx.beginPath();
      ctx.roundRect(x, y - (active ? 6 : 0), CARD_W, CARD_H, 12);
      ctx.fill();
      ctx.stroke();

      const top = y - (active ? 6 : 0);
      ctx.fillStyle = u.color;
      ctx.font = '48px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(u.icon, x + CARD_W / 2, top + 60);
      drawText(ctx, `${i + 1}. ${u.name}`, x + CARD_W / 2, top + 120, 20, 'center');
      ctx.globalAlpha = 0.75;
      drawText(ctx, u.description, x + CARD_W / 2, top + 152, 14, 'center');
      ctx.globalAlpha = 1;
    });

    drawText(ctx, '← → or 1-3 to choose  ·  Enter to confirm', w / 2, y + CARD_H + 50, 16, 'center');
  }
}
