import type { Input } from '@/core/Input';
import type { Upgrade } from '@/upgrades';
import { hitCardIndex, pointIn } from './hit';
import { drawText } from './text';

export class UpgradePicker {
  private selected = 0;

  constructor(readonly options: Upgrade[]) {}

  private layout(w: number, h: number) {
    const n = this.options.length;
    const narrow = w < 720;
    if (narrow) {
      const cardW = Math.min(300, w - 40);
      const cardH = 88;
      const gap = 10;
      const totalH = n * cardH + (n - 1) * gap;
      return {
        cardW,
        cardH,
        gap,
        startX: (w - cardW) / 2,
        startY: Math.max(140, (h - totalH) / 2),
        vertical: true,
      };
    }
    const cardW = 220;
    const cardH = 200;
    const gap = 24;
    return {
      cardW,
      cardH,
      gap,
      startX: (w - (n * cardW + (n - 1) * gap)) / 2,
      startY: Math.min(175, h * 0.32),
      vertical: false,
    };
  }

  /** Returns the chosen upgrade once the player confirms. */
  update(input: Input, canvasW = 960, canvasH = 540): Upgrade | null {
    const n = this.options.length;
    const L = this.layout(canvasW, canvasH);
    const tap = input.peekTap();
    if (tap) {
      if (L.vertical) {
        for (let i = 0; i < n; i++) {
          const y = L.startY + i * (L.cardH + L.gap);
          if (pointIn(tap, L.startX, y, L.cardW, L.cardH)) {
            input.consumeTap();
            return this.options[i];
          }
        }
      } else {
        const hit = hitCardIndex(tap, n, L.cardW, L.cardH, L.gap, L.startX, L.startY - 6);
        if (hit >= 0) {
          input.consumeTap();
          return this.options[hit];
        }
      }
    }
    if (input.wasPressed('ArrowLeft', 'KeyA', 'ArrowUp', 'KeyW')) this.selected = (this.selected + n - 1) % n;
    if (input.wasPressed('ArrowRight', 'KeyD', 'ArrowDown', 'KeyS')) this.selected = (this.selected + 1) % n;
    for (let i = 0; i < n; i++) {
      if (input.wasPressed(`Digit${i + 1}`)) return this.options[i];
    }
    if (input.wasPressed('Enter', 'Space')) return this.options[this.selected];
    return null;
  }

  render(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.fillStyle = 'rgba(8, 10, 16, 0.7)';
    ctx.fillRect(0, 0, w, h);

    const touch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    const L = this.layout(w, h);
    drawText(ctx, 'LEVEL UP!', w / 2, L.vertical ? 48 : 100, L.vertical ? 28 : 40, 'center');
    drawText(ctx, 'Choose an upgrade', w / 2, L.vertical ? 80 : 140, 16, 'center');

    this.options.forEach((u, i) => {
      const x = L.vertical ? L.startX : L.startX + i * (L.cardW + L.gap);
      const y = L.vertical ? L.startY + i * (L.cardH + L.gap) : L.startY;
      const active = i === this.selected;
      const top = y - (active && !L.vertical ? 6 : 0);
      ctx.fillStyle = active ? 'rgba(40, 44, 58, 0.97)' : 'rgba(26, 29, 38, 0.95)';
      ctx.strokeStyle = active ? u.color : 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = active ? 3 : 1;
      ctx.beginPath();
      ctx.roundRect(x, top, L.cardW, L.cardH, 12);
      ctx.fill();
      ctx.stroke();

      if (L.vertical) {
        ctx.fillStyle = u.color;
        ctx.font = '28px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(u.icon, x + 36, top + L.cardH / 2);
        drawText(ctx, `${i + 1}. ${u.name}`, x + 64, top + L.cardH / 2 - 12, 16);
        ctx.globalAlpha = 0.75;
        drawText(ctx, u.description, x + 64, top + L.cardH / 2 + 12, 12);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = u.color;
        ctx.font = '48px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(u.icon, x + L.cardW / 2, top + 60);
        drawText(ctx, `${i + 1}. ${u.name}`, x + L.cardW / 2, top + 120, 20, 'center');
        ctx.globalAlpha = 0.75;
        drawText(ctx, u.description, x + L.cardW / 2, top + 152, 14, 'center');
        ctx.globalAlpha = 1;
      }
    });

    drawText(
      ctx,
      touch ? 'Tap an upgrade' : '← → or 1-3 to choose  ·  Enter to confirm',
      w / 2,
      h - 36,
      14,
      'center',
    );
  }
}
