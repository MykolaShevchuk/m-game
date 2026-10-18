import type { Game } from '@/core/Game';
import type { Scene } from '@/core/Scene';
import { pointIn } from '@/ui/hit';
import { drawText } from '@/ui/text';
import { ModeSelectScene } from './ModeSelectScene';
import { SettingsScene } from './SettingsScene';
import { ShopScene } from './ShopScene';

const BUTTONS = [
  { id: 'play' as const, label: 'Play', blurb: 'Start a new game' },
  { id: 'shop' as const, label: 'Shop', blurb: 'Cosmetics & unlocks' },
  { id: 'settings' as const, label: 'Settings', blurb: 'Music & options' },
];

export class MainMenuScene implements Scene {
  private selected = 0;

  constructor(private game: Game) {}

  private layout() {
    const w = this.game.width;
    const h = this.game.height;
    const cardW = Math.min(280, w - 64);
    const cardH = 64;
    const gap = 12;
    const totalH = BUTTONS.length * cardH + (BUTTONS.length - 1) * gap;
    return {
      cardW,
      cardH,
      gap,
      startX: (w - cardW) / 2,
      startY: Math.max(140, (h - totalH) / 2 + 8),
    };
  }

  private confirm() {
    const id = BUTTONS[this.selected].id;
    if (id === 'play') this.game.scenes.switch(new ModeSelectScene(this.game));
    else if (id === 'shop') this.game.scenes.switch(new ShopScene(this.game));
    else this.game.scenes.switch(new SettingsScene(this.game));
  }

  update() {
    const input = this.game.input;
    const n = BUTTONS.length;
    const L = this.layout();
    const tap = input.peekTap();
    if (tap) {
      for (let i = 0; i < n; i++) {
        const y = L.startY + i * (L.cardH + L.gap);
        if (pointIn(tap, L.startX, y, L.cardW, L.cardH)) {
          input.consumeTap();
          this.selected = i;
          this.confirm();
          return;
        }
      }
    }
    if (input.wasPressed('ArrowUp', 'KeyW', 'ArrowLeft', 'KeyA')) this.selected = (this.selected + n - 1) % n;
    if (input.wasPressed('ArrowDown', 'KeyS', 'ArrowRight', 'KeyD')) this.selected = (this.selected + 1) % n;
    for (let i = 0; i < n; i++) {
      if (input.wasPressed(`Digit${i + 1}`)) this.selected = i;
    }
    if (input.wasPressed('Enter', 'Space')) this.confirm();
  }

  render(ctx: CanvasRenderingContext2D) {
    const { width: w, height: h } = this.game;
    const touch = this.game.input.touchPreferred;
    const L = this.layout();

    // Soft backdrop wash so the menu isn't a flat slab.
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#1e2430');
    grad.addColorStop(0.55, '#1a1d26');
    grad.addColorStop(1, '#151820');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    drawText(ctx, 'M-GAME', w / 2, Math.min(90, L.startY - 70), 48, 'center');
    ctx.globalAlpha = 0.7;
    drawText(ctx, 'Islands · builds · battles', w / 2, Math.min(128, L.startY - 32), 16, 'center');
    ctx.globalAlpha = 1;

    BUTTONS.forEach((b, i) => {
      const y = L.startY + i * (L.cardH + L.gap);
      const active = i === this.selected;
      ctx.fillStyle = active ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)';
      ctx.strokeStyle = active ? '#ffd54f' : 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = active ? 3 : 1;
      ctx.beginPath();
      ctx.roundRect(L.startX, y, L.cardW, L.cardH, 12);
      ctx.fill();
      ctx.stroke();
      drawText(ctx, b.label, L.startX + L.cardW / 2, y + L.cardH / 2 - 10, 24, 'center');
      ctx.globalAlpha = 0.7;
      drawText(ctx, b.blurb, L.startX + L.cardW / 2, y + L.cardH / 2 + 16, 13, 'center');
      ctx.globalAlpha = 1;
    });

    drawText(
      ctx,
      touch ? 'Tap Play, Shop, or Settings' : '↑ ↓  ·  Enter to select',
      w / 2,
      h - 36,
      14,
      'center',
    );
  }
}
