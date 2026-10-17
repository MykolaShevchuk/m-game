import type { Game } from '@/core/Game';
import type { Scene } from '@/core/Scene';
import { loadHighScore, saveHighScore } from '@/core/storage';
import { pointIn } from '@/ui/hit';
import { drawText } from '@/ui/text';
import { ModeSelectScene } from './ModeSelectScene';

export class GameOverScene implements Scene {
  constructor(
    private game: Game,
    private score: number,
    _characterIndex: number,
    private title = 'GAME OVER',
  ) {}

  enter() {
    saveHighScore(this.score);
  }

  update() {
    const input = this.game.input;
    const { width: w, height: h } = this.game;
    const tap = input.peekTap();
    if (tap) {
      if (pointIn(tap, w / 2 - 200, h / 2 + 20, 400, 40)) {
        input.consumeTap();
        this.game.scenes.switch(new ModeSelectScene(this.game));
        return;
      }
      if (pointIn(tap, w / 2 - 200, h / 2 + 60, 400, 40)) {
        input.consumeTap();
        this.game.scenes.switch(new ModeSelectScene(this.game));
        return;
      }
      input.consumeTap();
      this.game.scenes.switch(new ModeSelectScene(this.game));
      return;
    }
    if (input.wasPressed('Enter', 'Space', 'KeyC')) {
      this.game.scenes.switch(new ModeSelectScene(this.game));
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    const cx = this.game.width / 2;
    const cy = this.game.height / 2;
    const touch = this.game.input.touchPreferred;
    drawText(ctx, this.title, cx, cy - 50, 48, 'center');
    drawText(ctx, `Score: ${this.score}   ·   Best: ${loadHighScore()}`, cx, cy + 10, 22, 'center');
    if (touch) {
      drawText(ctx, 'Tap for modes', cx, cy + 50, 18, 'center');
    } else {
      drawText(ctx, 'Enter / C — back to modes', cx, cy + 50, 18, 'center');
    }
  }
}