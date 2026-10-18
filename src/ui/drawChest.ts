/** Soft painted treasure chest — matches house / prop silhouettes. */
export function drawChest(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  opened: boolean,
) {
  ctx.save();
  const bodyY = y + h * 0.38;
  const bodyH = h * 0.58;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.ellipse(x + w / 2 + 1, y + h * 0.92, w * 0.42, h * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = '#8a5a32';
  ctx.beginPath();
  ctx.roundRect(x + 2, bodyY, w - 4, bodyH, 3);
  ctx.fill();
  ctx.fillStyle = '#a87040';
  ctx.fillRect(x + 4, bodyY + 2, (w - 8) * 0.35, bodyH - 6);

  // Metal bands
  ctx.fillStyle = '#c9a227';
  ctx.fillRect(x + 2, bodyY + bodyH * 0.35, w - 4, 3);
  ctx.fillRect(x + w / 2 - 2, bodyY, 4, bodyH);

  if (opened) {
    // Lid tipped back
    ctx.fillStyle = '#6e4828';
    ctx.beginPath();
    ctx.moveTo(x + 2, bodyY + 2);
    ctx.lineTo(x + w * 0.15, y + 2);
    ctx.lineTo(x + w * 0.85, y + 2);
    ctx.lineTo(x + w - 2, bodyY + 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(x + w * 0.2, y + 4, w * 0.6, 3);
    // Glow of loot inside
    ctx.fillStyle = 'rgba(232, 200, 90, 0.55)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, bodyY + bodyH * 0.35, w * 0.28, bodyH * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Closed lid
    ctx.fillStyle = '#6e4828';
    ctx.beginPath();
    ctx.roundRect(x + 1, y + h * 0.08, w - 2, h * 0.36, 3);
    ctx.fill();
    ctx.fillStyle = '#a87040';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h * 0.2, w * 0.38, h * 0.1, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(x + 1, y + h * 0.32, w - 2, 3);
    // Lock
    ctx.fillStyle = '#e8d070';
    ctx.beginPath();
    ctx.roundRect(x + w / 2 - 5, bodyY + 2, 10, 12, 2);
    ctx.fill();
    ctx.strokeStyle = '#5a4030';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x + w / 2, bodyY + 5, 3, Math.PI, 0);
    ctx.stroke();
  }

  ctx.restore();
}
