import { CONFIG } from '@/config';
import { Camera } from '@/core/Camera';
import type { Game } from '@/core/Game';
import { overlaps } from '@/core/math';
import type { Scene } from '@/core/Scene';
import { Coin } from '@/entities/Coin';
import { Enemy } from '@/entities/Enemy';
import { Player } from '@/entities/Player';
import { drawMinimap } from '@/ui/minimap';
import { drawText } from '@/ui/text';
import { WorldMap } from '@/world/WorldMap';
import { GameOverScene } from './GameOverScene';

export class PlayScene implements Scene {
  private map: WorldMap;
  private camera: Camera;
  private player: Player;
  private enemies: Enemy[] = [];
  private coins: Coin[] = [];
  private score = 0;
  private spawnTimer = 0;
  private paused = false;

  constructor(private game: Game) {
    this.map = new WorldMap(Math.floor(Math.random() * 2 ** 31));
    const spawn = this.map.spawnPoint(CONFIG.player.size);
    this.player = new Player(spawn.x, spawn.y, game.input, this.map);
    this.camera = new Camera(game.width, game.height, this.map.width, this.map.height);
    this.camera.follow(this.player, Infinity);
    this.refillCoins();
  }

  update(dt: number) {
    if (this.game.input.wasPressed('KeyP', 'Escape')) this.paused = !this.paused;
    if (this.paused) return;

    this.spawnTimer += dt;
    if (this.spawnTimer >= CONFIG.enemy.spawnEvery) {
      this.spawnTimer = 0;
      if (this.enemies.length < CONFIG.enemy.max) this.spawnEnemy();
    }

    this.player.update(dt);
    this.enemies.forEach((e) => e.update(dt));
    this.coins.forEach((c) => c.update(dt));
    this.camera.follow(this.player, dt);

    for (const coin of this.coins) {
      if (overlaps(this.player, coin)) {
        coin.alive = false;
        this.score++;
      }
    }
    this.coins = this.coins.filter((c) => c.alive);
    this.refillCoins();

    if (this.enemies.some((e) => overlaps(this.player, e))) {
      this.game.scenes.switch(new GameOverScene(this.game, this.score));
    }
  }

  private refillCoins() {
    while (this.coins.length < CONFIG.coin.count) {
      const p = this.map.randomWalkablePoint(CONFIG.coin.size);
      if (!p) break;
      this.coins.push(new Coin(p.x, p.y));
    }
  }

  // Spawn in a ring around the player: close enough to matter, never on top of them.
  private spawnEnemy() {
    const { size, spawnMinDist, spawnMaxDist } = CONFIG.enemy;
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = spawnMinDist + Math.random() * (spawnMaxDist - spawnMinDist);
      const x = this.player.x + Math.cos(angle) * dist;
      const y = this.player.y + Math.sin(angle) * dist;
      if (this.map.isAreaWalkable({ x, y, w: size, h: size })) {
        this.enemies.push(new Enemy(x, y, this.map));
        return;
      }
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    const cx = Math.round(this.camera.x);
    const cy = Math.round(this.camera.y);
    const { width: w, height: h } = this.game;

    ctx.drawImage(this.map.canvas, cx, cy, w, h, 0, 0, w, h);

    ctx.save();
    ctx.translate(-cx, -cy);
    this.coins.forEach((c) => c.render(ctx));
    this.enemies.forEach((e) => e.render(ctx));
    this.player.render(ctx);
    ctx.restore();

    drawMinimap(ctx, this.map, this.camera, this.player, this.coins);
    drawText(ctx, `Score: ${this.score}`, 16, 24);
    if (this.paused) {
      drawText(ctx, 'PAUSED', w / 2, h / 2, 48, 'center');
    }
  }
}
