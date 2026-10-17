import { CONFIG } from '@/config';
import type { Game } from '@/core/Game';
import { overlaps } from '@/core/math';
import type { Scene } from '@/core/Scene';
import { Coin } from '@/entities/Coin';
import { Enemy } from '@/entities/Enemy';
import { Player } from '@/entities/Player';
import { drawText } from '@/ui/text';
import { GameOverScene } from './GameOverScene';

export class PlayScene implements Scene {
  private player: Player;
  private enemies: Enemy[] = [];
  private coins: Coin[] = [];
  private score = 0;
  private spawnTimer = 0;
  private paused = false;

  constructor(private game: Game) {
    this.player = new Player(game.width / 2, game.height / 2, game.input);
    for (let i = 0; i < CONFIG.coin.count; i++) this.coins.push(new Coin());
  }

  update(dt: number) {
    if (this.game.input.wasPressed('KeyP', 'Escape')) this.paused = !this.paused;
    if (this.paused) return;

    this.spawnTimer += dt;
    if (this.spawnTimer >= CONFIG.enemy.spawnEvery) {
      this.spawnTimer = 0;
      this.spawnEnemy();
    }

    this.player.update(dt);
    this.enemies.forEach((e) => e.update(dt));
    this.coins.forEach((c) => c.update(dt));

    for (const coin of this.coins) {
      if (overlaps(this.player, coin)) {
        coin.alive = false;
        this.score++;
      }
    }
    this.coins = this.coins.filter((c) => c.alive);
    while (this.coins.length < CONFIG.coin.count) this.coins.push(new Coin());

    if (this.enemies.some((e) => overlaps(this.player, e))) {
      this.game.scenes.switch(new GameOverScene(this.game, this.score));
    }
  }

  // Spawn at a screen edge so enemies never appear on top of the player.
  private spawnEnemy() {
    const { width: w, height: h } = this.game;
    const s = CONFIG.enemy.size;
    const edge = Math.floor(Math.random() * 4);
    const x = edge === 0 ? 0 : edge === 1 ? w - s : Math.random() * (w - s);
    const y = edge === 2 ? 0 : edge === 3 ? h - s : Math.random() * (h - s);
    this.enemies.push(new Enemy(x, y));
  }

  render(ctx: CanvasRenderingContext2D) {
    this.coins.forEach((c) => c.render(ctx));
    this.enemies.forEach((e) => e.render(ctx));
    this.player.render(ctx);

    drawText(ctx, `Score: ${this.score}`, 16, 24);
    if (this.paused) {
      drawText(ctx, 'PAUSED', this.game.width / 2, this.game.height / 2, 48, 'center');
    }
  }
}
