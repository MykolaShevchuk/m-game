import { CONFIG } from '@/config';
import type { Camera } from '@/core/Camera';
import type { Rect } from '@/core/math';
import type { WorldMap } from '@/world/WorldMap';

export interface MinimapLayout {
  originX?: number;
  viewW?: number;
  width?: number;
  players?: { rect: Rect; color: string }[];
  villages?: Rect[];
  chests?: Rect[];
}

export function drawMinimap(
  ctx: CanvasRenderingContext2D,
  map: WorldMap,
  camera: Camera,
  player: Rect,
  coins: Rect[],
  houses: Rect[] = [],
  layout: MinimapLayout = {},
) {
  const originX = layout.originX ?? 0;
  const viewW = layout.viewW ?? CONFIG.width;
  const w = layout.width ?? Math.min(CONFIG.minimap.width, viewW - CONFIG.minimap.margin * 2);
  const scale = w / map.width;
  const h = map.height * scale;
  const x = originX + viewW - w - CONFIG.minimap.margin;
  const y = CONFIG.minimap.margin;

  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.drawImage(map.overview, x, y, w, h);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  ctx.strokeRect(x + camera.x * scale, y + camera.y * scale, camera.viewW * scale, camera.viewH * scale);

  ctx.fillStyle = CONFIG.colors.coin;
  for (const c of coins) ctx.fillRect(x + c.x * scale - 1, y + c.y * scale - 1, 2, 2);
  ctx.fillStyle = '#c4a574';
  for (const house of houses) ctx.fillRect(x + house.x * scale - 1.5, y + house.y * scale - 1.5, 3, 3);
  ctx.fillStyle = '#e8c36a';
  for (const v of layout.villages ?? []) {
    ctx.fillRect(x + (v.x + v.w / 2) * scale - 2, y + (v.y + v.h / 2) * scale - 2, 4, 4);
  }
  ctx.fillStyle = '#f0d060';
  for (const c of layout.chests ?? []) {
    ctx.fillRect(x + (c.x + c.w / 2) * scale - 2.5, y + (c.y + c.h / 2) * scale - 2.5, 5, 5);
  }

  const extras = layout.players;
  if (extras?.length) {
    for (const p of extras) {
      ctx.fillStyle = p.color;
      ctx.fillRect(x + p.rect.x * scale - 2, y + p.rect.y * scale - 2, 4, 4);
    }
  } else {
    ctx.fillStyle = CONFIG.colors.player;
    ctx.fillRect(x + player.x * scale - 2, y + player.y * scale - 2, 4, 4);
  }
  ctx.restore();
}
