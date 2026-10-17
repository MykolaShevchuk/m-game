import type { ResourceId } from '@/resources';

type IconFn = (ctx: CanvasRenderingContext2D, r: number) => void;

/** Draws a resource icon centered on (cx, cy); `size` is the icon's overall width. */
export function drawResource(ctx: CanvasRenderingContext2D, id: ResourceId, cx: number, cy: number, size: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineWidth = Math.max(1, size / 18);
  ctx.strokeStyle = 'rgba(40, 36, 28, 0.35)';
  ctx.lineJoin = 'round';
  ICONS[id](ctx, size / 2);
  ctx.restore();
}

function poly(ctx: CanvasRenderingContext2D, points: [number, number][], r: number) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x * r, y * r) : ctx.lineTo(x * r, y * r)));
  ctx.closePath();
}

const ICONS: Record<ResourceId, IconFn> = {
  wood(ctx, r) {
    ctx.rotate(-0.35);
    ctx.fillStyle = '#8a5a34';
    ctx.beginPath();
    ctx.roundRect(-r * 0.95, -r * 0.42, r * 1.6, r * 0.84, r * 0.2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(60, 35, 15, 0.6)';
    ctx.beginPath();
    ctx.moveTo(-r * 0.7, -r * 0.12);
    ctx.lineTo(r * 0.3, -r * 0.12);
    ctx.moveTo(-r * 0.5, r * 0.16);
    ctx.lineTo(r * 0.4, r * 0.16);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillStyle = '#e2b77d';
    ctx.beginPath();
    ctx.ellipse(r * 0.65, 0, r * 0.3, r * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#a87443';
    ctx.beginPath();
    ctx.ellipse(r * 0.65, 0, r * 0.13, r * 0.2, 0, 0, Math.PI * 2);
    ctx.stroke();
  },

  stone(ctx, r) {
    ctx.fillStyle = '#8f969e';
    poly(ctx, [[-0.9, 0.5], [-0.75, -0.25], [-0.25, -0.7], [0.45, -0.6], [0.9, -0.05], [0.75, 0.6], [0, 0.75]], r);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#c3c8cd';
    poly(ctx, [[-0.55, -0.2], [-0.2, -0.5], [0.35, -0.42], [0.05, -0.1]], r);
    ctx.fill();
  },

  berries(ctx, r) {
    ctx.fillStyle = '#4caf50';
    ctx.beginPath();
    ctx.ellipse(r * 0.3, -r * 0.62, r * 0.42, r * 0.2, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const berries: [number, number][] = [[-0.38, -0.05], [0.38, -0.05], [0, 0.5]];
    for (const [x, y] of berries) {
      ctx.fillStyle = '#c62845';
      ctx.beginPath();
      ctx.arc(x * r, y * r, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath();
      ctx.arc((x - 0.13) * r, (y - 0.13) * r, r * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  cactusFruit(ctx, r) {
    ctx.fillStyle = '#d63f95';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.12, r * 0.6, r * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#5f9e3f';
    poly(ctx, [[-0.45, -0.5], [-0.2, -0.95], [0, -0.6], [0.2, -0.95], [0.45, -0.5]], r);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffe9a8';
    const dots: [number, number][] = [[-0.25, 0], [0.25, 0.05], [0, 0.4], [-0.25, 0.55], [0.28, 0.5]];
    for (const [x, y] of dots) ctx.fillRect(x * r - 1, y * r - 1, 2, 2);
  },

  shell(ctx, r) {
    ctx.fillStyle = '#f6d2bd';
    ctx.beginPath();
    ctx.moveTo(0, r * 0.75);
    ctx.lineTo(-r * 0.9, -r * 0.1);
    ctx.arc(0, -r * 0.1, r * 0.9, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(190, 110, 90, 0.8)';
    ctx.beginPath();
    for (const a of [-0.55, -0.2, 0.2, 0.55]) {
      ctx.moveTo(0, r * 0.7);
      ctx.lineTo(Math.sin(a) * r * 0.85, -r * 0.1 - Math.cos(a) * r * 0.85);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillStyle = '#e8a990';
    ctx.beginPath();
    ctx.roundRect(-r * 0.3, r * 0.55, r * 0.6, r * 0.3, r * 0.1);
    ctx.fill();
    ctx.stroke();
  },

  crystal(ctx, r) {
    const shard = (x: number, h: number, w: number, color: string) => {
      ctx.fillStyle = color;
      poly(ctx, [[x, 0.85 - h], [x + w, 0.85 - h * 0.7], [x + w, 0.85], [x - w, 0.85], [x - w, 0.85 - h * 0.7]], r);
      ctx.fill();
      ctx.stroke();
    };
    shard(-0.45, 1.1, 0.25, '#4a8898');
    shard(0.45, 1.0, 0.25, '#4a8898');
    shard(0, 1.7, 0.32, '#7ab0c0');
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    poly(ctx, [[-0.12, -0.6], [0, -0.85], [0, 0.6], [-0.12, 0.6]], r);
    ctx.fill();
  },

  obsidian(ctx, r) {
    ctx.fillStyle = '#2a262c';
    poly(ctx, [[-0.2, -0.9], [0.6, -0.45], [0.85, 0.3], [0.15, 0.85], [-0.75, 0.5], [-0.8, -0.3]], r);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#5a4e68';
    poly(ctx, [[-0.2, -0.9], [0.6, -0.45], [0.1, -0.1], [-0.8, -0.3]], r);
    ctx.fill();
    ctx.strokeStyle = '#a07048';
    ctx.beginPath();
    ctx.moveTo(0.1 * r, -0.1 * r);
    ctx.lineTo(0.15 * r, 0.85 * r);
    ctx.stroke();
  },
};
