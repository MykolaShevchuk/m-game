import { drawText } from './text';

export type TouchAction = 'interact' | 'build' | 'blink' | 'pause' | 'confirm';

export interface StickZone {
  kind: 'stick';
  cx: number;
  cy: number;
  radius: number;
}

export interface ButtonZone {
  kind: 'button';
  id: TouchAction;
  x: number;
  y: number;
  r: number;
  label: string;
}

export type TouchZone = StickZone | ButtonZone;

export interface TouchLayout {
  stick: StickZone;
  buttons: ButtonZone[];
}

/** On-screen stick + action buttons for the current canvas size. */
export function touchLayout(w: number, h: number, opts: { confirm?: boolean } = {}): TouchLayout {
  const stickR = Math.min(64, Math.max(48, Math.round(h * 0.11)));
  const btnR = Math.min(32, Math.max(24, Math.round(h * 0.055)));
  const margin = 16;
  const stick: StickZone = {
    kind: 'stick',
    cx: margin + stickR,
    cy: h - margin - stickR,
    radius: stickR,
  };

  const baseX = w - margin - btnR;
  const baseY = h - margin - btnR - 8;
  const buttons: ButtonZone[] = [
    { kind: 'button', id: 'interact', x: baseX - btnR * 2.1, y: baseY - 4, r: btnR, label: 'F' },
    { kind: 'button', id: 'build', x: baseX, y: baseY - btnR * 2.2, r: btnR, label: 'B' },
    { kind: 'button', id: 'blink', x: baseX + 4, y: baseY + btnR * 0.15, r: btnR, label: 'BL' },
    { kind: 'button', id: 'pause', x: w - margin - 20, y: margin + 20, r: 20, label: '||' },
  ];

  if (opts.confirm) {
    buttons.push({
      kind: 'button',
      id: 'confirm',
      x: baseX - btnR * 2.1,
      y: baseY - btnR * 2.4,
      r: btnR,
      label: '✓',
    });
  }

  return { stick, buttons };
}

/** Vertical space reserved above the bottom edge for stick / buttons. */
export function touchBottomPad(h: number) {
  return Math.min(150, Math.max(120, Math.round(h * 0.28)));
}

export function drawTouchControls(
  ctx: CanvasRenderingContext2D,
  layout: TouchLayout,
  stick: { x: number; y: number } | null,
) {
  const s = layout.stick;
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(s.cx, s.cy, s.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();

  const kn = stick ?? { x: 0, y: 0 };
  const kx = s.cx + kn.x * (s.radius * 0.55);
  const ky = s.cy + kn.y * (s.radius * 0.55);
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(kx, ky, s.radius * 0.38, 0, Math.PI * 2);
  ctx.fill();

  for (const b of layout.buttons) {
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = b.id === 'pause' ? '#263238' : '#000';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 0.9;
    drawText(ctx, b.label, b.x, b.y + 1, b.id === 'pause' ? 14 : 16, 'center');
  }
  ctx.restore();
}
