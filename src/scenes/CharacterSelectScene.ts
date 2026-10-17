import { CHARACTERS } from '@/characters';
import type { Game } from '@/core/Game';
import type { Scene } from '@/core/Scene';
import { loadHighScore, saveCharacter } from '@/core/storage';
import { drawCharacter } from '@/ui/drawCharacter';
import { hitCardIndex, pointIn } from '@/ui/hit';
import { drawText } from '@/ui/text';
import type { PlayMode } from './ModeSelectScene';
import { ModeSelectScene } from './ModeSelectScene';
import { PlayScene } from './PlayScene';

const MAX_SPEED = Math.max(...CHARACTERS.map((c) => c.speed));

export interface CharacterSelectOptions {
  mode: PlayMode;
  /** Pre-selected index when returning from pause. */
  selected?: number;
  onPicked?: (characters: number[]) => void;
}

export class CharacterSelectScene implements Scene {
  private t = 0;
  private selected = 0;
  private picks: number[] = [];
  private mode: PlayMode;
  private onPicked?: (characters: number[]) => void;

  constructor(
    private game: Game,
    options: CharacterSelectOptions = { mode: 'local' },
  ) {
    this.mode = options.mode;
    this.selected = options.selected ?? 0;
    this.onPicked = options.onPicked;
  }

  private get needed() {
    return this.mode === 'local' ? 2 : 1;
  }

  private layout() {
    const w = this.game.width;
    const h = this.game.height;
    const n = CHARACTERS.length;
    const narrow = w < 720;
    if (narrow) {
      const cardW = Math.min(300, w - 40);
      const cardH = Math.min(100, Math.floor((h - 160) / n) - 10);
      const gap = 10;
      const totalH = n * cardH + (n - 1) * gap;
      return {
        narrow: true,
        cardW,
        cardH: Math.max(84, cardH),
        gap,
        startX: (w - cardW) / 2,
        startY: Math.max(120, (h - totalH) / 2 - 10),
        vertical: true,
        artSize: 48,
      };
    }
    const cardW = 240;
    const cardH = 290;
    const gap = 30;
    const totalW = n * cardW + (n - 1) * gap;
    return {
      narrow: false,
      cardW,
      cardH,
      gap,
      startX: (w - totalW) / 2,
      startY: 130,
      vertical: false,
      artSize: 80,
    };
  }

  private confirm() {
    this.picks.push(this.selected);
    if (this.picks.length < this.needed) return;
    if (this.mode === 'local') saveCharacter(this.picks[0]);
    if (this.onPicked) {
      this.onPicked(this.picks);
    } else {
      this.game.scenes.switch(
        new PlayScene(this.game, {
          characters: this.picks,
          splitScreen: this.mode === 'local',
        }),
      );
    }
  }

  update(dt: number) {
    this.t += dt;
    const input = this.game.input;
    const n = CHARACTERS.length;
    if (input.wasPressed('Escape')) {
      this.game.scenes.switch(new ModeSelectScene(this.game));
      return;
    }
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
        const hit = hitCardIndex(tap, n, L.cardW, L.cardH, L.gap, L.startX, L.startY - 8);
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
    CHARACTERS.forEach((_, i) => {
      if (input.wasPressed(`Digit${i + 1}`)) this.selected = i;
    });
    if (input.wasPressed('Enter', 'Space')) this.confirm();
  }

  render(ctx: CanvasRenderingContext2D) {
    const { width: w, height: h } = this.game;
    const L = this.layout();
    const touch = this.game.input.touchPreferred;
    drawText(ctx, 'M-GAME', w / 2, L.narrow ? 36 : 50, L.narrow ? 32 : 44, 'center');
    const who =
      this.mode === 'local'
        ? this.picks.length === 0
          ? 'Player 1 — choose character'
          : 'Player 2 — choose character'
        : 'Choose your character';
    drawText(ctx, who, w / 2, L.narrow ? 72 : 95, L.narrow ? 14 : 20, 'center');

    CHARACTERS.forEach((c, i) => {
      const active = i === this.selected;
      const x = L.vertical ? L.startX : L.startX + i * (L.cardW + L.gap);
      const y = (L.vertical ? L.startY + i * (L.cardH + L.gap) : L.startY) - (active && !L.vertical ? 8 : 0);

      ctx.fillStyle = active ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.04)';
      ctx.strokeStyle = active ? '#ffd54f' : 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = active ? 3 : 1;
      ctx.beginPath();
      ctx.roundRect(x, y, L.cardW, L.cardH, 12);
      ctx.fill();
      ctx.stroke();

      const bob = active ? Math.sin(this.t * 4) * 4 : 0;
      const artOpts = { time: this.t, facing: { x: 1, y: 0.2 } };

      if (L.vertical) {
        drawCharacter(ctx, c, x + 40, y + L.cardH / 2 + bob * 0.5, L.artSize * 1.15, artOpts);
        drawText(ctx, `${i + 1}. ${c.name}`, x + 80, y + L.cardH / 2 - 18, 18);
        ctx.globalAlpha = 0.7;
        drawText(ctx, c.description, x + 80, y + L.cardH / 2 + 4, 12);
        ctx.globalAlpha = 1;
        drawText(ctx, `★ ${c.perk}`, x + 80, y + L.cardH / 2 + 24, 12);
      } else {
        drawCharacter(ctx, c, x + L.cardW / 2, y + 95 + bob, L.artSize * 1.2, artOpts);
        drawText(ctx, `${i + 1}. ${c.name}`, x + L.cardW / 2, y + 175, 24, 'center');
        ctx.globalAlpha = 0.7;
        drawText(ctx, c.description, x + L.cardW / 2, y + 202, 14, 'center');
        ctx.globalAlpha = 1;
        drawText(ctx, 'Speed', x + 20, y + 232, 14);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fillRect(x + 80, y + 226, L.cardW - 100, 10);
        ctx.fillStyle = c.color;
        ctx.fillRect(x + 80, y + 226, (L.cardW - 100) * (c.speed / MAX_SPEED), 10);
        drawText(ctx, `★ ${c.perk}`, x + 20, y + 260, 14);
      }
    });

    drawText(
      ctx,
      touch ? 'Tap a character' : '← → or 1-3  ·  Enter to confirm  ·  Esc back',
      w / 2,
      h - 40,
      14,
      'center',
    );
    ctx.globalAlpha = 0.7;
    drawText(ctx, `High score: ${loadHighScore()}`, w / 2, h - 18, 12, 'center');
    ctx.globalAlpha = 1;
  }
}
