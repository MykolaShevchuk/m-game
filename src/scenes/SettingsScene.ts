import type { Game } from '@/core/Game';
import type { Scene } from '@/core/Scene';
import { loadMusicEnabled, saveMusicEnabled } from '@/core/storage';
import { pointIn } from '@/ui/hit';
import { drawText } from '@/ui/text';
import { MainMenuScene } from './MainMenuScene';

type RowId = 'music' | 'back';

export class SettingsScene implements Scene {
  private selected = 0;
  private musicOn = loadMusicEnabled();

  constructor(private game: Game) {}

  private rows(): { id: RowId; label: string; value?: string }[] {
    return [
      { id: 'music', label: 'Music', value: this.musicOn ? 'On' : 'Off' },
      { id: 'back', label: 'Back' },
    ];
  }

  private layout() {
    const w = this.game.width;
    const h = this.game.height;
    const cardW = Math.min(320, w - 64);
    const cardH = 64;
    const gap = 14;
    const rows = this.rows();
    const totalH = rows.length * cardH + (rows.length - 1) * gap;
    return {
      cardW,
      cardH,
      gap,
      startX: (w - cardW) / 2,
      startY: Math.max(150, (h - totalH) / 2),
      rows,
    };
  }

  private activate() {
    const row = this.rows()[this.selected];
    if (row.id === 'back') {
      this.game.scenes.switch(new MainMenuScene(this.game));
      return;
    }
    if (row.id === 'music') {
      this.musicOn = !this.musicOn;
      saveMusicEnabled(this.musicOn);
    }
  }

  update() {
    const input = this.game.input;
    const L = this.layout();
    const n = L.rows.length;

    if (input.wasPressed('Escape', 'Backspace')) {
      this.game.scenes.switch(new MainMenuScene(this.game));
      return;
    }

    const tap = input.peekTap();
    if (tap) {
      for (let i = 0; i < n; i++) {
        const y = L.startY + i * (L.cardH + L.gap);
        if (pointIn(tap, L.startX, y, L.cardW, L.cardH)) {
          input.consumeTap();
          this.selected = i;
          this.activate();
          return;
        }
      }
    }

    if (input.wasPressed('ArrowUp', 'KeyW')) this.selected = (this.selected + n - 1) % n;
    if (input.wasPressed('ArrowDown', 'KeyS')) this.selected = (this.selected + 1) % n;
    if (input.wasPressed('ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD') && L.rows[this.selected].id === 'music') {
      this.musicOn = !this.musicOn;
      saveMusicEnabled(this.musicOn);
    }
    if (input.wasPressed('Enter', 'Space')) this.activate();
  }

  render(ctx: CanvasRenderingContext2D) {
    const { width: w, height: h } = this.game;
    const touch = this.game.input.touchPreferred;
    const L = this.layout();

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#1e2430');
    grad.addColorStop(1, '#151820');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    drawText(ctx, 'Settings', w / 2, Math.min(80, L.startY - 48), 40, 'center');

    L.rows.forEach((row, i) => {
      const y = L.startY + i * (L.cardH + L.gap);
      const active = i === this.selected;
      ctx.fillStyle = active ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)';
      ctx.strokeStyle = active ? '#ffd54f' : 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = active ? 3 : 1;
      ctx.beginPath();
      ctx.roundRect(L.startX, y, L.cardW, L.cardH, 12);
      ctx.fill();
      ctx.stroke();

      if (row.value) {
        drawText(ctx, row.label, L.startX + 24, y + L.cardH / 2, 20);
        drawText(ctx, row.value, L.startX + L.cardW - 24, y + L.cardH / 2, 20, 'right');
      } else {
        drawText(ctx, row.label, L.startX + L.cardW / 2, y + L.cardH / 2, 20, 'center');
      }
    });

    drawText(
      ctx,
      touch ? 'Tap to toggle · Back to leave' : '↑ ↓  ·  Enter / ← → toggle  ·  Esc back',
      w / 2,
      h - 36,
      14,
      'center',
    );
  }
}
