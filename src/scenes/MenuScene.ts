import type { Game } from '@/core/Game';
import type { Scene } from '@/core/Scene';
import { loadHighScore } from '@/core/storage';
import { drawText } from '@/ui/text';
import { PlayScene } from './PlayScene';

export class MenuScene implements Scene {
  constructor(private game: Game) {}

  update() {
    if (this.game.input.wasPressed('Enter', 'Space')) {
      this.game.scenes.switch(new PlayScene(this.game));
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    const cx = this.game.width / 2;
    const cy = this.game.height / 2;
    drawText(ctx, 'M-GAME', cx, cy - 60, 56, 'center');
    drawText(ctx, 'Collect coins, dodge red squares', cx, cy, 20, 'center');
    drawText(ctx, 'WASD / Arrows to move  ·  Enter to start', cx, cy + 40, 18, 'center');
    drawText(ctx, `High score: ${loadHighScore()}`, cx, cy + 90, 18, 'center');
  }
}
