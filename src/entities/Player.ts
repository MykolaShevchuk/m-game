import { CONFIG } from '@/config';
import type { Input } from '@/core/Input';
import type { WorldMap } from '@/world/WorldMap';
import { Entity } from './Entity';

export class Player extends Entity {
  constructor(
    x: number,
    y: number,
    private input: Input,
    private map: WorldMap,
  ) {
    super(x, y, CONFIG.player.size, CONFIG.player.size);
  }

  // Axes are resolved separately so the player slides along coastlines instead of sticking.
  update(dt: number) {
    const { x, y } = this.input.axis();
    const nx = this.x + x * CONFIG.player.speed * dt;
    if (this.map.isAreaWalkable({ x: nx, y: this.y, w: this.w, h: this.h })) this.x = nx;
    const ny = this.y + y * CONFIG.player.speed * dt;
    if (this.map.isAreaWalkable({ x: this.x, y: ny, w: this.w, h: this.h })) this.y = ny;
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = CONFIG.colors.player;
    ctx.fillRect(this.x, this.y, this.w, this.h);
  }
}
