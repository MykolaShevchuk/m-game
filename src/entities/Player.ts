import type { CharacterDef } from '@/characters';
import type { PlayerControls } from '@/core/Input';
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

  attackCd = 0;
  swingT = 0;
  stun = 0;

  private regenTimer = 0;
  private invulnerable = 0;
  /** Seconds spent moving; drives the walk cycle in drawCharacter. */
  walkTime = 0;

  constructor(
    x: number,
    y: number,
    private controls: PlayerControls,
    private map: WorldMap,
    readonly character: CharacterDef,
    readonly id = 0,
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
    if (this.invulnerable > 0 || this.lives <= 0) return false;
    this.lives--;
    this.flashHurt();
    return this.lives <= 0;
  }

  /** Visual/i-frame flash without changing life count (e.g. net sync). */
  flashHurt() {
    this.invulnerable = this.invulnerableTime;
  }

  /** Nudge away from a point after taking a hit. */
  knockback(fromX: number, fromY: number, force = 28) {
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;
    let dx = cx - fromX;
    let dy = cy - fromY;
    const len = Math.hypot(dx, dy) || 1;
    dx = (dx / len) * force;
    dy = (dy / len) * force;
    const nx = this.x + dx;
    const ny = this.y + dy;
    if (this.canStand({ x: nx, y: this.y, w: this.w, h: this.h })) this.x = nx;
    if (this.canStand({ x: this.x, y: ny, w: this.w, h: this.h })) this.y = ny;
  }

  /** Changes size around the current center. */
  resize(size: number) {
    this.x += (this.w - size) / 2;
    this.y += (this.h - size) / 2;
    this.w = this.h = size;
  }

  /** Apply external axis (e.g. from network) without reading local controls. */
  applyAxis(dt: number, x: number, y: number) {
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.blinkTimer = Math.max(0, this.blinkTimer - dt);
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.swingT = Math.max(0, this.swingT - dt);
    this.stun = Math.max(0, this.stun - dt);
    if (this.stun > 0) {
      this.walkTime = 0;
      this.tickRegen(dt);
      return;
    }
    if (x || y) this.facing = { x, y };
    this.slideBy(x * this.speed * dt, y * this.speed * dt);
    this.walkTime = x || y ? this.walkTime + dt : 0;
    this.tickRegen(dt);
  }

  lunge(dist: number) {
    this.slideBy(this.facing.x * dist, this.facing.y * dist);
  }

  // Substeps keep fast movement from burying a corner; each step tries the full
  // vector, then each axis, then a short perpendicular slide so angled shores glide.
  private slideBy(dx: number, dy: number) {
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-6) return;
    const steps = Math.max(1, Math.ceil(dist / 3));
    const sx = dx / steps;
    const sy = dy / steps;
    for (let i = 0; i < steps; i++) this.slideStep(sx, sy);
  }

  private slideStep(dx: number, dy: number) {
    if (this.tryAt(this.x + dx, this.y + dy)) return;
    this.axisWithSlide(dx, 0);
    this.axisWithSlide(0, dy);
  }

  private axisWithSlide(dx: number, dy: number) {
    if (dx === 0 && dy === 0) return;
    if (this.tryAt(this.x + dx, this.y + dy)) return;

    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 7; i++) {
      const mid = (lo + hi) / 2;
      if (this.fits(this.x + dx * mid, this.y + dy * mid)) lo = mid;
      else hi = mid;
    }
    this.x += dx * lo;
    this.y += dy * lo;

    const remX = dx * (1 - lo);
    const remY = dy * (1 - lo);
    if (Math.abs(remX) + Math.abs(remY) < 0.05) return;

    const max = 14;
    for (let s = 1; s <= max; s++) {
      if (remX !== 0) {
        if (this.tryAt(this.x + remX, this.y + s) || this.tryAt(this.x + remX, this.y - s)) return;
      } else if (this.tryAt(this.x + s, this.y + remY) || this.tryAt(this.x - s, this.y + remY)) return;
    }
  }

  private fits(x: number, y: number) {
    return this.canStand({ x, y, w: this.w, h: this.h });
  }

  private tryAt(x: number, y: number) {
    if (!this.fits(x, y)) return false;
    this.x = x;
    this.y = y;
    return true;
  }

  // Axes are resolved separately so the player slides along coastlines instead of sticking.
  update(dt: number) {
    const { x, y } = this.controls.axis();
    this.applyAxis(dt, x, y);
    if (this.blinkRange > 0 && this.blinkTimer === 0 && this.controls.blinkPressed()) this.blink();
  }

  private tickRegen(dt: number) {
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
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;
    const opts = { facing: this.facing, walkTime: this.walkTime };
    if (this.lives <= 0) {
      ctx.globalAlpha = 0.35;
      drawCharacter(ctx, this.character, cx, cy, this.w * 1.5, opts);
      ctx.globalAlpha = 1;
      return;
    }
    if (this.invulnerable > 0 && Math.floor(this.invulnerable * 10) % 2 === 0) return;
    drawCharacter(ctx, this.character, cx, cy, this.w * 1.5, opts);
  }
}
