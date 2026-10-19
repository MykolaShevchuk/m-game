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
  /** Full canvas width — used for safe-area on the right edge. */
  canvasW?: number;
  showPause?: boolean;
}

/** Extra inset for iPad/iPhone home indicator & rounded corners. */
function safeInset() {
  if (typeof getComputedStyle === 'undefined' || typeof document === 'undefined') {
    return { left: 0, right: 0, bottom: 12, top: 0 };
  }
  const s = getComputedStyle(document.documentElement);
  const n = (v: string) => Math.max(0, parseFloat(v) || 0);
  return {
    left: n(s.getPropertyValue('--sat-left')),
    right: n(s.getPropertyValue('--sat-right')),
    top: n(s.getPropertyValue('--sat-top')),
    bottom: Math.max(12, n(s.getPropertyValue('--sat-bottom'))),
  };
}

/**
 * Joystick on the left of this player's screen, action buttons on the right.
 * Sized for phones and iPads (larger pads when the half is tablet-wide).
 */
export function touchLayout(viewW: number, canvasH: number, opts: TouchLayoutOpts = {}): TouchLayout {
  const originX = opts.originX ?? 0;
  const originY = opts.originY ?? 0;
  const viewH = opts.viewH ?? canvasH;
  const canvasW = opts.canvasW ?? originX + viewW;
  const slot = opts.slot ?? 0;
  const showPause = opts.showPause ?? true;
  const inset = safeInset();

  // Phone half / stacked phone ≈ narrow; iPad landscape half ≈ tablet.
  const tablet = viewW >= 480 && viewH >= 500;
  const narrow = viewW < 480;
  const short = viewH < 400;

  const edgeL = (originX < 4 ? inset.left : 0) + (narrow ? 10 : 16);
  const edgeR = (originX + viewW >= canvasW - 4 ? inset.right : 0) + (narrow ? 10 : 16);
  const edgeB = (originY + viewH >= canvasH - 2 ? inset.bottom : 0) + (short ? 8 : 14);
  const edgeT = (originY < 2 ? inset.top : 0) + 8;

  const stickR = tablet
    ? Math.min(72, Math.max(52, Math.round(Math.min(viewW, viewH) * 0.09)))
    : Math.min(
        short ? 40 : narrow ? 48 : 58,
        Math.max(30, Math.round(Math.min(viewW, viewH) * (short ? 0.14 : narrow ? 0.15 : 0.11))),
      );
  const btnR = tablet
    ? Math.min(40, Math.max(28, Math.round(Math.min(viewW, viewH) * 0.048)))
    : Math.min(
        short ? 22 : narrow ? 26 : 32,
        Math.max(18, Math.round(Math.min(viewW, viewH) * (short ? 0.07 : narrow ? 0.08 : 0.06))),
      );
  const gap = btnR * 0.24;

  const stick: StickZone = {
    kind: 'stick',
    cx: originX + edgeL + stickR + 4,
    cy: originY + viewH - edgeB - stickR - 4,
    radius: stickR,
    hitX: originX,
    hitY: originY + viewH * 0.32,
    hitW: viewW * 0.48,
    hitH: viewH * 0.68,
  };

  const clusterX = originX + viewW - edgeR - btnR * (narrow ? 2.0 : tablet ? 2.5 : 2.3);
  const clusterY = originY + viewH - edgeB - btnR * (short ? 2.0 : tablet ? 2.6 : narrow ? 2.15 : 2.45);

  const buttons: ButtonZone[] = [
    { kind: 'button', id: 'interact', x: clusterX, y: clusterY, r: btnR + (tablet ? 6 : narrow ? 2 : 4), label: 'USE' },
    { kind: 'button', id: 'build', x: clusterX - btnR * 2.05 - gap, y: clusterY, r: btnR, label: 'BUILD' },
    { kind: 'button', id: 'blink', x: clusterX, y: clusterY - btnR * 2.05 - gap, r: btnR, label: 'DASH' },
    { kind: 'button', id: 'eat', x: clusterX + btnR * 2.05 + gap, y: clusterY, r: btnR, label: 'EAT' },
  ];

  if (showPause) {
    buttons.push({
      kind: 'button',
      id: 'pause',
      x: originX + viewW - edgeR - 20,
      y: originY + edgeT + 18,
      r: tablet ? 22 : 18,
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
  const dockH = Math.min(150, Math.max(100, s.radius * 2.4));

  ctx.save();

  const grad = ctx.createLinearGradient(0, s.cy - dockH * 0.55, 0, s.cy + s.radius + 16);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.3, 'rgba(0,0,0,0.4)');
  grad.addColorStop(1, 'rgba(0,0,0,0.62)');
  ctx.fillStyle = grad;
  ctx.fillRect(layout.originX, s.cy - dockH * 0.55, layout.viewW, dockH * 0.55 + s.radius + 20);

  ctx.globalAlpha = 0.8;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.roundRect(layout.originX + 10, layout.originY + 10, 48, 24, 7);
  ctx.fill();
  ctx.globalAlpha = 1;
  drawText(ctx, layout.slot === 0 ? 'P1' : 'P2', layout.originX + 34, layout.originY + 22, 14, 'center');

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
    const size = b.id === 'pause' ? 12 : main ? 13 : 11;
    drawText(ctx, b.label, b.x, b.y + 1, size, 'center');
  }
  ctx.restore();
}
