import { CONFIG } from '@/config';
import type { Rect } from '@/core/math';
import { createNoise, mulberry32 } from './noise';

type RGB = [number, number, number];

const { levels } = CONFIG.world;

const COLORS = {
  abyss: [16, 38, 72],
  deep: [28, 68, 118],
  shallow: [62, 128, 168],
  sand: [214, 198, 142],
  dry: [168, 162, 96],
  grass: [94, 148, 60],
  forest: [44, 92, 44],
  highland: [112, 118, 82],
  rockLow: [118, 108, 98],
  rockHigh: [150, 144, 138],
  snow: [238, 240, 245],
} satisfies Record<string, RGB>;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const band = (e: number, from: number, to: number) => Math.min(1, Math.max(0, (e - from) / (to - from)));

export class WorldMap {
  readonly width = CONFIG.world.width;
  readonly height = CONFIG.world.height;
  readonly cell = CONFIG.world.cell;
  readonly cols = Math.ceil(this.width / this.cell);
  readonly rows = Math.ceil(this.height / this.cell);

  /** Full-resolution rendered terrain, drawn through the camera each frame. */
  readonly canvas: HTMLCanvasElement;
  /** One pixel per cell; used for the minimap. */
  readonly overview: HTMLCanvasElement;

  private elevation: Float32Array;
  private moisture: Float32Array;
  private rand: () => number;

  constructor(readonly seed: number) {
    this.rand = mulberry32(seed ^ 0x9e3779b9);
    this.elevation = new Float32Array(this.cols * this.rows);
    this.moisture = new Float32Array(this.cols * this.rows);
    this.generate();
    this.overview = this.paintOverview();
    this.canvas = this.paintTerrain();
  }

  elevationAt(x: number, y: number) {
    const c = Math.floor(x / this.cell);
    const r = Math.floor(y / this.cell);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return 0;
    return this.elevation[r * this.cols + c];
  }

  isWalkable(x: number, y: number) {
    const e = this.elevationAt(x, y);
    return e >= levels.shallow && e < levels.cliff;
  }

  isAreaWalkable(r: Rect) {
    return (
      this.isWalkable(r.x, r.y) &&
      this.isWalkable(r.x + r.w, r.y) &&
      this.isWalkable(r.x, r.y + r.h) &&
      this.isWalkable(r.x + r.w, r.y + r.h)
    );
  }

  randomWalkablePoint(size: number, accept: (x: number, y: number) => boolean = () => true) {
    for (let i = 0; i < 1000; i++) {
      const x = Math.random() * (this.width - size);
      const y = Math.random() * (this.height - size);
      if (this.isAreaWalkable({ x, y, w: size, h: size }) && accept(x, y)) return { x, y };
    }
    return null;
  }

  /** Walkable point as close to the island centre as possible. */
  spawnPoint(size: number) {
    const cx = this.width / 2;
    const cy = this.height / 2;
    for (let i = 0; i < 4000; i++) {
      const radius = (i / 4000) * Math.min(cx, cy);
      const angle = Math.random() * Math.PI * 2;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      if (this.isAreaWalkable({ x, y, w: size, h: size })) return { x, y };
    }
    return { x: cx, y: cy };
  }

  private generate() {
    const height = createNoise(this.seed);
    const wet = createNoise(this.seed + 1);
    const { cols, rows } = this;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const nx = c / cols;
        const ny = r / rows;
        const aspect = cols / rows;
        // Square-bump falloff pushes the borders under the sea so the map reads as an island.
        const dx = nx * 2 - 1;
        const dy = ny * 2 - 1;
        const falloff = (1 - dx * dx) * (1 - dy * dy);
        const n = height.fbm(nx * 4 * aspect, ny * 4, 6);
        const i = r * cols + c;
        this.elevation[i] = n * 0.6 + falloff * 0.4;
        this.moisture[i] = wet.fbm(nx * 3 * aspect + 50, ny * 3 + 50, 4);
      }
    }
  }

  private colorAt(e: number, m: number): RGB {
    if (e < levels.deep) return mix(COLORS.abyss, COLORS.deep, band(e, 0.1, levels.deep));
    if (e < levels.shallow) return mix(COLORS.deep, COLORS.shallow, band(e, levels.deep, levels.shallow));
    if (e < levels.beach) return COLORS.sand;
    if (e < levels.rock) {
      const vegetation =
        m < 0.45 ? mix(COLORS.dry, COLORS.grass, band(m, 0.3, 0.45)) : mix(COLORS.grass, COLORS.forest, band(m, 0.45, 0.65));
      return mix(vegetation, COLORS.highland, band(e, levels.beach, levels.rock) * 0.5);
    }
    if (e < levels.snow) return mix(COLORS.rockLow, COLORS.rockHigh, band(e, levels.rock, levels.snow));
    return COLORS.snow;
  }

  private paintOverview() {
    const { cols, rows } = this;
    const canvas = document.createElement('canvas');
    canvas.width = cols;
    canvas.height = rows;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(cols, rows);
    const at = (c: number, r: number) =>
      this.elevation[Math.min(rows - 1, Math.max(0, r)) * cols + Math.min(cols - 1, Math.max(0, c))];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const e = this.elevation[i];
        const [cr, cg, cb] = this.colorAt(e, this.moisture[i]);

        // Hillshade with light from the north-west; water stays flat.
        let shade = 1;
        if (e >= levels.shallow) {
          const gx = at(c + 1, r) - at(c - 1, r);
          const gy = at(c, r + 1) - at(c, r - 1);
          shade = Math.min(1.35, Math.max(0.6, 1 - (gx + gy) * 45));
        }
        const grain = 0.95 + this.rand() * 0.1;
        const k = shade * grain;

        img.data[i * 4] = Math.min(255, cr * k);
        img.data[i * 4 + 1] = Math.min(255, cg * k);
        img.data[i * 4 + 2] = Math.min(255, cb * k);
        img.data[i * 4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  private paintTerrain() {
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.overview, 0, 0, this.width, this.height);
    this.paintDecorations(ctx);
    return canvas;
  }

  private paintDecorations(ctx: CanvasRenderingContext2D) {
    const props: { x: number; y: number; kind: 'tree' | 'rock'; size: number }[] = [];
    const attempts = this.cols * this.rows * 0.12;

    for (let i = 0; i < attempts; i++) {
      const x = this.rand() * this.width;
      const y = this.rand() * this.height;
      const c = Math.floor(x / this.cell);
      const r = Math.floor(y / this.cell);
      const e = this.elevation[r * this.cols + c];
      const m = this.moisture[r * this.cols + c];

      if (e > levels.beach + 0.01 && e < levels.rock - 0.02) {
        const density = band(m, 0.4, 0.7) * 0.9 + 0.03;
        if (this.rand() < density) props.push({ x, y, kind: 'tree', size: 4 + this.rand() * 5 });
      } else if (e >= levels.rock && e < levels.snow && this.rand() < 0.08) {
        props.push({ x, y, kind: 'rock', size: 2 + this.rand() * 4 });
      }
    }

    props.sort((a, b) => a.y - b.y);
    for (const p of props) {
      if (p.kind === 'tree') this.drawTree(ctx, p.x, p.y, p.size);
      else this.drawRock(ctx, p.x, p.y, p.size);
    }
  }

  private drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
    const g = 70 + this.rand() * 40;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(x + s * 0.5, y + s * 0.6, s, s * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgb(${g * 0.35}, ${g}, ${g * 0.35})`;
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(${g * 0.8}, ${g * 1.6}, ${g * 0.6}, 0.45)`;
    ctx.beginPath();
    ctx.arc(x - s * 0.3, y - s * 0.3, s * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawRock(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
    const v = 95 + this.rand() * 50;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x + s * 0.4, y + s * 0.4, s, s * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgb(${v}, ${v * 0.95}, ${v * 0.9})`;
    ctx.beginPath();
    ctx.ellipse(x, y, s, s * 0.75, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}
