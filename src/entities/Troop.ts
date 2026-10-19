import type { Rect } from '@/core/math';
import { drawTroop } from '@/ui/drawTroop';
import type { TroopDef } from '@/troops';
import type { WorldMap } from '@/world/WorldMap';
import { Entity } from './Entity';

const FOLLOW_SOFT = 36;
const FORM_SOFT = 10;
const FORM_HARD = 280;

export type TroopOrder = 'follow' | 'garrison';

export class Troop extends Entity {
  attackCd = 0;
  facing = { x: 1, y: 0 };
  /** Server id when playing online. */
  netId?: number;
  private faceFlip = 1;
  private walkTime = 0;
  private offsetAngle: number;
  order: TroopOrder = 'follow';

  constructor(
    x: number,
    y: number,
    readonly def: TroopDef,
    private map: WorldMap,
    slot: number,
    readonly ownerId = 0,
  ) {
    super(x, y, def.size, def.size);
    this.offsetAngle = ((slot % 6) * Math.PI) / 3 + slot * 0.35;
  }

  /** Walk toward a point near `target` using this troop's orbit angle. */
  moveTo(dt: number, target: Rect, blocked: (r: Rect) => boolean, soft = FOLLOW_SOFT, radius = 28) {
    const tx = target.x + target.w / 2 + Math.cos(this.offsetAngle) * radius;
    const ty = target.y + target.h / 2 + Math.sin(this.offsetAngle) * radius;
    this.moveToward(dt, tx, ty, blocked, soft);
  }

  /** Hold a fixed world slot (formation line). */
  formAt(dt: number, tx: number, ty: number, blocked: (r: Rect) => boolean) {
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.moveToward(dt, tx, ty, blocked, FORM_SOFT);
  }

  follow(dt: number, target: Rect, blocked: (r: Rect) => boolean) {
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.moveTo(dt, target, blocked, FOLLOW_SOFT, 28);
  }

  garrisonAt(dt: number, target: Rect, blocked: (r: Rect) => boolean) {
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.moveTo(dt, target, blocked, 22, 42);
  }

  private moveToward(dt: number, tx: number, ty: number, blocked: (r: Rect) => boolean, soft: number) {
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;
    const dx = tx - cx;
    const dy = ty - cy;
    const dist = Math.hypot(dx, dy);

    if (dist > FORM_HARD) {
      this.x = tx - this.w / 2;
      this.y = ty - this.h / 2;
      this.walkTime = 0;
      return;
    }

    if (dist <= soft) {
      this.walkTime = 0;
      return;
    }

    const step = Math.min(dist - soft * 0.5, this.def.speed * dt);
    const nx = this.x + (dx / dist) * step;
    const ny = this.y + (dy / dist) * step;
    const nextX = { x: nx, y: this.y, w: this.w, h: this.h };
    const nextY = { x: this.x, y: ny, w: this.w, h: this.h };
    const ox = this.x;
    const oy = this.y;
    if (this.map.isAreaWalkable(nextX) && !blocked(nextX)) this.x = nx;
    if (this.map.isAreaWalkable(nextY) && !blocked(nextY)) this.y = ny;
    const mx = this.x - ox;
    const my = this.y - oy;
    if (Math.hypot(mx, my) > 1e-4) this.setFacing(mx, my);
    this.walkTime += dt;
  }

  /** Point toward a world position (e.g. enemy on the battle line). */
  lookAt(tx: number, ty: number) {
    const dx = tx - (this.x + this.w / 2);
    const dy = ty - (this.y + this.h / 2);
    if (Math.hypot(dx, dy) > 1e-4) this.setFacing(dx, dy);
  }

  private setFacing(x: number, y: number) {
    if (Math.abs(x) > 0.05) this.faceFlip = x < 0 ? -1 : 1;
    this.facing = { x: this.faceFlip, y: Math.abs(y) < 1e-4 ? 0 : y };
  }

  update() {}

  render(ctx: CanvasRenderingContext2D) {
    const bob = Math.abs(Math.sin(this.walkTime * 12)) * -2;
    drawTroop(ctx, this.def, this.x + this.w / 2, this.y + this.h / 2 + bob, this.w * 1.45, {
      facing: this.facing,
    });
  }
}
