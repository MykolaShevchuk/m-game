import { clamp, type Rect } from './math';

export class Camera {
  x = 0;
  y = 0;

  constructor(
    public viewW: number,
    public viewH: number,
    private worldW: number,
    private worldH: number,
  ) {}

  resize(viewW: number, viewH: number) {
    this.viewW = Math.min(viewW, this.worldW);
    this.viewH = Math.min(viewH, this.worldH);
    this.x = clamp(this.x, 0, Math.max(0, this.worldW - this.viewW));
    this.y = clamp(this.y, 0, Math.max(0, this.worldH - this.viewH));
  }

  /** Smoothly centers on the target; pass dt = Infinity to snap. */
  follow(target: Rect, dt: number) {
    const tx = target.x + target.w / 2 - this.viewW / 2;
    const ty = target.y + target.h / 2 - this.viewH / 2;
    const t = Math.min(1, dt * 8);
    this.x = clamp(this.x + (tx - this.x) * t, 0, this.worldW - this.viewW);
    this.y = clamp(this.y + (ty - this.y) * t, 0, this.worldH - this.viewH);
  }
}
