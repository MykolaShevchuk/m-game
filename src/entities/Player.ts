import type { CharacterDef } from '@/characters';
import type { Input } from '@/core/Input';
import type { Rect } from '@/core/math';
import { drawCharacter } from '@/ui/drawCharacter';
import type { WorldMap } from '@/world/WorldMap';
import { Entity } from './Entity';

export class Player extends Entity {
  lives: number;
  maxLives: number;
  speed: number;
  magnet: number;
  invulnerableTime = 1.5;

  /** Ability stats; 0 means the ability is locked until upgraded. */
  blinkRange = 0;
  blinkCooldown = 3;
  blinkTimer = 0;
  shieldBash = false;
  regenEvery = 0;
  fireballEvery = 0;

  /** Extra occupancy check, e.g. houses. */
  blocked: (r: Rect) => boolean = () => false;
  facing = { x: 0, y: 1 };

  private regenTimer = 0;
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
    this.lives = this.maxLives = character.lives;
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
    this.blinkTimer = Math.max(0, this.blinkTimer - dt);

    const { x, y } = this.input.axis();
    if (x || y) this.facing = { x, y };
    const nx = this.x + x * this.speed * dt;
    if (this.canStand({ x: nx, y: this.y, w: this.w, h: this.h })) this.x = nx;
    const ny = this.y + y * this.speed * dt;
    if (this.canStand({ x: this.x, y: ny, w: this.w, h: this.h })) this.y = ny;
    this.walkTime = x || y ? this.walkTime + dt : 0;

    if (this.blinkRange > 0 && this.blinkTimer === 0 && this.input.wasPressed('Space')) this.blink();

    if (this.regenEvery > 0 && this.lives < this.maxLives) {
      this.regenTimer += dt;
      if (this.regenTimer >= this.regenEvery) {
        this.regenTimer = 0;
        this.lives++;
      }
    } else {
      this.regenTimer = 0;
    }
  }

  private canStand(r: Rect) {
    return this.map.isAreaWalkable(r) && !this.blocked(r);
  }

  // Lands on the farthest walkable spot along the facing direction, up to blinkRange.
  private blink() {
    for (let d = this.blinkRange; d > 0; d -= 8) {
      const x = this.x + this.facing.x * d;
      const y = this.y + this.facing.y * d;
      if (this.canStand({ x, y, w: this.w, h: this.h })) {
        this.x = x;
        this.y = y;
        this.blinkTimer = this.blinkCooldown;
        this.invulnerable = Math.max(this.invulnerable, 0.25);
        return;
      }
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    if (this.invulnerable > 0 && Math.floor(this.invulnerable * 10) % 2 === 0) return;
    const bob = Math.abs(Math.sin(this.walkTime * 12)) * -3;
    drawCharacter(ctx, this.character, this.x + this.w / 2, this.y + this.h / 2 + bob, this.w * 1.5);
  }
}
