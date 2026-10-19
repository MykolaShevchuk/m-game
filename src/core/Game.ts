import { CONFIG } from '@/config';
import { Input } from './Input';
import { SceneManager } from './Scene';

export class Game {
  readonly ctx: CanvasRenderingContext2D;
  readonly input: Input;
  readonly scenes: SceneManager;
  width: number = CONFIG.width;
  height: number = CONFIG.height;

  private lastTime = 0;
  private accumulator = 0;
  private running = false;

  constructor(readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context not supported');
    this.ctx = ctx;
    this.input = new Input(canvas);
    this.scenes = new SceneManager();
    this.fitToWindow();
    window.addEventListener('resize', this.fitToWindow);
    window.visualViewport?.addEventListener('resize', this.fitToWindow);
    window.visualViewport?.addEventListener('scroll', this.fitToWindow);
  }

  /** Match the canvas buffer to the visible viewport (iPad Safari chrome-safe). */
  readonly fitToWindow = () => {
    const vv = window.visualViewport;
    const w = Math.max(1, Math.round(vv?.width ?? window.innerWidth));
    const h = Math.max(1, Math.round(vv?.height ?? window.innerHeight));
    if (w === this.width && h === this.height && this.canvas.width === w && this.canvas.height === h) return;
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
  };

  start() {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
  }

  // Fixed-timestep update keeps physics deterministic regardless of display refresh rate.
  private frame = (now: number) => {
    if (!this.running) return;
    const delta = Math.min((now - this.lastTime) / 1000, 0.25);
    this.lastTime = now;
    this.accumulator += delta;

    while (this.accumulator >= CONFIG.fixedStep) {
      this.scenes.update(CONFIG.fixedStep);
      this.input.endFrame();
      this.accumulator -= CONFIG.fixedStep;
    }

    this.ctx.fillStyle = CONFIG.colors.bg;
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.scenes.render(this.ctx);

    requestAnimationFrame(this.frame);
  };
}
