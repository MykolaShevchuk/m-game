import type { CharacterDef } from '@/characters';
import type { Input } from '@/core/Input';
import { drawCharacter } from '@/ui/drawCharacter';
import type { WorldMap } from '@/world/WorldMap';
import { Entity } from './Entity';

export class Player extends Entity {
  lives: number;
  speed: number;
  magnet: number;
  invulnerableTime = 1.5;
  private invulnerable = 0;
  private walkTime = 0;

  constructor(
    x: number,
    y: number,
    private input: Input,
    private map: WorldMap,
    readonly character: CharacterDef,
  ) {
    super(x, y, character.size, character.size);
    this.lives = character.lives;
    this.speed = character.speed;
    this.magnet = character.magnet;
  }

  get isInvulnerable() {
    return this.invulnerable > 0;
  }

  /** Returns true when the hit was fatal. */
  hit() {
    this.lives--;
    this.invulnerable = this.invulnerableTime;
    return this.lives <= 0;
  }

  /** Changes size around the current center. */
  resize(size: number) {
    this.x += (this.w - size) / 2;
    this.y += (this.h - size) / 2;
    this.w = this.h = size;
  }

  // Axes are resolved separately so the player slides along coastlines instead of sticking.
  update(dt: number) {
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    const { x, y } = this.input.axis();
    const nx = this.x + x * this.speed * dt;
    if (this.map.isAreaWalkable({ x: nx, y: this.y, w: this.w, h: this.h })) this.x = nx;
    const ny = this.y + y * this.speed * dt;
    if (this.map.isAreaWalkable({ x: this.x, y: ny, w: this.w, h: this.h })) this.y = ny;
    this.walkTime = x || y ? this.walkTime + dt : 0;
  }

  render(ctx: CanvasRenderingContext2D) {
    if (this.invulnerable > 0 && Math.floor(this.invulnerable * 10) % 2 === 0) return;
    const bob = Math.abs(Math.sin(this.walkTime * 12)) * -3;
    drawCharacter(ctx, this.character, this.x + this.w / 2, this.y + this.h / 2 + bob, this.w * 1.5);
  }
}
