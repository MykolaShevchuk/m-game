import type { Game } from '@/core/Game';
import type { Scene } from '@/core/Scene';
import { pointIn } from '@/ui/hit';
import { drawText } from '@/ui/text';
import { MainMenuScene } from './MainMenuScene';

/** Placeholder shop — stock comes later. */
export class ShopScene implements Scene {
  constructor(private game: Game) {}

  private backRect() {
    const w = this.game.width;
    const h = this.game.height;
    const bw = Math.min(200, w - 48);
    const bh = 48;
    return { x: (w - bw) / 2, y: h * 0.62, w: bw, h: bh };
  }

  private goBack() {
    this.game.scenes.switch(new MainMenuScene(this.game));
  }

  update() {
    const input = this.game.input;
    if (input.wasPressed('Escape', 'Backspace')) {
      this.goBack();
      return;
    }
    const tap = input.peekTap();
    if (tap) {
      const r = this.backRect();
      if (pointIn(tap, r.x, r.y, r.w, r.h)) {
        input.consumeTap();
        this.goBack();
        return;
      }
    }
    if (input.wasPressed('Enter', 'Space')) this.goBack();
  }

  render(ctx: CanvasRenderingContext2D) {
    const { width: w, height: h } = this.game;
    const touch = this.game.input.touchPreferred;

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#1e2430');
    grad.addColorStop(1, '#151820');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    drawText(ctx, 'Shop', w / 2, h * 0.32, 40, 'center');
    ctx.globalAlpha = 0.75;
    drawText(ctx, 'Nothing for sale yet — check back soon.', w / 2, h * 0.42, 16, 'center');
    ctx.globalAlpha = 1;

    const r = this.backRect();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.strokeStyle = '#ffd54f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 10);
    ctx.fill();
    ctx.stroke();
    drawText(ctx, 'Back', r.x + r.w / 2, r.y + r.h / 2, 18, 'center');

    drawText(ctx, touch ? 'Tap Back' : 'Esc · Enter to return', w / 2, h - 36, 14, 'center');
  }
}
