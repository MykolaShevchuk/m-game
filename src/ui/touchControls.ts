import type { PlayerSlot } from '@/core/Input';
import { drawText } from './text';

export type TouchAction = 'interact' | 'build' | 'blink' | 'eat' | 'pause' | 'confirm';

export interface StickZone {
  kind: 'stick';
  cx: number;
  cy: number;
  radius: number;
  hitX: number;
  hitY: number;
  hitW: number;
  hitH: number;
}

export interface ButtonZone {
  kind: 'button';
  id: TouchAction;
  x: number;
  y: number;
  r: number;
  label: string;
}

export interface TouchLayout {
  stick: StickZone;
  buttons: ButtonZone[];
  slot: PlayerSlot;
  originX: number;
  originY: number;
  viewW: number;
  viewH: number;
}

export interface TouchLayoutOpts {
  confirm?: boolean;
  slot?: PlayerSlot;
  /** Top-left of this player's screen region. */
  originX?: number;
  originY?: number;
  /** Height of this player's screen (defaults to full canvas height). */
  viewH?: number;
  showPause?: boolean;
}

/**
 * Joystick on the left of this player's screen, action buttons on the right.
 * Pass origin + view size for split-screen so each half gets its own pad.
 */
export function touchLayout(viewW: number, canvasH: number, opts: TouchLayoutOpts = {}): TouchLayout {
  const originX = opts.originX ?? 0;
  const originY = opts.originY ?? 0;
  const viewH = opts.viewH ?? canvasH;
  const slot = opts.slot ?? 0;
  const showPause = opts.showPause ?? true;
  const narrow = viewW < 520;
  const short = viewH < 420;
  const safe = Math.min(14, Math.round(Math.min(viewW, viewH) * 0.03));
  const stickR = Math.min(
    short ? 40 : narrow ? 48 : 60,
    Math.max(30, Math.round(Math.min(viewW, viewH) * (short ? 0.14 : narrow ? 0.15 : 0.12))),
  );
  const btnR = Math.min(
    short ? 22 : narrow ? 26 : 34,
    Math.max(18, Math.round(Math.min(viewW, viewH) * (short ? 0.07 : narrow ? 0.08 : 0.065))),
  );
  const gap = btnR * 0.22;

  const stick: StickZone = {
    kind: 'stick',
    cx: originX + safe + stickR + 6,
    cy: originY + viewH - safe - stickR - 8,
    radius: stickR,
    hitX: originX,
    hitY: originY + viewH * 0.35,
    hitW: viewW * 0.48,
    hitH: viewH * 0.65,
  };

  const clusterX = originX + viewW - safe - btnR * (narrow ? 2.0 : 2.35);
  const clusterY = originY + viewH - safe - btnR * (short ? 2.0 : narrow ? 2.15 : 2.5);

  const buttons: ButtonZone[] = [
    { kind: 'button', id: 'interact', x: clusterX, y: clusterY, r: btnR + (narrow ? 2 : 4), label: 'USE' },
    { kind: 'button', id: 'build', x: clusterX - btnR * 2.05 - gap, y: clusterY, r: btnR, label: 'BUILD' },
    { kind: 'button', id: 'blink', x: clusterX, y: clusterY - btnR * 2.05 - gap, r: btnR, label: 'DASH' },
    { kind: 'button', id: 'eat', x: clusterX + btnR * 2.05 + gap, y: clusterY, r: btnR, label: 'EAT' },
  ];

  if (showPause) {
    buttons.push({
      kind: 'button',
      id: 'pause',
      x: originX + viewW - safe - 18,
      y: originY + safe + 18,
      r: 18,
      label: '||',
    });
  }

  if (opts.confirm) {
    buttons.push({
      kind: 'button',
      id: 'confirm',
      x: clusterX,
      y: clusterY + btnR * 2.05 + gap,
      r: btnR,
      label: 'OK',
    });
  }

  return { stick, buttons, slot, originX, originY, viewW, viewH };
}

export function touchBottomPad(h: number) {
  return Math.min(160, Math.max(120, Math.round(h * 0.28)));
}

export function pointInStickHit(stick: StickZone, x: number, y: number) {
  return x >= stick.hitX && x <= stick.hitX + stick.hitW && y >= stick.hitY && y <= stick.hitY + stick.hitH;
}

export function drawTouchControls(
  ctx: CanvasRenderingContext2D,
  layout: TouchLayout,
  stick: { x: number; y: number } | null,
  origin: { x: number; y: number } | null = null,
) {
  const s = layout.stick;
  const baseX = origin?.x ?? s.cx;
  const baseY = origin?.y ?? s.cy;
  const accent = layout.slot === 0 ? '#81c784' : '#64b5f6';
  const dockH = Math.min(140, Math.max(100, s.radius * 2.5));

  ctx.save();

  const grad = ctx.createLinearGradient(0, s.cy - dockH * 0.55, 0, s.cy + s.radius + 16);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.3, 'rgba(0,0,0,0.4)');
  grad.addColorStop(1, 'rgba(0,0,0,0.62)');
  ctx.fillStyle = grad;
  ctx.fillRect(layout.originX, s.cy - dockH * 0.55, layout.viewW, dockH * 0.55 + s.radius + 20);

  // Player label banner so each half is obvious.
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.roundRect(layout.originX + 8, layout.originY + 8, 44, 22, 6);
  ctx.fill();
  ctx.globalAlpha = 1;
  drawText(ctx, layout.slot === 0 ? 'P1' : 'P2', layout.originX + 30, layout.originY + 19, 13, 'center');

  ctx.globalAlpha = origin ? 0.6 : 0.48;
  ctx.fillStyle = '#0a0a0a';
  ctx.beginPath();
  ctx.arc(baseX, baseY, s.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.arc(baseX, baseY, s.radius * 0.35, 0, Math.PI * 2);
  ctx.stroke();

  const kn = stick ?? { x: 0, y: 0 };
  const kx = baseX + kn.x * (s.radius * 0.58);
  const ky = baseY + kn.y * (s.radius * 0.58);
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = '#eceff1';
  ctx.beginPath();
  ctx.arc(kx, ky, s.radius * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();

  for (const b of layout.buttons) {
    const main = b.id === 'interact';
    ctx.globalAlpha = main ? 0.8 : 0.62;
    ctx.fillStyle = b.id === 'pause' ? '#263238' : main ? '#2e7d32' : '#111';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = main ? accent : '#fff';
    ctx.lineWidth = main ? 3 : 2;
    ctx.stroke();
    const size = b.id === 'pause' ? 12 : main ? 12 : 10;
    drawText(ctx, b.label, b.x, b.y + 1, size, 'center');
  }
  ctx.restore();
}
