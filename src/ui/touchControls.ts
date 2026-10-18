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
  viewW: number;
}

export interface TouchLayoutOpts {
  confirm?: boolean;
  slot?: PlayerSlot;
  /** Left edge of this player's screen (0 = full / P1, width/2 = P2). */
  originX?: number;
  showPause?: boolean;
}

/**
 * Joystick on the left of this player's screen, action buttons on the right.
 * Pass `originX` + `viewW` for split-screen so each half gets its own pad.
 */
export function touchLayout(viewW: number, h: number, opts: TouchLayoutOpts = {}): TouchLayout {
  const originX = opts.originX ?? 0;
  const slot = opts.slot ?? 0;
  const showPause = opts.showPause ?? true;
  const narrow = viewW < 480;
  const safe = Math.min(14, Math.round(Math.min(viewW, h) * 0.025));
  const stickR = Math.min(narrow ? 44 : 58, Math.max(32, Math.round(Math.min(viewW, h) * (narrow ? 0.16 : 0.11))));
  const btnR = Math.min(narrow ? 24 : 32, Math.max(18, Math.round(Math.min(viewW, h) * (narrow ? 0.085 : 0.06))));
  const gap = btnR * 0.22;

  const stick: StickZone = {
    kind: 'stick',
    cx: originX + safe + stickR + 6,
    cy: h - safe - stickR - 10,
    radius: stickR,
    hitX: originX,
    hitY: h * 0.42,
    hitW: viewW * 0.5,
    hitH: h * 0.58,
  };

  const clusterX = originX + viewW - safe - btnR * (narrow ? 2.0 : 2.35);
  const clusterY = h - safe - btnR * (narrow ? 2.15 : 2.5);

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
      y: safe + 18,
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

  return { stick, buttons, slot, originX, viewW };
}

export function touchBottomPad(h: number) {
  return Math.min(180, Math.max(140, Math.round(h * 0.3)));
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
  const dockH = Math.min(150, Math.max(110, layout.stick.radius * 2.6));

  ctx.save();

  // Solid dock so each split half clearly owns its own pad.
  const grad = ctx.createLinearGradient(0, layout.stick.cy - dockH * 0.55, 0, layout.stick.cy + layout.stick.radius + 20);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.35, 'rgba(0,0,0,0.35)');
  grad.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = grad;
  ctx.fillRect(layout.originX, layout.stick.cy - dockH * 0.55, layout.viewW, dockH * 0.55 + layout.stick.radius + 24);

  ctx.globalAlpha = 0.9;
  drawText(ctx, layout.slot === 0 ? 'P1' : 'P2', s.cx, s.cy - s.radius - 14, 13, 'center');

  ctx.globalAlpha = origin ? 0.55 : 0.42;
  ctx.fillStyle = '#0a0a0a';
  ctx.beginPath();
  ctx.arc(baseX, baseY, s.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.95;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.arc(baseX, baseY, s.radius * 0.35, 0, Math.PI * 2);
  ctx.stroke();

  const kn = stick ?? { x: 0, y: 0 };
  const kx = baseX + kn.x * (s.radius * 0.58);
  const ky = baseY + kn.y * (s.radius * 0.58);
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#eceff1';
  ctx.beginPath();
  ctx.arc(kx, ky, s.radius * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();

  for (const b of layout.buttons) {
    const main = b.id === 'interact';
    ctx.globalAlpha = main ? 0.72 : 0.55;
    ctx.fillStyle = b.id === 'pause' ? '#263238' : main ? '#2e7d32' : '#111';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.95;
    ctx.strokeStyle = main ? accent : '#fff';
    ctx.lineWidth = main ? 3 : 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
    const size = b.id === 'pause' ? 12 : main ? 12 : 10;
    drawText(ctx, b.label, b.x, b.y + 1, size, 'center');
  }
  ctx.restore();
}
