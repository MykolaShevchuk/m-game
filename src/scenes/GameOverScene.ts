import type { Game } from '@/core/Game';
import type { Scene } from '@/core/Scene';
import { loadHighScore, saveHighScore } from '@/core/storage';
import { drawText } from '@/ui/text';
import { PlayScene } from './PlayScene';

export class GameOverScene implements Scene {
  constructor(
    private game: Game,
    private score: number,
  ) {}

  enter() {
    saveHighScore(this.score);
  }

  update() {
    if (this.game.input.wasPressed('Enter', 'Space')) {
      this.game.scenes.switch(new PlayScene(this.game));
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    const cx = this.game.width / 2;
    const cy = this.game.height / 2;
    drawText(ctx, 'GAME OVER', cx, cy - 50, 52, 'center');
    drawText(ctx, `Score: ${this.score}   ·   Best: ${loadHighScore()}`, cx, cy + 10, 22, 'center');
    drawText(ctx, 'Enter to play again', cx, cy + 50, 18, 'center');
  }
}
