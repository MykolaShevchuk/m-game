import { CONFIG } from '@/config';
import type { Camera } from '@/core/Camera';
import type { Rect } from '@/core/math';
import type { WorldMap } from '@/world/WorldMap';

export function drawMinimap(
  ctx: CanvasRenderingContext2D,
  map: WorldMap,
  camera: Camera,
  player: Rect,
  coins: Rect[],
) {
  const w = CONFIG.minimap.width;
  const scale = w / map.width;
  const h = map.height * scale;
  const x = CONFIG.width - w - CONFIG.minimap.margin;
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
  ctx.fillStyle = CONFIG.colors.player;
  ctx.fillRect(x + player.x * scale - 2, y + player.y * scale - 2, 4, 4);
  ctx.restore();
}
