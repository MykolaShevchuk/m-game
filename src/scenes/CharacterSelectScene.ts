import { CHARACTERS } from '@/characters';
import type { Game } from '@/core/Game';
import type { Scene } from '@/core/Scene';
import { loadHighScore } from '@/core/storage';
import { drawCharacter } from '@/ui/drawCharacter';
import { drawText } from '@/ui/text';
import { PlayScene } from './PlayScene';

const CARD_W = 240;
const CARD_H = 290;
const GAP = 30;
const MAX_SPEED = Math.max(...CHARACTERS.map((c) => c.speed));

export class CharacterSelectScene implements Scene {
  private t = 0;

  constructor(
    private game: Game,
    private selected = 0,
  ) {}

  update(dt: number) {
    this.t += dt;
    const input = this.game.input;
    const n = CHARACTERS.length;
    if (input.wasPressed('ArrowLeft', 'KeyA')) this.selected = (this.selected + n - 1) % n;
    if (input.wasPressed('ArrowRight', 'KeyD')) this.selected = (this.selected + 1) % n;
    CHARACTERS.forEach((_, i) => {
      if (input.wasPressed(`Digit${i + 1}`)) this.selected = i;
    });
    if (input.wasPressed('Enter', 'Space')) {
      this.game.scenes.switch(new PlayScene(this.game, this.selected));
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    const { width: w, height: h } = this.game;
    drawText(ctx, 'M-GAME', w / 2, 50, 44, 'center');
    drawText(ctx, 'Choose your character', w / 2, 95, 20, 'center');

    const totalW = CHARACTERS.length * CARD_W + (CHARACTERS.length - 1) * GAP;
    const startX = (w - totalW) / 2;

    CHARACTERS.forEach((c, i) => {
      const active = i === this.selected;
      const x = startX + i * (CARD_W + GAP);
      const y = 130 - (active ? 8 : 0);

      ctx.fillStyle = active ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.04)';
      ctx.strokeStyle = active ? '#ffd54f' : 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = active ? 3 : 1;
      ctx.beginPath();
      ctx.roundRect(x, y, CARD_W, CARD_H, 12);
      ctx.fill();
      ctx.stroke();

      const bob = active ? Math.sin(this.t * 4) * 4 : 0;
      drawCharacter(ctx, c, x + CARD_W / 2, y + 95 + bob, 80);

      drawText(ctx, `${i + 1}. ${c.name}`, x + CARD_W / 2, y + 175, 24, 'center');
      ctx.globalAlpha = 0.7;
      drawText(ctx, c.description, x + CARD_W / 2, y + 202, 14, 'center');
      ctx.globalAlpha = 1;

      drawText(ctx, 'Speed', x + 20, y + 232, 14);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fillRect(x + 80, y + 226, CARD_W - 100, 10);
      ctx.fillStyle = c.color;
      ctx.fillRect(x + 80, y + 226, (CARD_W - 100) * (c.speed / MAX_SPEED), 10);

      drawText(ctx, `★ ${c.perk}`, x + 20, y + 260, 14);
    });

    drawText(ctx, '← → or 1-3 to choose  ·  Enter to start', w / 2, h - 60, 16, 'center');
    ctx.globalAlpha = 0.7;
    drawText(ctx, `High score: ${loadHighScore()}`, w / 2, h - 32, 14, 'center');
    ctx.globalAlpha = 1;
  }
}
