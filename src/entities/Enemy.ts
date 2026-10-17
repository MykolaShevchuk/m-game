import { CONFIG } from '@/config';
import { rand } from '@/core/math';
import type { WorldMap } from '@/world/WorldMap';
import { Entity } from './Entity';

export class Enemy extends Entity {
  private vx: number;
  private vy: number;

  constructor(
    x: number,
    y: number,
    private map: WorldMap,
  ) {
    super(x, y, CONFIG.enemy.size, CONFIG.enemy.size);
    const angle = rand(0, Math.PI * 2);
    const speed = rand(CONFIG.enemy.minSpeed, CONFIG.enemy.maxSpeed);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
  }

  update(dt: number) {
    const nx = this.x + this.vx * dt;
    if (this.map.isAreaWalkable({ x: nx, y: this.y, w: this.w, h: this.h })) this.x = nx;
    else this.vx *= -1;
    const ny = this.y + this.vy * dt;
    if (this.map.isAreaWalkable({ x: this.x, y: ny, w: this.w, h: this.h })) this.y = ny;
    else this.vy *= -1;
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = CONFIG.colors.enemy;
    ctx.fillRect(this.x, this.y, this.w, this.h);
  }
}
