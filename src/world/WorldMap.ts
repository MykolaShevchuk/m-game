import { CONFIG } from '@/config';
import type { Rect } from '@/core/math';
import { createNoise, mulberry32 } from './noise';
import { THEMES, type IslandTheme, type RGB, type TreeStyle } from './themes';

const { levels } = CONFIG.world;
const CHUNK = CONFIG.world.chunk;
const MAX_CACHED_CHUNKS = 48;
/** Deck half-width in px. Must exceed the largest character (Knight is 26). */
const BRIDGE_HALF_WIDTH = 28;

const WATER = {
  abyss: [22, 42, 58],
  deep: [36, 72, 98],
  shallow: [68, 118, 138],
  bridge: [128, 96, 64],
} satisfies Record<string, RGB>;

interface Island {
  x: number;
  y: number;
  r: number;
  theme: IslandTheme;
}

interface Bridge {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

export interface VillageSite {
  x: number;
  y: number;
  island: number;
}

type PropKind = TreeStyle | 'rock' | 'bush' | 'flower' | 'reed' | 'pebble' | 'tuft' | 'coral' | 'crystal';

interface Prop {
  x: number;
  y: number;
  size: number;
  kind: PropKind;
  color: RGB;
  seed: number;
  snowy: boolean;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const band = (e: number, from: number, to: number) => Math.min(1, Math.max(0, (e - from) / (to - from)));
const rgb = (c: RGB, k = 1, a = 1) => `rgba(${c[0] * k}, ${c[1] * k}, ${c[2] * k}, ${a})`;

export class WorldMap {
  readonly width = CONFIG.world.width;
  readonly height = CONFIG.world.height;
  readonly cell = CONFIG.world.cell;
  readonly cols = Math.ceil(this.width / this.cell);
  readonly rows = Math.ceil(this.height / this.cell);
  readonly islands: Island[] = [];
  readonly villageSites: VillageSite[] = [];

  /** One pixel per cell; used for the minimap and as the base layer of each chunk. */
  readonly overview: HTMLCanvasElement;

  private elevation: Float32Array;
  private moisture: Float32Array;
  private islandOf: Int8Array;
  private bridgeMask: Uint8Array;
  private reachable: Uint8Array;
  private bridges: Bridge[] = [];
  private propBuckets: Prop[][];
  private chunks = new Map<number, HTMLCanvasElement>();
  private chunkCols = Math.ceil(this.width / CHUNK);
  private rand: () => number;

  constructor(readonly seed: number) {
    this.rand = mulberry32(seed ^ 0x9e3779b9);
    const n = this.cols * this.rows;
    this.elevation = new Float32Array(n);
    this.moisture = new Float32Array(n);
    this.islandOf = new Int8Array(n);
    this.bridgeMask = new Uint8Array(n);
    this.reachable = new Uint8Array(n);
    this.propBuckets = Array.from({ length: this.chunkCols * Math.ceil(this.height / CHUNK) }, () => []);

    this.placeIslands();
    this.generate();
    this.buildBridges();
    this.floodReachable();
    this.placeVillages();
    this.overview = this.paintOverview();
    this.scatterProps();
  }

  private index(x: number, y: number) {
    const c = Math.floor(x / this.cell);
    const r = Math.floor(y / this.cell);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return -1;
    return r * this.cols + c;
  }

  elevationAt(x: number, y: number) {
    const i = this.index(x, y);
    return i < 0 ? 0 : this.elevation[i];
  }

  isWalkable(x: number, y: number) {
    const i = this.index(x, y);
    return i >= 0 && this.cellWalkable(i);
  }

  // Inset corners so a 1px overflow doesn't block, and a narrower test on bridges
  // so the player can cross even when their sprite is wider than the water gap.
  isAreaWalkable(r: Rect) {
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const mid = this.index(cx, cy);
    if (mid >= 0 && this.bridgeMask[mid]) {
      const inset = 4;
      return (
        this.isWalkable(cx, cy) &&
        this.isWalkable(cx - inset, cy) &&
        this.isWalkable(cx + inset, cy) &&
        this.isWalkable(cx, cy - inset) &&
        this.isWalkable(cx, cy + inset)
      );
    }
    const x1 = r.x + Math.max(0, r.w - 1);
    const y1 = r.y + Math.max(0, r.h - 1);
    return (
      this.isWalkable(r.x, r.y) &&
      this.isWalkable(x1, r.y) &&
      this.isWalkable(r.x, y1) &&
      this.isWalkable(x1, y1) &&
      this.isWalkable(cx, cy)
    );
  }

  private cellWalkable(i: number) {
    if (this.bridgeMask[i]) return true;
    return this.elevation[i] >= levels.shallow;
  }

  /** Index of the island under (x, y), or -1 for water and bridges. */
  islandAt(x: number, y: number) {
    const i = this.index(x, y);
    if (i < 0 || this.bridgeMask[i] || this.elevation[i] < levels.shallow) return -1;
    return this.islandOf[i];
  }

  randomWalkablePoint(size: number, accept: (x: number, y: number) => boolean = () => true) {
    for (let n = 0; n < 2000; n++) {
      const x = this.rand() * (this.width - size);
      const y = this.rand() * (this.height - size);
      const idx = this.index(x + size / 2, y + size / 2);
      if (idx >= 0 && this.reachable[idx] && this.isAreaWalkable({ x, y, w: size, h: size }) && accept(x, y)) {
        return { x, y };
      }
    }
    return null;
  }

  private placeVillages() {
    const want = [0, 2, 3, 5, 7, 8];
    for (const island of want) {
      if (island >= this.islands.length) continue;
      const spot = this.findVillageSite(island);
      if (spot) this.villageSites.push({ ...spot, island });
    }
  }

  private findVillageSite(island: number) {
    const { x: cx, y: cy, r } = this.islands[island];
    const w = 172;
    const h = 132;
    for (let n = 0; n < 900; n++) {
      const ang = this.rand() * Math.PI * 2;
      const dist = r * (0.18 + this.rand() * 0.28);
      const x = cx + Math.cos(ang) * dist - w / 2;
      const y = cy + Math.sin(ang) * dist - h / 2;
      if (island === 0 && Math.hypot(x + w / 2 - cx, y + h / 2 - cy) < 200) continue;
      if (this.villageSiteFits(x, y, w, h, island)) return { x, y };
    }
    return null;
  }

  private villageSiteFits(x: number, y: number, w: number, h: number, island: number) {
    const step = 18;
    for (let py = y + 8; py < y + h - 8; py += step) {
      for (let px = x + 8; px < x + w - 8; px += step) {
        if (this.islandAt(px, py) !== island) return false;
        if (!this.isWalkable(px, py)) return false;
      }
    }
    return true;
  }

  /** Walkable point as close to the first island's centre as possible. */
  spawnPoint(size: number) {
    const { x: cx, y: cy, r } = this.islands[0];
    for (let i = 0; i < 4000; i++) {
      const radius = (i / 4000) * r;
      const angle = Math.random() * Math.PI * 2;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      if (this.isAreaWalkable({ x, y, w: size, h: size })) return { x, y };
    }
    return { x: cx, y: cy };
  }

  /** Draws the visible part of the world; chunks are rendered lazily and cached. */
  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number, viewW: number, viewH: number) {
    const x0 = Math.max(0, Math.floor(camX / CHUNK));
    const y0 = Math.max(0, Math.floor(camY / CHUNK));
    const x1 = Math.floor((camX + viewW - 1) / CHUNK);
    const y1 = Math.floor((camY + viewH - 1) / CHUNK);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        ctx.drawImage(this.chunk(cx, cy), cx * CHUNK - camX, cy * CHUNK - camY);
      }
    }
    this.drawWaves(ctx, camX, camY, viewW, viewH, performance.now() / 1000);
  }

  private isOpenWater(x: number, y: number) {
    const i = this.index(x, y);
    return i >= 0 && !this.bridgeMask[i] && this.elevation[i] < levels.shallow;
  }

  private touchesLand(x: number, y: number) {
    const s = this.cell * 2;
    return (
      !this.isOpenWater(x + s, y) ||
      !this.isOpenWater(x - s, y) ||
      !this.isOpenWater(x, y + s) ||
      !this.isOpenWater(x, y - s)
    );
  }

  private drawWaves(ctx: CanvasRenderingContext2D, camX: number, camY: number, viewW: number, viewH: number, t: number) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const layers = [
      { step: 20, sample: 8, freq: 0.014, speed: 1.0, yfreq: 0.006, amp: 6.5, width: 2.4, light: 0.22, dark: 0.14 },
      { step: 13, sample: 7, freq: 0.024, speed: 1.55, yfreq: 0.01, amp: 3.8, width: 1.6, light: 0.16, dark: 0.1 },
      { step: 8, sample: 6, freq: 0.036, speed: 2.1, yfreq: 0.016, amp: 2.2, width: 1.1, light: 0.11, dark: 0.07 },
    ] as const;

    const strokeLayer = (kind: 'light' | 'dark') => {
      for (const layer of layers) {
        ctx.strokeStyle =
          kind === 'light'
            ? `rgba(${WATER.shallow[0] + 42}, ${WATER.shallow[1] + 30}, ${WATER.shallow[2] + 20}, ${layer.light})`
            : `rgba(${WATER.deep[0] - 6}, ${WATER.deep[1] - 10}, ${WATER.deep[2] - 8}, ${layer.dark})`;
        ctx.lineWidth = kind === 'light' ? layer.width : layer.width + 0.9;
        const shift = kind === 'dark' ? Math.PI : 0;
        // Snap rows/samples to the world grid so waves stay put as the camera moves.
        const y0 = Math.floor((camY - layer.amp - 6) / layer.step) * layer.step;
        const y1 = camY + viewH + layer.amp + 6;
        const x0 = Math.floor(camX / layer.sample) * layer.sample;
        const x1 = camX + viewW;
        for (let wy = y0; wy <= y1; wy += layer.step) {
          const sy = wy - camY;
          ctx.beginPath();
          let drawing = false;
          for (let wx = x0; wx <= x1; wx += layer.sample) {
            const sx = wx - camX;
            if (!this.isOpenWater(wx, wy)) {
              if (drawing) {
                ctx.stroke();
                ctx.beginPath();
                drawing = false;
              }
              continue;
            }
            const e = this.elevationAt(wx, wy);
            const amp = layer.amp * (e > levels.deep ? 0.5 : 1);
            const phase = wx * layer.freq + t * layer.speed + wy * layer.yfreq + shift;
            const py =
              sy +
              Math.sin(phase) * amp +
              Math.sin(phase * 0.5 + wy * 0.02) * amp * 0.4 +
              Math.sin(phase * 1.7 + wx * 0.01) * amp * 0.15;
            if (!drawing) {
              ctx.moveTo(sx, py);
              drawing = true;
            } else {
              ctx.lineTo(sx, py);
            }
          }
          if (drawing) ctx.stroke();
        }
      }
    };

    strokeLayer('dark');
    strokeLayer('light');

    ctx.fillStyle = `rgba(${WATER.shallow[0] + 50}, ${WATER.shallow[1] + 38}, ${WATER.shallow[2] + 28}, 0.18)`;
    const foam = 18;
    const fy0 = Math.floor(camY / foam) * foam;
    const fx0 = Math.floor(camX / foam) * foam;
    for (let wy = fy0; wy < camY + viewH; wy += foam) {
      for (let wx = fx0; wx < camX + viewW; wx += foam) {
        if (!this.isOpenWater(wx, wy)) continue;
        if (this.elevationAt(wx, wy) <= levels.deep) continue;
        if (!this.touchesLand(wx, wy)) continue;
        const pulse = 0.5 + 0.5 * Math.sin(wx * 0.045 + t * 2.0 + wy * 0.03);
        if (pulse < 0.65) continue;
        const sx = wx - camX;
        const sy = wy - camY;
        ctx.beginPath();
        ctx.ellipse(
          sx + 4,
          sy + Math.sin(t * 1.4 + wx * 0.04) * 1.6,
          3 + pulse * 3,
          1.1 + pulse * 0.5,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private placeIslands() {
    const count = CONFIG.world.islands;
    for (let attempt = 0; this.islands.length < count && attempt < 50000; attempt++) {
      const shrink = attempt > 25000 ? 0.7 : 1;
      const r = (600 + this.rand() * 350) * shrink;
      const margin = r * 0.75 + 60;
      const x = margin + this.rand() * (this.width - margin * 2);
      const y = margin + this.rand() * (this.height - margin * 2);
      // Land reaches roughly 0.65 r, so this leaves a clear strait between neighbours.
      if (this.islands.every((o) => Math.hypot(o.x - x, o.y - y) > (o.r + r) * 0.72 + 180)) {
        this.islands.push({ x, y, r, theme: THEMES[this.islands.length % THEMES.length] });
      }
    }
  }

  private generate() {
    const height = createNoise(this.seed);
    const wet = createNoise(this.seed + 1);
    const warp = createNoise(this.seed + 2);
    const { cols, rows, cell } = this;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const px = (c + 0.5) * cell;
        const py = (r + 0.5) * cell;
        // Domain warping bends coastlines into bays and peninsulas instead of circles.
        const wx = px + (warp.fbm(px / 500, py / 500, 4) - 0.5) * 900 + (warp.fbm(px / 90, py / 90, 2) - 0.5) * 70;
        const wy = py + (warp.fbm(px / 500 + 31, py / 500 + 17, 4) - 0.5) * 900 + (warp.fbm(px / 90 + 11, py / 90 + 4, 2) - 0.5) * 70;
        const w = 0.7 + 0.6 * warp.fbm(px / 300 + 7, py / 300 + 7, 3);

        let best = 0;
        let owner = -1;
        for (let i = 0; i < this.islands.length; i++) {
          const isl = this.islands[i];
          const f = 1 - Math.hypot(wx - isl.x, wy - isl.y) / (isl.r * w);
          if (f > best) {
            best = f;
            owner = i;
          }
        }

        const falloff = best > 0 ? 1 - (1 - best) ** 2 : 0;
        const n = height.fbm(px / 640, py / 640, 6);
        const ridge = Math.abs(height.fbm(px / 210 + 9, py / 210 + 4, 3) - 0.5) * 2;
        const i = r * cols + c;
        this.elevation[i] = falloff * (0.36 + 0.5 * n + 0.14 * (1 - ridge));
        this.islandOf[i] = owner;
        this.moisture[i] = wet.fbm(px / 850 + 50, py / 850 + 50, 4) + (owner >= 0 ? this.islands[owner].theme.moisture : 0);
      }
    }
  }

  // Minimum spanning tree over island centres guarantees every island is reachable; two extra links add loops.
  private buildBridges() {
    const n = this.islands.length;
    const dist = (a: number, b: number) =>
      Math.hypot(this.islands[a].x - this.islands[b].x, this.islands[a].y - this.islands[b].y);
    const linked = new Set<string>();
    const tree = [0];

    while (tree.length < n) {
      let best: [number, number] | null = null;
      for (const a of tree) {
        for (let b = 0; b < n; b++) {
          if (tree.includes(b)) continue;
          if (!best || dist(a, b) < dist(best[0], best[1])) best = [a, b];
        }
      }
      if (!best) break;
      tree.push(best[1]);
      linked.add(`${Math.min(...best)}-${Math.max(...best)}`);
    }

    const extras: [number, number][] = [];
    for (let a = 0; a < n; a++) {
      for (let b = a + 1; b < n; b++) if (!linked.has(`${a}-${b}`)) extras.push([a, b]);
    }
    extras.sort((p, q) => dist(p[0], p[1]) - dist(q[0], q[1]));
    for (const [a, b] of extras.slice(0, 2)) linked.add(`${a}-${b}`);

    for (const key of linked) {
      const [a, b] = key.split('-').map(Number);
      this.carveBridge(this.islands[a], this.islands[b]);
    }
  }

  // Marks every cell connected to the spawn island so coins never land on unbridged islets.
  private floodReachable() {
    const start = this.spawnPoint(1);
    const first = this.index(start.x, start.y);
    if (first < 0) return;
    const { cols, rows } = this;
    const stack = [first];
    this.reachable[first] = 1;
    const walkable = (i: number) => this.cellWalkable(i);
    while (stack.length) {
      const i = stack.pop()!;
      const c = i % cols;
      const r = (i - c) / cols;
      const next = [c > 0 ? i - 1 : -1, c < cols - 1 ? i + 1 : -1, r > 0 ? i - cols : -1, r < rows - 1 ? i + cols : -1];
      for (const j of next) {
        if (j >= 0 && !this.reachable[j] && walkable(j)) {
          this.reachable[j] = 1;
          stack.push(j);
        }
      }
    }
  }

  private carveBridge(a: Island, b: Island) {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    const step = this.cell / 2;
    for (let t = 0; t <= len; t += step) {
      // Flare the ends so the mouth is easy to walk onto from any approach angle.
      const shore = Math.min(t, len - t);
      const half = BRIDGE_HALF_WIDTH + (shore < 40 ? (40 - shore) * 0.4 : 0);
      for (let o = -half; o <= half; o += step) {
        const i = this.index(a.x + ux * t - uy * o, a.y + uy * t + ux * o);
        if (i >= 0 && this.elevation[i] < levels.shallow) this.bridgeMask[i] = 1;
      }
    }
    this.bridges.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y });
  }

  private themeAt(i: number) {
    const owner = this.islandOf[i];
    return owner >= 0 ? this.islands[owner].theme : THEMES[0];
  }

  private colorAt(e: number, m: number, t: IslandTheme, grain: number): RGB {
    const snowy = !!t.snowyTrees;
    if (e < levels.deep) {
      const deep = mix(WATER.abyss, WATER.deep, band(e, 0.08, levels.deep));
      const base = mix(deep, WATER.shallow, grain * 0.12);
      return snowy ? mix(base, [48, 78, 98], 0.22) : base;
    }
    if (e < levels.shallow) {
      const water = mix(WATER.deep, WATER.shallow, band(e, levels.deep, levels.shallow));
      const base = mix(water, [180, 210, 220], grain * 0.18);
      return snowy ? mix(base, [160, 198, 214], 0.28) : base;
    }
    if (e < levels.beach) {
      if (snowy) {
        // Icy shore — pale ice over cold sand.
        const ice = mix([168, 192, 208], t.sand, 0.45 + grain * 0.2);
        return mix(ice, t.peak, band(e, levels.shallow, levels.beach) * 0.35);
      }
      const wet: RGB = [t.sand[0] * 0.72, t.sand[1] * 0.78, t.sand[2] * 0.82];
      return mix(wet, t.sand, band(e, levels.shallow, levels.beach) * 0.85 + grain * 0.15);
    }
    if (e < levels.rock) {
      if (snowy) {
        // Snowfield with soft blue shadows in hollows.
        const drift = mix(t.grass, t.peak, 0.55 + grain * 0.35);
        const hollow = mix(drift, [168, 188, 208], (1 - grain) * 0.35);
        const rise = mix(hollow, t.highland, band(e, levels.beach, levels.rock) * 0.25);
        return mix(rise, t.peak, band(e, levels.beach, levels.rock) * 0.4);
      }
      const vegetation = m < 0.42 ? mix(t.dry, t.grass, band(m, 0.22, 0.42)) : mix(t.grass, t.forest, band(m, 0.42, 0.72));
      const slope = mix(vegetation, t.highland, band(e, levels.beach, levels.rock) * 0.55);
      return mix(slope, t.forest, (grain - 0.5) * 0.22);
    }
    if (e < levels.cliff) {
      if (snowy) return mix(mix(t.highland, t.rockLow, 0.35), t.peak, 0.55 + grain * 0.25);
      return mix(t.highland, t.rockLow, band(e, levels.rock, levels.cliff));
    }
    if (e < levels.snow) {
      const rock = mix(t.rockLow, t.rockHigh, band(e, levels.cliff, levels.snow));
      if (snowy) return mix(rock, t.peak, 0.7 + grain * 0.2);
      return mix(rock, t.rockLow, grain * 0.2);
    }
    return mix(t.rockHigh, t.peak, 0.65 + grain * 0.35);
  }

  private paintOverview() {
    const { cols, rows } = this;
    const canvas = document.createElement('canvas');
    canvas.width = cols;
    canvas.height = rows;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(cols, rows);
    const detail = createNoise(this.seed + 19);
    const at = (c: number, r: number) =>
      this.elevation[Math.min(rows - 1, Math.max(0, r)) * cols + Math.min(cols - 1, Math.max(0, c))];
    const wet = (c: number, r: number) => {
      for (const [dc, dr] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [-1, 1],
      ] as const) {
        if (at(c + dc, r + dr) < levels.shallow) return true;
      }
      return false;
    };

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const e = this.elevation[i];
        const t = this.themeAt(i);
        const grain = detail.fbm(c / 18, r / 18, 4);
        let col = this.bridgeMask[i]
          ? mix(WATER.bridge, [110, 78, 48], ((c + r) & 1) * 0.25)
          : this.colorAt(e, this.moisture[i], t, grain);

        if (!this.bridgeMask[i] && e >= levels.shallow && e < levels.beach + 0.03 && wet(c, r)) {
          col = mix(col, t.snowyTrees ? [200, 220, 232] : [210, 220, 224], 0.18 + grain * 0.14);
        }
        if (!this.bridgeMask[i] && e < levels.shallow) {
          const foam = detail.fbm(c / 9 + 8, r / 9 + 3, 3);
          if (e > levels.deep && foam > 0.66) {
            col = mix(col, t.snowyTrees ? [210, 228, 238] : [190, 210, 216], (foam - 0.66) * 1.1);
          }
        }
        if (t.name === 'Ember Isle' && e >= levels.rock) {
          const vein = detail.fbm(c / 11, r / 11, 3);
          if (vein > 0.58) col = mix(col, t.peak, (vein - 0.58) * 1.6);
        }
        if (t.snowyTrees && e >= levels.beach) {
          // Drifts and wind-scoured patches across the snowfield.
          const drift = detail.fbm(c / 14 + 3, r / 14 + 7, 3);
          if (drift > 0.55) col = mix(col, t.peak, (drift - 0.55) * 1.3);
          else if (drift < 0.32) col = mix(col, [158, 178, 198], (0.32 - drift) * 0.9);
          // Sparse dark rock poking through.
          if (grain > 0.82 && e >= levels.rock) col = mix(col, t.rockLow, 0.45);
        }

        let shade = 1;
        if (e >= levels.shallow) {
          const gx = at(c + 1, r) - at(c - 1, r);
          const gy = at(c, r + 1) - at(c, r - 1);
          const n = Math.hypot(gx * 70, gy * 70, 1);
          shade = Math.min(1.4, Math.max(0.55, (0.55 + (-gx * 70 + gy * 70 + 1) / n) * 0.95));
        } else {
          shade = 0.92 + grain * 0.1;
        }
        const k = shade * (0.94 + this.rand() * 0.12);

        img.data[i * 4] = Math.min(255, col[0] * k);
        img.data[i * 4 + 1] = Math.min(255, col[1] * k);
        img.data[i * 4 + 2] = Math.min(255, col[2] * k);
        img.data[i * 4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  private scatterProps() {
    const props: Prop[] = [];
    const add = (p: Prop) => props.push(p);
    const tint = (c: RGB, j: number): RGB => [c[0] * j, c[1] * j, c[2] * j];
    const attempts = this.cols * this.rows * 0.28;

    for (let n = 0; n < attempts; n++) {
      const x = this.rand() * this.width;
      const y = this.rand() * this.height;
      const i = this.index(x, y);
      if (i < 0 || this.islandOf[i] < 0 || this.bridgeMask[i]) continue;
      const e = this.elevation[i];
      const t = this.themeAt(i);
      const m = this.moisture[i];
      const roll = this.rand();

      if (e < levels.shallow && e > levels.deep) {
        if (roll < 0.045) {
          add({
            x,
            y,
            kind: t.tree === 'palm' || t.name === 'Mire Isle' ? 'coral' : 'pebble',
            size: 1.4 + this.rand() * 2.2,
            color: t.tree === 'palm' ? [70, 160, 130] : mix(WATER.shallow, t.sand, 0.4),
            seed: this.rand(),
            snowy: false,
          });
        }
        continue;
      }

      if (e >= levels.shallow && e <= levels.beach + 0.012) {
        if (roll < 0.16) {
          add({
            x,
            y,
            kind: 'pebble',
            size: 1.2 + this.rand() * 2.4,
            color: tint(t.snowyTrees ? [200, 214, 226] : t.sand, 0.7 + this.rand() * 0.35),
            seed: this.rand(),
            snowy: !!t.snowyTrees,
          });
        } else if (roll < 0.2 && (t.tree === 'palm' || t.name === 'Mire Isle')) {
          add({
            x,
            y,
            kind: 'reed',
            size: 3 + this.rand() * 3,
            color: t.tree === 'palm' ? [70, 140, 70] : [70, 90, 45],
            seed: this.rand(),
            snowy: false,
          });
        } else if (t.snowyTrees && roll < 0.28) {
          add({
            x,
            y,
            kind: 'pebble',
            size: 1.8 + this.rand() * 2.8,
            color: [236, 244, 252],
            seed: this.rand(),
            snowy: true,
          });
        }
        continue;
      }

      if (e > levels.beach + 0.01 && e < levels.rock - 0.02) {
        let density = t.tree === 'cactus' || t.tree === 'dead' ? 0.34 : band(m, 0.35, 0.75) * 0.95 + 0.04;
        if (t.tree === 'palm') density *= e < levels.beach + 0.08 ? 2.6 : 0.55;
        if (t.snowyTrees) density = 0.42;
        if (roll < density * t.treeDensity * 0.72) {
          const base = t.treeColors[Math.floor(this.rand() * t.treeColors.length)];
          add({
            x,
            y,
            kind: t.tree,
            size: 5 + this.rand() * 8,
            color: tint(base, 0.82 + this.rand() * 0.32),
            seed: this.rand(),
            snowy: !!t.snowyTrees,
          });
        } else if (roll < density * t.treeDensity) {
          const base = t.treeColors[0];
          add({
            x,
            y,
            kind: 'bush',
            size: 2.5 + this.rand() * 3.2,
            color: tint(base, 0.75 + this.rand() * 0.35),
            seed: this.rand(),
            snowy: !!t.snowyTrees,
          });
        } else if (t.snowyTrees && roll < 0.55) {
          // Soft snow drifts and ice lumps (mostly round pebbles).
          add({
            x,
            y,
            kind: this.rand() < 0.75 ? 'pebble' : 'crystal',
            size: 2 + this.rand() * 3.5,
            color: this.rand() < 0.75 ? [240, 246, 252] : [170, 210, 230],
            seed: this.rand(),
            snowy: true,
          });
        } else if (roll < 0.22) {
          const blossom = t.name === 'Blossom Isle' || t.treeColors.length > 2;
          add({
            x,
            y,
            kind: blossom && this.rand() < 0.55 ? 'flower' : 'tuft',
            size: blossom ? 1.6 + this.rand() * 1.6 : 1.8 + this.rand() * 2.2,
            color: blossom
              ? t.treeColors[Math.floor(this.rand() * t.treeColors.length)]
              : tint(t.grass, 0.85 + this.rand() * 0.3),
            seed: this.rand(),
            snowy: false,
          });
        } else if (t.name === 'Mire Isle' && roll < 0.32) {
          add({
            x,
            y,
            kind: 'reed',
            size: 3 + this.rand() * 4,
            color: [60, 85, 40],
            seed: this.rand(),
            snowy: false,
          });
        }
      } else if (e >= levels.rock && e < levels.snow && roll < (t.snowyTrees ? 0.28 : 0.18)) {
        add({
          x,
          y,
          kind: t.snowyTrees && this.rand() < 0.25 ? 'crystal' : 'rock',
          size: 2.5 + this.rand() * 6,
          color: tint(t.snowyTrees ? [150, 170, 190] : t.rockLow, 0.78 + this.rand() * 0.4),
          seed: this.rand(),
          snowy: !!t.snowyTrees,
        });
      }
    }

    props.sort((a, b) => a.y - b.y);
    const chunkRows = Math.ceil(this.height / CHUNK);
    for (const p of props) {
      const reach = p.size * 2.4;
      const cx0 = Math.max(0, Math.floor((p.x - reach) / CHUNK));
      const cx1 = Math.min(this.chunkCols - 1, Math.floor((p.x + reach) / CHUNK));
      const cy0 = Math.max(0, Math.floor((p.y - reach) / CHUNK));
      const cy1 = Math.min(chunkRows - 1, Math.floor((p.y + reach) / CHUNK));
      for (let cy = cy0; cy <= cy1; cy++) {
        for (let cx = cx0; cx <= cx1; cx++) this.propBuckets[cy * this.chunkCols + cx].push(p);
      }
    }
  }

  private chunk(cx: number, cy: number) {
    const key = cy * this.chunkCols + cx;
    let canvas = this.chunks.get(key);
    if (canvas) {
      this.chunks.delete(key);
    } else {
      canvas = this.renderChunk(cx, cy);
      if (this.chunks.size >= MAX_CACHED_CHUNKS) this.chunks.delete(this.chunks.keys().next().value!);
    }
    this.chunks.set(key, canvas);
    return canvas;
  }

  private renderChunk(cx: number, cy: number) {
    const canvas = document.createElement('canvas');
    canvas.width = CHUNK;
    canvas.height = CHUNK;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // One cell of padding on every side keeps smoothing seamless across chunk borders.
    const s = CHUNK / this.cell;
    ctx.drawImage(this.overview, cx * s - 1, cy * s - 1, s + 2, s + 2, -this.cell, -this.cell, CHUNK + this.cell * 2, CHUNK + this.cell * 2);

    ctx.translate(-cx * CHUNK, -cy * CHUNK);
    this.drawShoreFoam(ctx, cx * CHUNK, cy * CHUNK);
    this.drawBridges(ctx, cx * CHUNK, cy * CHUNK);
    for (const p of this.propBuckets[cy * this.chunkCols + cx]) drawProp(ctx, p);
    return canvas;
  }

  private drawShoreFoam(ctx: CanvasRenderingContext2D, x0: number, y0: number) {
    const cell = this.cell;
    const c0 = Math.max(0, Math.floor(x0 / cell) - 1);
    const r0 = Math.max(0, Math.floor(y0 / cell) - 1);
    const c1 = Math.min(this.cols - 1, Math.floor((x0 + CHUNK) / cell) + 1);
    const r1 = Math.min(this.rows - 1, Math.floor((y0 + CHUNK) / cell) + 1);
    ctx.fillStyle = 'rgba(236, 246, 252, 0.28)';
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const i = r * this.cols + c;
        const e = this.elevation[i];
        if (this.bridgeMask[i] || e < levels.shallow || e > levels.beach + 0.02) continue;
        const n = [
          i - 1,
          i + 1,
          i - this.cols,
          i + this.cols,
        ];
        if (!n.some((j) => j >= 0 && j < this.elevation.length && this.elevation[j] < levels.shallow)) continue;
        ctx.beginPath();
        ctx.ellipse((c + 0.5) * cell, (r + 0.5) * cell, cell * 1.6, cell * 0.9, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawBridges(ctx: CanvasRenderingContext2D, x0: number, y0: number) {
    const pad = 20;
    const half = BRIDGE_HALF_WIDTH + 3;
    for (const b of this.bridges) {
      const len = Math.hypot(b.bx - b.ax, b.by - b.ay);
      const ux = (b.bx - b.ax) / len;
      const uy = (b.by - b.ay) / len;
      const planks: [number, number, number][] = [];
      for (let t = 0, n = 0; t <= len; t += 6, n++) {
        const x = b.ax + ux * t;
        const y = b.ay + uy * t;
        if (x < x0 - pad || y < y0 - pad || x > x0 + CHUNK + pad || y > y0 + CHUNK + pad) continue;
        const i = this.index(x, y);
        if (i >= 0 && this.bridgeMask[i]) planks.push([x, y, n]);
      }

      const quad = (x: number, y: number, along: number, across: number) => {
        ctx.beginPath();
        ctx.moveTo(x - ux * along - uy * across, y - uy * along + ux * across);
        ctx.lineTo(x + ux * along - uy * across, y + uy * along + ux * across);
        ctx.lineTo(x + ux * along + uy * across, y + uy * along - ux * across);
        ctx.lineTo(x - ux * along + uy * across, y - uy * along - ux * across);
        ctx.closePath();
        ctx.fill();
      };

      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      for (const [x, y] of planks) quad(x + 4, y + 5, 3.5, half);
      for (const [x, y, n] of planks) {
        ctx.fillStyle = n % 2 ? '#7a5a38' : '#8c6a44';
        quad(x, y, 2.6, half);
      }
      ctx.strokeStyle = 'rgba(58, 40, 24, 0.65)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (const [x, y] of planks) {
        ctx.moveTo(x - uy * half, y + ux * half);
        ctx.lineTo(x + uy * half, y - ux * half);
      }
      ctx.stroke();
      ctx.fillStyle = '#4a3420';
      for (const [x, y, n] of planks) {
        if (n % 4) continue;
        ctx.fillRect(x - uy * half - 2, y + ux * half - 2, 4, 4);
        ctx.fillRect(x + uy * half - 2, y - ux * half - 2, 4, 4);
      }
    }
  }
}

function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.ellipse(x + s * 0.5, y + s * 0.6, s, s * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawProp(ctx: CanvasRenderingContext2D, p: Prop) {
  const { x, y, size: s, color: c } = p;
  const rand = mulberry32(Math.floor(p.seed * 2 ** 31));

  switch (p.kind) {
    case 'round': {
      drawShadow(ctx, x, y, s * 1.15);
      ctx.fillStyle = '#5a3d22';
      ctx.beginPath();
      ctx.ellipse(x, y + s * 0.15, s * 0.22, s * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      const lobes = 4 + Math.floor(rand() * 3);
      for (let i = 0; i < lobes; i++) {
        const a = rand() * Math.PI * 2;
        const d = s * (0.15 + rand() * 0.45);
        ctx.fillStyle = rgb(c, 0.78 + rand() * 0.35);
        ctx.beginPath();
        ctx.ellipse(
          x + Math.cos(a) * d,
          y + Math.sin(a) * d * 0.7 - s * 0.15,
          s * (0.45 + rand() * 0.25),
          s * (0.4 + rand() * 0.2),
          a,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.fillStyle = rgb(c, 1.45, 0.4);
      ctx.beginPath();
      ctx.arc(x - s * 0.28, y - s * 0.4, s * 0.38, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'pine': {
      drawShadow(ctx, x, y, s);
      ctx.fillStyle = p.snowy ? '#3a3228' : '#4a3420';
      ctx.fillRect(x - s * 0.1, y, s * 0.2, s * 0.35);
      // Soft stacked lobes — no star spikes.
      const tiers = [
        { y: -0.05, w: 1.05, h: 0.42, k: 0.72 },
        { y: -0.28, w: 0.78, h: 0.36, k: 0.9 },
        { y: -0.48, w: 0.52, h: 0.3, k: 1.1 },
        { y: -0.65, w: 0.28, h: 0.22, k: 1.25 },
      ];
      for (const tier of tiers) {
        ctx.fillStyle = rgb(c, tier.k);
        ctx.beginPath();
        ctx.ellipse(x + (rand() - 0.5) * s * 0.06, y + tier.y * s, s * tier.w * 0.5, s * tier.h, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (p.snowy) {
        ctx.fillStyle = 'rgba(248, 252, 255, 0.9)';
        for (const tier of tiers) {
          ctx.beginPath();
          ctx.ellipse(
            x + (rand() - 0.5) * s * 0.08,
            y + tier.y * s - s * 0.08,
            s * tier.w * 0.38,
            s * tier.h * 0.45,
            (rand() - 0.5) * 0.3,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(240, 246, 252, 0.65)';
        ctx.beginPath();
        ctx.ellipse(x, y + s * 0.05, s * 0.16, s * 0.08, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'palm': {
      drawShadow(ctx, x, y, s);
      ctx.strokeStyle = '#8a6238';
      ctx.lineWidth = Math.max(2, s * 0.18);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y + s * 0.35);
      ctx.quadraticCurveTo(x + s * 0.25, y, x + s * 0.08, y - s * 0.35);
      ctx.stroke();
      const rot = rand() * Math.PI;
      for (let i = 0; i < 7; i++) {
        const a = rot + (i * Math.PI * 2) / 7;
        ctx.fillStyle = rgb(c, 0.85 + (i % 2) * 0.25);
        ctx.beginPath();
        ctx.ellipse(
          x + s * 0.08 + Math.cos(a) * s * 0.7,
          y - s * 0.35 + Math.sin(a) * s * 0.55,
          s * 0.85,
          s * 0.18,
          a,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.fillStyle = '#6b4a28';
      ctx.beginPath();
      ctx.arc(x + s * 0.08, y - s * 0.35, s * 0.16, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'cactus': {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      ctx.ellipse(x + s * 0.3, y + s * 0.65, s * 0.6, s * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgb(c);
      ctx.strokeStyle = rgb(c, 0.6);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x - s * 0.22, y - s, s * 0.44, s * 1.6, s * 0.22);
      ctx.roundRect(x - s * 0.7, y - s * 0.55, s * 0.3, s * 0.6, s * 0.15);
      ctx.roundRect(x + s * 0.4, y - s * 0.75, s * 0.3, s * 0.6, s * 0.15);
      ctx.rect(x - s * 0.55, y - s * 0.05, s * 0.4, s * 0.18);
      ctx.rect(x + s * 0.15, y - s * 0.25, s * 0.4, s * 0.18);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = rgb(c, 1.4, 0.35);
      ctx.beginPath();
      ctx.roundRect(x - s * 0.12, y - s * 0.85, s * 0.16, s * 0.9, s * 0.08);
      ctx.fill();
      break;
    }

    case 'dead': {
      drawShadow(ctx, x, y, s * 0.6);
      ctx.strokeStyle = rgb(c);
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y + s * 0.4);
      ctx.lineTo(x, y - s * 0.2);
      for (let i = 0; i < 6; i++) {
        const a = -1.2 + rand() * 2.4;
        const len = s * (0.5 + rand() * 0.7);
        ctx.moveTo(x, y - s * 0.1);
        ctx.lineTo(x + Math.cos(a - Math.PI / 2) * len, y - s * 0.1 + Math.sin(a - Math.PI / 2) * len);
      }
      ctx.stroke();
      break;
    }

    case 'bush': {
      drawShadow(ctx, x, y, s * 0.9);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = rgb(c, 0.8 + i * 0.12);
        ctx.beginPath();
        ctx.arc(x + (rand() - 0.5) * s, y + (rand() - 0.5) * s * 0.6, s * (0.45 + rand() * 0.3), 0, Math.PI * 2);
        ctx.fill();
      }
      if (p.snowy) {
        ctx.fillStyle = 'rgba(248, 252, 255, 0.88)';
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.ellipse(
            x + (rand() - 0.5) * s * 0.7,
            y - s * 0.15 + (rand() - 0.5) * s * 0.3,
            s * (0.28 + rand() * 0.2),
            s * (0.16 + rand() * 0.1),
            rand(),
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      }
      break;
    }

    case 'flower': {
      ctx.fillStyle = rgb(c, 0.55);
      ctx.beginPath();
      ctx.arc(x, y + s * 0.4, s * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgb(c);
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * s * 0.45, y + Math.sin(a) * s * 0.45, s * 0.38, s * 0.22, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ffe082';
      ctx.beginPath();
      ctx.arc(x, y, s * 0.28, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'reed': {
      ctx.strokeStyle = rgb(c);
      ctx.lineWidth = 1.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const ox = (rand() - 0.5) * s;
        ctx.moveTo(x + ox, y + s * 0.4);
        ctx.quadraticCurveTo(x + ox + s * 0.2, y, x + ox + (rand() - 0.5) * s * 0.4, y - s);
      }
      ctx.stroke();
      ctx.fillStyle = rgb(c, 1.2);
      ctx.beginPath();
      ctx.ellipse(x, y - s * 0.85, s * 0.18, s * 0.35, 0.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'pebble': {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.beginPath();
      ctx.ellipse(x + s * 0.2, y + s * 0.15, s * 0.9, s * 0.45, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgb(c);
      ctx.beginPath();
      ctx.ellipse(x, y, s, s * 0.62, rand(), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgb(c, 1.35, 0.4);
      ctx.beginPath();
      ctx.ellipse(x - s * 0.25, y - s * 0.15, s * 0.35, s * 0.18, 0.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'tuft': {
      ctx.strokeStyle = rgb(c);
      ctx.lineWidth = 1.1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -0.7 + i * 0.35;
        ctx.moveTo(x, y + s * 0.2);
        ctx.lineTo(x + Math.sin(a) * s, y - s * (0.5 + rand() * 0.5));
      }
      ctx.stroke();
      break;
    }

    case 'coral': {
      ctx.fillStyle = rgb(c, 0.7, 0.55);
      for (let i = 0; i < 5; i++) {
        const a = rand() * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * s * 0.4, y + Math.sin(a) * s * 0.3, s * 0.35, s * 0.7, a, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'crystal': {
      // Soft ice lumps — rounded, not spike shards.
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.beginPath();
      ctx.ellipse(x + s * 0.15, y + s * 0.25, s * 0.85, s * 0.35, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgb(c, 0.95, 0.85);
      ctx.beginPath();
      ctx.ellipse(x, y, s * 0.7, s * 0.55, -0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgb(c, 1.15, 0.9);
      ctx.beginPath();
      ctx.ellipse(x + s * 0.35, y - s * 0.05, s * 0.4, s * 0.38, 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.beginPath();
      ctx.ellipse(x - s * 0.15, y - s * 0.15, s * 0.28, s * 0.16, -0.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'rock': {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
      ctx.beginPath();
      ctx.ellipse(x + s * 0.35, y + s * 0.4, s * 1.05, s * 0.65, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgb(c, 0.85);
      ctx.beginPath();
      ctx.moveTo(x - s, y);
      ctx.lineTo(x - s * 0.3, y - s * 0.75);
      ctx.lineTo(x + s * 0.7, y - s * 0.35);
      ctx.lineTo(x + s, y + s * 0.25);
      ctx.lineTo(x + s * 0.1, y + s * 0.7);
      ctx.lineTo(x - s * 0.7, y + s * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = rgb(c, 1.25);
      ctx.beginPath();
      ctx.moveTo(x - s * 0.2, y - s * 0.55);
      ctx.lineTo(x + s * 0.35, y - s * 0.25);
      ctx.lineTo(x - s * 0.05, y + s * 0.05);
      ctx.closePath();
      ctx.fill();
      if (p.snowy) {
        ctx.fillStyle = 'rgba(248, 252, 255, 0.9)';
        ctx.beginPath();
        ctx.ellipse(x - s * 0.1, y - s * 0.5, s * 0.5, s * 0.22, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + s * 0.25, y - s * 0.2, s * 0.28, s * 0.14, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
  }
}
