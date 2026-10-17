import { CONFIG } from '@/config';

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size = 20,
  align: CanvasTextAlign = 'left',
) {
  ctx.fillStyle = CONFIG.colors.text;
  ctx.font = `${size}px system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}
