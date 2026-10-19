import { CONFIG } from '@/config';
import { Input } from './Input';
import { SceneManager } from './Scene';

/** True when the device is on its side — not when the canvas happens to be wide. */
export function isLandscape() {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(orientation: landscape)').matches) return true;
  const type = window.screen?.orientation?.type;
  if (type?.startsWith('landscape')) return true;
  const angle = Number((window as Window & { orientation?: number }).orientation);
  if (Math.abs(angle) === 90) return true;
  return window.innerWidth > window.innerHeight;
}

function readViewport() {
  const vv = window.visualViewport;
  const pairs: [number, number][] = [
    [vv?.width ?? 0, vv?.height ?? 0],
    [window.innerWidth, window.innerHeight],
    [document.documentElement.clientWidth, document.documentElement.clientHeight],
  ];
  const landscape = isLandscape();
  let best: [number, number] | null = null;
  for (const [a, b] of pairs) {
    if (a < 1 || b < 1) continue;
    if (!best) {
      best = [a, b];
      continue;
    }
    const match = landscape ? a >= b : b >= a;
    const bestMatch = landscape ? best[0] >= best[1] : best[1] >= best[0];
    if (match && !bestMatch) best = [a, b];
    else if (match === bestMatch && a * b > best[0] * best[1]) best = [a, b];
  }
  let w = Math.max(1, Math.round(best?.[0] ?? CONFIG.width));
  let h = Math.max(1, Math.round(best?.[1] ?? CONFIG.height));
  if (landscape && w < h) {
    const t = w;
    w = h;
    h = t;
  } else if (!landscape && h < w) {
    const t = w;
    w = h;
    h = t;
  }
  return { w, h };
}

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
    window.addEventListener('orientationchange', this.onOrientationChange);
    window.matchMedia('(orientation: landscape)').addEventListener('change', this.onOrientationChange);
    window.screen?.orientation?.addEventListener('change', this.onOrientationChange);
    window.visualViewport?.addEventListener('resize', this.fitToWindow);
    window.visualViewport?.addEventListener('scroll', this.fitToWindow);
  }

  /** iOS Safari often reports the old size on the rotation event itself. */
  private onOrientationChange = () => {
    document.documentElement.style.display = 'none';
    void document.documentElement.offsetHeight;
    document.documentElement.style.display = '';
    this.fitToWindow();
    requestAnimationFrame(this.fitToWindow);
    window.setTimeout(this.fitToWindow, 80);
    window.setTimeout(this.fitToWindow, 300);
  };

  /** Match the canvas buffer to the visible viewport (iOS Safari rotate-safe). */
  readonly fitToWindow = () => {
    const { w, h } = readViewport();
    const vv = window.visualViewport;
    const left = Math.round(vv?.offsetLeft ?? 0);
    const top = Math.round(vv?.offsetTop ?? 0);
    this.canvas.style.position = 'fixed';
    this.canvas.style.left = `${left}px`;
    this.canvas.style.top = `${top}px`;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
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
