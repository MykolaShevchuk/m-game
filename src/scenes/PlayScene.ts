import { CHARACTERS } from '@/characters';
import { CONFIG } from '@/config';
import { Camera } from '@/core/Camera';
import type { Game } from '@/core/Game';
import { overlaps } from '@/core/math';
import type { Scene } from '@/core/Scene';
import { Coin } from '@/entities/Coin';
import { Player } from '@/entities/Player';
import { drawMinimap } from '@/ui/minimap';
import { drawText } from '@/ui/text';
import { UpgradePicker } from '@/ui/UpgradePicker';
import { rollUpgrades, type RunModifiers, type Upgrade } from '@/upgrades';
import { WorldMap } from '@/world/WorldMap';

const MAGNET_SPEED = 320;
const BANNER_TIME = 2.5;

export class PlayScene implements Scene {
  private map: WorldMap;
  private camera: Camera;
  private player: Player;
  private coins: Coin[] = [];
  private score = 0;
  private paused = false;
  private mods: RunModifiers = { coinValue: 1, enemySpeed: 1 };
  private nextUpgradeAt = CONFIG.upgradeEvery;
  private picker: UpgradePicker | null = null;
  private upgradesTaken: Upgrade[] = [];
  private currentIsland = -1;
  private visited = new Set<number>();
  private banner = { text: '', time: 0 };

  constructor(
    private game: Game,
    characterIndex: number,
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

    this.player.update(dt);
    this.coins.forEach((c) => c.update(dt));
    this.camera.follow(this.player, dt);
    this.pullCoins(dt);
    this.trackIsland(dt);

    for (const coin of this.coins) {
      if (overlaps(this.player, coin)) {
        coin.alive = false;
        this.score += this.mods.coinValue;
      }
    }
    this.coins = this.coins.filter((c) => c.alive);
    this.refillCoins();
    this.checkUpgrade();
  }

  // The current island is kept while crossing a bridge, so the banner only shows on arrival.
  private trackIsland(dt: number) {
    this.banner.time = Math.max(0, this.banner.time - dt);
    const island = this.map.islandAt(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2);
    if (island < 0 || island === this.currentIsland) return;
    this.currentIsland = island;
    const name = this.map.islands[island].theme.name;
    const isNew = !this.visited.has(island);
    this.visited.add(island);
    this.banner = { text: isNew ? `Discovered ${name}` : name, time: BANNER_TIME };
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

  render(ctx: CanvasRenderingContext2D) {
    const cx = Math.round(this.camera.x);
    const cy = Math.round(this.camera.y);
    const { width: w, height: h } = this.game;

    this.map.draw(ctx, cx, cy, w, h);

    ctx.save();
    ctx.translate(-cx, -cy);
    this.coins.forEach((c) => c.render(ctx));
    this.player.render(ctx);
    ctx.restore();

    drawMinimap(ctx, this.map, this.camera, this.player, this.coins);
    this.renderHud(ctx);
    this.renderIslandInfo(ctx);
    if (this.picker) {
      this.picker.render(ctx, w, h);
    } else if (this.paused) {
      drawText(ctx, 'PAUSED', w / 2, h / 2, 48, 'center');
    }
  }

  private renderIslandInfo(ctx: CanvasRenderingContext2D) {
    const { width: w } = this.game;
    const minimapH = (this.map.height / this.map.width) * CONFIG.minimap.width;
    const name = this.currentIsland >= 0 ? this.map.islands[this.currentIsland].theme.name : 'Open sea';
    drawText(
      ctx,
      `${name}  ·  ${this.visited.size}/${this.map.islands.length} islands`,
      w - CONFIG.minimap.margin,
      CONFIG.minimap.margin + minimapH + 14,
      13,
      'right',
    );

    if (this.banner.time > 0) {
      ctx.globalAlpha = Math.min(1, this.banner.time, (BANNER_TIME - this.banner.time) * 4);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.roundRect(w / 2 - 190, 34, 380, 52, 10);
      ctx.fill();
      drawText(ctx, this.banner.text, w / 2, 60, 26, 'center');
      ctx.globalAlpha = 1;
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
