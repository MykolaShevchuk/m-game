import { overlaps, type Rect } from '@/core/math';
import {
  VILLAGE_H,
  VILLAGE_HUTS,
  VILLAGE_RESTOCK,
  VILLAGE_STALL,
  VILLAGE_W,
  hutColors,
  makeOffers,
  rgbCss,
  villageName,
  type TradeOffer,
  type VillageHut,
} from '@/villages';
import {
  drawVillageGround,
  drawVillageHut,
  drawVillageSign,
  drawVillageStall,
  drawVillager,
  drawWell,
} from '@/ui/drawVillage';
import type { IslandTheme } from '@/world/themes';
import { Entity } from './Entity';

export class Village extends Entity {
  readonly name: string;
  readonly offers: TradeOffer[];
  readonly huts: VillageHut[];
  readonly solids: Rect[];
  private restock = 0;
  private t = 0;

  constructor(
    x: number,
    y: number,
    readonly theme: IslandTheme,
    readonly island: number,
  ) {
    super(x, y, VILLAGE_W, VILLAGE_H);
    this.name = villageName(theme);
    this.offers = makeOffers(theme);
    const colors = hutColors(theme);
    this.huts = VILLAGE_HUTS.map((h) => ({ ...h, x: x + h.x, y: y + h.y, ...colors }));
    this.solids = [
      ...this.huts,
      { x: x + VILLAGE_STALL.x, y: y + VILLAGE_STALL.y, w: VILLAGE_STALL.w, h: VILLAGE_STALL.h },
    ];
  }

  get stallX() {
    return this.x + VILLAGE_STALL.x + VILLAGE_STALL.w / 2;
  }

  get stallY() {
    return this.y + VILLAGE_STALL.y + VILLAGE_STALL.h / 2;
  }

  get ware() {
    return this.offers[0]?.getId ?? this.offers[0]?.giveId ?? 'wood';
  }

  blocks(r: Rect) {
    return this.solids.some((s) => overlaps(r, s));
  }

  update(dt: number) {
    this.t += dt;
    this.restock += dt;
    if (this.restock < VILLAGE_RESTOCK) return;
    this.restock -= VILLAGE_RESTOCK;
    for (const o of this.offers) {
      if (o.stock < o.max) o.stock += 1;
    }
  }

  renderGround(ctx: CanvasRenderingContext2D) {
    drawVillageGround(ctx, this.x, this.y, this.theme);
  }

  render(ctx: CanvasRenderingContext2D) {
    this.renderGround(ctx);
    for (const hut of this.huts) drawVillageHut(ctx, hut);
    drawVillageStall(ctx, this.x + VILLAGE_STALL.x, this.y + VILLAGE_STALL.y, this.theme, this.ware);
    drawWell(ctx, this.x + 108, this.y + 88);
    const shirt = rgbCss(this.theme.treeColors[0] ?? this.theme.grass);
    drawVillager(ctx, this.x + 58, this.y + 78, shirt, this.t);
    drawVillager(ctx, this.x + 128, this.y + 64, rgbCss(this.theme.highland), this.t + 1.2);
    drawVillageSign(ctx, this.stallX, this.y + 42, this.name);
  }
}
