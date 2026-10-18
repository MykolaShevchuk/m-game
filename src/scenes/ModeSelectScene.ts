import type { Game } from '@/core/Game';
import type { Scene } from '@/core/Scene';
import { hitCardIndex, pointIn } from '@/ui/hit';
import { drawText } from '@/ui/text';
import { CharacterSelectScene } from './CharacterSelectScene';
import { MainMenuScene } from './MainMenuScene';
import { OnlineLobbyScene } from './OnlineLobbyScene';

export type PlayMode = 'local' | 'online';

const MODES: { id: PlayMode; name: string; blurb: string }[] = [
  { id: 'local', name: 'Local Co-op', blurb: 'Split screen · WASD+FB / Arrows+MK' },
  { id: 'online', name: 'Online Co-op', blurb: 'Colyseus · room code' },
];

export class ModeSelectScene implements Scene {
  private selected = 0;

  constructor(private game: Game) {}

  private layout() {
    const w = this.game.width;
    const h = this.game.height;
    const narrow = w < 720;
    if (narrow) {
      const cardW = Math.min(320, w - 48);
      const cardH = 72;
      const gap = 12;
      const totalH = MODES.length * cardH + (MODES.length - 1) * gap;
      return {
        narrow: true,
        cardW,
        cardH,
        gap,
        startX: (w - cardW) / 2,
        startY: Math.max(150, (h - totalH) / 2),
        vertical: true,
      };
    }
    const cardW = 220;
    const cardH = 160;
    const gap = 20;
    const total = MODES.length * cardW + (MODES.length - 1) * gap;
    return {
      narrow: false,
      cardW,
      cardH,
      gap,
      startX: (w - total) / 2,
      startY: Math.min(180, h * 0.33),
      vertical: false,
    };
  }

  private confirm() {
    const mode = MODES[this.selected].id;
    if (mode === 'online') {
      this.game.scenes.switch(new OnlineLobbyScene(this.game));
    } else {
      this.game.scenes.switch(new CharacterSelectScene(this.game, { mode }));
    }
  }

  update() {
    const input = this.game.input;
    const n = MODES.length;
    const L = this.layout();
    const tap = input.peekTap();
    if (tap) {
      if (L.vertical) {
        for (let i = 0; i < n; i++) {
          const y = L.startY + i * (L.cardH + L.gap);
          if (pointIn(tap, L.startX, y, L.cardW, L.cardH)) {
            input.consumeTap();
            this.selected = i;
            this.confirm();
            return;
          }
        }
      } else {
        const hit = hitCardIndex(tap, n, L.cardW, L.cardH, L.gap, L.startX, L.startY);
        if (hit >= 0) {
          input.consumeTap();
          this.selected = hit;
          this.confirm();
          return;
        }
      }
    }
    if (input.wasPressed('ArrowLeft', 'KeyA', 'ArrowUp', 'KeyW')) this.selected = (this.selected + n - 1) % n;
    if (input.wasPressed('ArrowRight', 'KeyD', 'ArrowDown', 'KeyS')) this.selected = (this.selected + 1) % n;
    for (let i = 0; i < n; i++) {
      if (input.wasPressed(`Digit${i + 1}`)) this.selected = i;
    }
    if (input.wasPressed('Escape', 'Backspace')) {
      this.game.scenes.switch(new MainMenuScene(this.game));
      return;
    }
    if (input.wasPressed('Enter', 'Space')) this.confirm();
  }

  render(ctx: CanvasRenderingContext2D) {
    const { width: w, height: h } = this.game;
    const touch = this.game.input.touchPreferred;
    const L = this.layout();
    drawText(ctx, 'M-GAME', w / 2, L.narrow ? 48 : 70, L.narrow ? 36 : 48, 'center');
    drawText(ctx, 'Choose a mode', w / 2, L.narrow ? 88 : 120, L.narrow ? 16 : 20, 'center');

    MODES.forEach((m, i) => {
      const x = L.vertical ? L.startX : L.startX + i * (L.cardW + L.gap);
      const y = L.vertical ? L.startY + i * (L.cardH + L.gap) : L.startY;
      const active = i === this.selected;
      ctx.fillStyle = active ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)';
      ctx.strokeStyle = active ? '#ffd54f' : 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = active ? 3 : 1;
      ctx.beginPath();
      ctx.roundRect(x, y, L.cardW, L.cardH, 12);
      ctx.fill();
      ctx.stroke();
      if (L.vertical) {
        drawText(ctx, `${i + 1}. ${m.name}`, x + 20, y + L.cardH / 2 - 10, 20);
        ctx.globalAlpha = 0.75;
        drawText(ctx, m.blurb, x + 20, y + L.cardH / 2 + 14, 13);
        ctx.globalAlpha = 1;
      } else {
        drawText(ctx, `${i + 1}. ${m.name}`, x + L.cardW / 2, y + 55, 22, 'center');
        ctx.globalAlpha = 0.75;
        drawText(ctx, m.blurb, x + L.cardW / 2, y + 100, 13, 'center');
        ctx.globalAlpha = 1;
      }
    });

    drawText(
      ctx,
      touch ? 'Tap a mode  ·  Esc back' : '← → or 1-2  ·  Enter  ·  Esc back',
      w / 2,
      h - 36,
      14,
      'center',
    );
  }
}
