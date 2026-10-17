import { CONFIG } from '@/config';
import { Input } from './Input';
import { SceneManager } from './Scene';

export class Game {
  readonly ctx: CanvasRenderingContext2D;
  readonly input: Input;
  readonly scenes: SceneManager;
  readonly width = CONFIG.width;
  readonly height = CONFIG.height;

  private lastTime = 0;
  private accumulator = 0;
  private running = false;

  constructor(readonly canvas: HTMLCanvasElement) {
    canvas.width = this.width;
    canvas.height = this.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context not supported');
    this.ctx = ctx;
    this.input = new Input(window);
    this.scenes = new SceneManager();
  }

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
