import { CHARACTERS } from '@/characters';
import { CONFIG } from '@/config';
import { Camera } from '@/core/Camera';
import type { Game } from '@/core/Game';
import { overlaps } from '@/core/math';
import type { Scene } from '@/core/Scene';
import { Coin } from '@/entities/Coin';
import { Enemy } from '@/entities/Enemy';
import { Fireball } from '@/entities/Fireball';
import { Player } from '@/entities/Player';
import { drawMinimap } from '@/ui/minimap';
import { drawText } from '@/ui/text';
import { UpgradePicker } from '@/ui/UpgradePicker';
import { rollUpgrades, type RunModifiers, type Upgrade } from '@/upgrades';
import { WorldMap } from '@/world/WorldMap';
import { GameOverScene } from './GameOverScene';

const MAGNET_SPEED = 320;
const FIREBALL_RANGE = 320;

export class PlayScene implements Scene {
  private map: WorldMap;
  private camera: Camera;
  private player: Player;
  private enemies: Enemy[] = [];
  private coins: Coin[] = [];
  private score = 0;
  private spawnTimer = 0;
  private paused = false;
  private mods: RunModifiers = { coinValue: 1, enemySpeed: 1 };
  private nextUpgradeAt = CONFIG.upgradeEvery;
  private picker: UpgradePicker | null = null;
  private upgradesTaken: Upgrade[] = [];
  private fireballs: Fireball[] = [];
  private fireballTimer = 0;

  constructor(
    private game: Game,
    private characterIndex: number,
  ) {
    const character = CHARACTERS[characterIndex];
    this.map = new WorldMap(Math.floor(Math.random() * 2 ** 31));
    const spawn = this.map.spawnPoint(character.size);
    this.player = new Player(spawn.x, spawn.y, game.input, this.map, character);
    this.camera = new Camera(game.width, game.height, this.map.width, this.map.height);
    this.camera.follow(this.player, Infinity);
    this.refillCoins();
  }

  update(dt: number) {
    if (this.picker) {
      const choice = this.picker.update(this.game.input);
      if (choice) {
        choice.apply({ player: this.player, mods: this.mods });
        this.upgradesTaken.push(choice);
        this.picker = null;
        this.checkUpgrade();
      }
      return;
    }

    if (this.game.input.wasPressed('KeyP', 'Escape')) this.paused = !this.paused;
    if (this.paused) return;

    this.spawnTimer += dt;
    if (this.spawnTimer >= CONFIG.enemy.spawnEvery) {
      this.spawnTimer = 0;
      if (this.enemies.length < CONFIG.enemy.max) this.spawnEnemy();
    }

    this.player.update(dt);
    this.enemies.forEach((e) => e.update(dt * this.mods.enemySpeed));
    this.coins.forEach((c) => c.update(dt));
    this.camera.follow(this.player, dt);
    this.pullCoins(dt);

    for (const coin of this.coins) {
      if (overlaps(this.player, coin)) {
        coin.alive = false;
        this.score += this.mods.coinValue;
      }
    }
    this.coins = this.coins.filter((c) => c.alive);
    this.refillCoins();
    this.checkUpgrade();

    this.updateFireballs(dt);

    for (const enemy of this.enemies) {
      if (!overlaps(this.player, enemy)) continue;
      if (this.player.isInvulnerable) {
        if (this.player.shieldBash) enemy.alive = false;
      } else if (this.player.hit()) {
        this.game.scenes.switch(new GameOverScene(this.game, this.score, this.characterIndex));
        return;
      }
    }
    this.enemies = this.enemies.filter((e) => e.alive);
  }

  private updateFireballs(dt: number) {
    const every = this.player.fireballEvery;
    if (every > 0) {
      this.fireballTimer += dt;
      if (this.fireballTimer >= every) {
        const px = this.player.x + this.player.w / 2;
        const py = this.player.y + this.player.h / 2;
        let target: Enemy | null = null;
        let best = FIREBALL_RANGE;
        for (const e of this.enemies) {
          const d = Math.hypot(e.x + e.w / 2 - px, e.y + e.h / 2 - py);
          if (d < best) {
            best = d;
            target = e;
          }
        }
        if (target) {
          this.fireballTimer = 0;
          this.fireballs.push(new Fireball(px, py, target.x + target.w / 2, target.y + target.h / 2));
        }
      }
    }

    for (const f of this.fireballs) {
      f.update(dt);
      const hit = this.enemies.find((e) => e.alive && overlaps(f, e));
      if (hit) {
        hit.alive = false;
        f.alive = false;
      }
    }
    this.fireballs = this.fireballs.filter((f) => f.alive);
  }

  // Called again after each pick so several thresholds crossed at once each grant an upgrade.
  private checkUpgrade() {
    if (this.score < this.nextUpgradeAt) return;
    const options = rollUpgrades({ player: this.player, mods: this.mods }, 3);
    if (options.length === 0) return;
    this.nextUpgradeAt += CONFIG.upgradeEvery;
    this.picker = new UpgradePicker(options);
  }

  private pullCoins(dt: number) {
    const radius = this.player.magnet;
    if (!radius) return;
    const px = this.player.x + this.player.w / 2;
    const py = this.player.y + this.player.h / 2;
    for (const coin of this.coins) {
      const dx = px - (coin.x + coin.w / 2);
      const dy = py - (coin.y + coin.h / 2);
      const dist = Math.hypot(dx, dy);
      if (dist > 0 && dist < radius) {
        const step = Math.min(dist, MAGNET_SPEED * dt);
        coin.x += (dx / dist) * step;
        coin.y += (dy / dist) * step;
      }
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
    this.fireballs.forEach((f) => f.render(ctx));
    ctx.restore();

    drawMinimap(ctx, this.map, this.camera, this.player, this.coins);
    this.renderHud(ctx);
    if (this.picker) {
      this.picker.render(ctx, w, h);
    } else if (this.paused) {
      drawText(ctx, 'PAUSED', w / 2, h / 2, 48, 'center');
    }
  }

  private renderHud(ctx: CanvasRenderingContext2D) {
    drawText(ctx, `Score: ${this.score}`, 16, 24);
    drawText(ctx, `Lives: ${'♥'.repeat(Math.max(0, this.player.lives))}`, 16, 50);

    const barW = 160;
    const progress = 1 - (this.nextUpgradeAt - this.score) / CONFIG.upgradeEvery;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(16, 68, barW, 8);
    ctx.fillStyle = CONFIG.colors.coin;
    ctx.fillRect(16, 68, barW * Math.min(1, Math.max(0, progress)), 8);
    ctx.globalAlpha = 0.8;
    drawText(ctx, `Next upgrade at ${this.nextUpgradeAt}`, 16 + barW + 10, 72, 12);
    ctx.globalAlpha = 1;

    this.upgradesTaken.forEach((u, i) => {
      ctx.fillStyle = u.color;
      ctx.font = '16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(u.icon, 26 + i * 22, 96);
    });

    const p = this.player;
    if (p.blinkRange > 0) {
      const status = p.blinkTimer > 0 ? `${p.blinkTimer.toFixed(1)}s` : 'ready (Space)';
      drawText(ctx, `Blink: ${status}`, 16, 120, 14);
    }
  }
}
