import type { CharacterDef } from '@/characters';

export interface DrawCharacterOpts {
  facing?: { x: number; y: number };
  walkTime?: number;
  time?: number;
  /** Seconds left in the strike pose (>0 = attacking). */
  attackT?: number;
  /** Total strike pose length; used to map attackT → 0..1. */
  attackDur?: number;
  attackStyle?: 'slash' | 'bolt';
}

/** Shared with PlayScene so pose length matches swing FX life. */
export const ATTACK_POSE = 0.26;

const OUTLINE_W = 1;
const OUTLINE_DIRS: [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];

let outlineBuf: HTMLCanvasElement | null = null;
let outlineCtx: CanvasRenderingContext2D | null = null;

function getOutlineBuf(w: number, h: number) {
  if (!outlineBuf) {
    outlineBuf = document.createElement('canvas');
    outlineCtx = outlineBuf.getContext('2d');
  }
  if (outlineBuf.width !== w || outlineBuf.height !== h) {
    outlineBuf.width = w;
    outlineBuf.height = h;
  }
  return { canvas: outlineBuf, ctx: outlineCtx! };
}

/** Push the character's main color toward a bright neon rim. */
function neonOutline(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  // Lift toward white while keeping the hue punchy.
  r = Math.min(255, Math.round(r * 0.45 + 255 * 0.55 + 40));
  g = Math.min(255, Math.round(g * 0.45 + 255 * 0.55 + 40));
  b = Math.min(255, Math.round(b * 0.45 + 255 * 0.55 + 40));
  return `rgb(${r},${g},${b})`;
}

/**
 * Soft painted silhouettes with a thin dark outline.
 */
export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  def: CharacterDef,
  cx: number,
  cy: number,
  size: number,
  opts: DrawCharacterOpts = {},
) {
  const r = size / 2;
  const walk = opts.walkTime ?? 0;
  const facing = opts.facing ?? { x: 1, y: 0.25 };
  // Face left/right by mirroring — stay upright, no sideways tilt.
  const flip = facing.x < -0.05 ? -1 : 1;
  const moving = walk > 0.02;
  // Two steps per cycle; phase drives legs, arms, bob, and lean together.
  const phase = moving ? walk * 11 : (opts.time ?? 0) * 1.4;
  const swing = moving ? Math.sin(phase) : Math.sin(phase) * 0.08;
  const dur = opts.attackDur ?? ATTACK_POSE;
  const attacking = (opts.attackT ?? 0) > 0.001;
  // 0 at strike start → 1 at end.
  const atk = attacking ? 1 - Math.min(1, (opts.attackT ?? 0) / dur) : -1;
  const atkPulse = atk < 0 ? 0 : Math.sin(atk * Math.PI);
  const bob = moving ? Math.abs(Math.sin(phase)) * -r * 0.14 : Math.sin(phase) * -r * 0.02;
  const lean = (moving ? swing * 0.08 : 0) + atkPulse * (opts.attackStyle === 'bolt' ? -0.12 : 0.22);
  const squash = (moving ? 1 + Math.abs(Math.sin(phase)) * 0.04 : 1) * (1 + atkPulse * 0.06);

  const pad = Math.ceil(OUTLINE_W) + 4;
  const bw = Math.ceil(size * 2.4) + pad * 2;
  const bh = Math.ceil(size * 2.8) + pad * 2;
  const { canvas: buf, ctx: bctx } = getOutlineBuf(bw, bh);
  const dx = cx - bw / 2;
  const dy = cy + bob - bh / 2;

  // Soft ground shadow under the sprite
  ctx.save();
  const foot = moving ? Math.abs(Math.sin(phase)) : 0;
  ctx.translate(cx, cy + bob);
  ctx.scale(flip * (2 - squash), squash);
  ctx.rotate(lean);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.92, r * (0.62 + foot * 0.12), r * (0.18 + foot * 0.04), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const paintBody = () => {
    bctx.clearRect(0, 0, bw, bh);
    bctx.save();
    bctx.translate(bw / 2, bh / 2 + size * 0.15);
    bctx.scale(flip * (2 - squash), squash);
    bctx.rotate(lean);
    if (def.id === 'alien') drawAlien(bctx, def, r, swing, moving, atk);
    else if (def.id === 'knight') drawKnight(bctx, def, r, swing, moving, atk);
    else drawWizard(bctx, def, r, swing, moving, atk);
    bctx.restore();
  };

  // Silhouette stamps → bright neon outline in the character's main color.
  const rim = neonOutline(def.color);
  paintBody();
  bctx.save();
  bctx.globalCompositeOperation = 'source-in';
  bctx.fillStyle = rim;
  bctx.fillRect(0, 0, bw, bh);
  bctx.restore();

  ctx.save();
  ctx.shadowColor = rim;
  ctx.shadowBlur = 3;
  for (const [ox, oy] of OUTLINE_DIRS) {
    ctx.drawImage(buf, dx + ox * OUTLINE_W, dy + oy * OUTLINE_W);
  }
  ctx.restore();

  paintBody();
  ctx.drawImage(buf, dx, dy);
}

function shade(hex: string, k: number) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * k)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * k)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * k)));
  return `rgb(${r},${g},${b})`;
}

function drawAlien(
  ctx: CanvasRenderingContext2D,
  def: CharacterDef,
  r: number,
  swing: number,
  moving: boolean,
  atk: number,
) {
  const skin = def.color;
  const suit = def.accent;
  const amp = moving ? 1 : 0.25;
  const leg = swing * r * 0.28 * amp;
  const arm = swing * r * 0.22 * amp;
  // Claw swipe: rear back then whip forward.
  const claw = atk < 0 ? 0 : -1.1 + atk * 2.4;

  // Legs — stride forward/back
  ctx.fillStyle = shade(skin, 0.85);
  ctx.beginPath();
  ctx.ellipse(-r * 0.18 - swing * r * 0.08 * amp, r * 0.55 + leg, r * 0.12, r * 0.3, -0.25 + swing * 0.35 * amp, 0, Math.PI * 2);
  ctx.ellipse(r * 0.18 + swing * r * 0.08 * amp, r * 0.55 - leg, r * 0.12, r * 0.3, 0.25 - swing * 0.35 * amp, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = suit;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.12, r * 0.38, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(suit, 1.2);
  ctx.beginPath();
  ctx.ellipse(-r * 0.1, r * 0.02, r * 0.16, r * 0.22, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // Rear arm
  ctx.fillStyle = shade(skin, 0.9);
  ctx.beginPath();
  ctx.ellipse(-r * 0.42, r * 0.05 - arm, r * 0.1, r * 0.28, 0.45 - swing * 0.4 * amp, 0, Math.PI * 2);
  ctx.fill();

  // Strike arm + claws
  ctx.save();
  ctx.translate(r * 0.38, r * 0.02);
  ctx.rotate(atk < 0 ? -0.45 + swing * 0.4 * amp : claw);
  ctx.fillStyle = shade(skin, 0.95);
  ctx.beginPath();
  ctx.ellipse(r * 0.08, 0, r * 0.1, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  if (atk >= 0) {
    ctx.strokeStyle = shade(skin, 1.15);
    ctx.lineWidth = Math.max(1.5, r * 0.07);
    ctx.lineCap = 'round';
    for (const a of [-0.45, 0, 0.45]) {
      ctx.beginPath();
      ctx.moveTo(r * 0.05, -r * 0.2);
      ctx.quadraticCurveTo(r * 0.45, -r * 0.15 + a * r * 0.4, r * 0.7, a * r * 0.55);
      ctx.stroke();
    }
  }
  ctx.restore();

  // Head
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.42, r * 0.42, r * 0.48, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(skin, 1.25);
  ctx.beginPath();
  ctx.ellipse(-r * 0.12, -r * 0.55, r * 0.18, r * 0.2, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // Antennae
  ctx.strokeStyle = shade(skin, 0.7);
  ctx.lineWidth = Math.max(1.2, r * 0.08);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-r * 0.15, -r * 0.75);
  ctx.quadraticCurveTo(-r * 0.35, -r * 1.05, -r * 0.4, -r * 1.2);
  ctx.moveTo(r * 0.15, -r * 0.75);
  ctx.quadraticCurveTo(r * 0.35, -r * 1.05, r * 0.4, -r * 1.2);
  ctx.stroke();
  ctx.fillStyle = shade(skin, 1.1);
  ctx.beginPath();
  ctx.arc(-r * 0.4, -r * 1.2, r * 0.08, 0, Math.PI * 2);
  ctx.arc(r * 0.4, -r * 1.2, r * 0.08, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#1a1c18';
  ctx.beginPath();
  ctx.ellipse(-r * 0.16, -r * 0.38, r * 0.14, r * 0.1, 0.2, 0, Math.PI * 2);
  ctx.ellipse(r * 0.16, -r * 0.38, r * 0.14, r * 0.1, -0.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawKnight(
  ctx: CanvasRenderingContext2D,
  def: CharacterDef,
  r: number,
  swing: number,
  moving: boolean,
  atk: number,
) {
  const steel = def.color;
  const cloth = def.accent;
  const amp = moving ? 1 : 0.25;
  const leg = swing * r * 0.26 * amp;
  const arm = swing * r * 0.18 * amp;
  // Sword: raised behind → sweeping follow-through.
  const swordAng = atk < 0 ? -0.55 + swing * 0.35 * amp : -2.15 + atk * 3.35;

  // Cloak — sway with gait
  ctx.fillStyle = shade(cloth, 0.75);
  ctx.beginPath();
  ctx.moveTo(-r * 0.15, -r * 0.15);
  ctx.quadraticCurveTo(-r * 0.85 - swing * r * 0.06 * amp, r * 0.2, -r * 0.55 - swing * r * 0.1 * amp, r * 0.85);
  ctx.quadraticCurveTo(-r * 0.1, r * 0.55, r * 0.15, r * 0.3);
  ctx.closePath();
  ctx.fill();

  // Legs
  ctx.fillStyle = shade(steel, 0.85);
  ctx.beginPath();
  ctx.ellipse(-r * 0.16 - swing * r * 0.1 * amp, r * 0.55 + leg, r * 0.14, r * 0.3, -0.2 + swing * 0.4 * amp, 0, Math.PI * 2);
  ctx.ellipse(r * 0.16 + swing * r * 0.1 * amp, r * 0.55 - leg, r * 0.14, r * 0.3, 0.2 - swing * 0.4 * amp, 0, Math.PI * 2);
  ctx.fill();

  // Shield — braces forward on strike
  const shieldNudge = atk < 0 ? 0 : Math.sin(atk * Math.PI) * r * 0.08;
  ctx.fillStyle = cloth;
  ctx.beginPath();
  ctx.moveTo(-r * 0.85 - shieldNudge, -r * 0.15 - arm * 0.3);
  ctx.lineTo(-r * 0.45 - shieldNudge, -r * 0.2 - arm * 0.3);
  ctx.lineTo(-r * 0.42 - shieldNudge, r * 0.35 - arm * 0.3);
  ctx.quadraticCurveTo(-r * 0.65 - shieldNudge, r * 0.55 - arm * 0.3, -r * 0.88 - shieldNudge, r * 0.3 - arm * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(cloth, 1.2);
  ctx.fillRect(-r * 0.72 - shieldNudge, -r * 0.02 - arm * 0.3, r * 0.22, r * 0.08);
  ctx.fillRect(-r * 0.64 - shieldNudge, -r * 0.12 - arm * 0.3, r * 0.07, r * 0.35);

  // Body plate
  ctx.fillStyle = steel;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.08, r * 0.4, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(steel, 1.2);
  ctx.beginPath();
  ctx.ellipse(-r * 0.1, -r * 0.02, r * 0.16, r * 0.22, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(cloth, 0.9);
  ctx.fillRect(-r * 0.1, -r * 0.15, r * 0.2, r * 0.5);

  // Sword arm — rotates through the cut
  ctx.save();
  ctx.translate(r * 0.32, r * 0.02);
  ctx.rotate(swordAng);
  ctx.fillStyle = shade(steel, 0.9);
  ctx.beginPath();
  ctx.ellipse(r * 0.12, 0, r * 0.12, r * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5a4030';
  ctx.fillRect(r * 0.02, -r * 0.08, r * 0.2, r * 0.16);
  ctx.strokeStyle = shade(steel, 1.2);
  ctx.lineWidth = Math.max(2.2, r * 0.11);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(r * 0.18, 0);
  ctx.lineTo(r * 0.95, -r * 0.08);
  ctx.stroke();
  // Blade highlight
  ctx.strokeStyle = 'rgba(255, 248, 230, 0.55)';
  ctx.lineWidth = Math.max(1, r * 0.04);
  ctx.beginPath();
  ctx.moveTo(r * 0.28, -r * 0.04);
  ctx.lineTo(r * 0.88, -r * 0.1);
  ctx.stroke();
  if (atk >= 0 && atk < 0.85) {
    ctx.strokeStyle = 'rgba(255, 248, 230, 0.35)';
    ctx.lineWidth = Math.max(3, r * 0.16);
    ctx.beginPath();
    ctx.moveTo(r * 0.4, 0);
    ctx.lineTo(r * 1.05, -r * 0.12);
    ctx.stroke();
  }
  ctx.restore();

  // Helm
  ctx.fillStyle = shade(steel, 0.95);
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.42, r * 0.38, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(steel, 1.2);
  ctx.beginPath();
  ctx.ellipse(-r * 0.1, -r * 0.55, r * 0.16, r * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1c18';
  ctx.fillRect(-r * 0.28, -r * 0.42, r * 0.56, r * 0.14);
  // Plume
  ctx.fillStyle = shade(cloth, 0.85);
  ctx.beginPath();
  ctx.ellipse(r * 0.08, -r * 0.95, r * 0.1, r * 0.32, 0.35, 0, Math.PI * 2);
  ctx.fill();
}

function drawWizard(
  ctx: CanvasRenderingContext2D,
  def: CharacterDef,
  r: number,
  swing: number,
  moving: boolean,
  atk: number,
) {
  const robe = def.color;
  const trim = def.accent;
  const amp = moving ? 1 : 0.25;
  const sway = swing * r * 0.12 * amp;
  const hem = swing * r * 0.1 * amp;
  const cast = atk < 0 ? 0 : Math.sin(atk * Math.PI);
  const tipX = r * 0.78 + sway + cast * r * 0.15;
  const tipY = -r * 0.85 - Math.abs(swing) * r * 0.08 * amp - cast * r * 0.35;

  // Staff — thrusts up and forward on cast
  ctx.strokeStyle = '#5a4030';
  ctx.lineWidth = Math.max(2, r * 0.12);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(r * 0.7 + sway * 0.3, r * 0.85);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();
  ctx.fillStyle = shade(trim, 0.95 + cast * 0.3);
  ctx.beginPath();
  ctx.moveTo(tipX, tipY - r * 0.2);
  ctx.lineTo(tipX + r * 0.12, tipY + r * 0.1);
  ctx.lineTo(tipX, tipY + r * 0.15);
  ctx.lineTo(tipX - r * 0.12, tipY + r * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(trim, 1.25);
  ctx.beginPath();
  ctx.moveTo(tipX - r * 0.04, tipY - r * 0.05);
  ctx.lineTo(tipX, tipY - r * 0.2);
  ctx.lineTo(tipX + r * 0.02, tipY);
  ctx.fill();

  // Cast glow at the crystal
  if (cast > 0.05) {
    ctx.fillStyle = trim;
    ctx.globalAlpha = 0.35 * cast;
    ctx.beginPath();
    ctx.arc(tipX, tipY - r * 0.05, r * (0.25 + cast * 0.35), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.7 * cast;
    ctx.fillStyle = '#fff8e7';
    ctx.beginPath();
    ctx.arc(tipX, tipY - r * 0.05, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Robe — hem swings opposite the lead foot
  ctx.fillStyle = robe;
  ctx.beginPath();
  ctx.moveTo(-r * 0.3, 0);
  ctx.quadraticCurveTo(-r * 0.75 - hem, r * 0.45, -r * 0.4 - hem, r * 0.9);
  ctx.quadraticCurveTo(0, r * 1.0, r * 0.4 + hem, r * 0.9);
  ctx.quadraticCurveTo(r * 0.75 + hem, r * 0.45, r * 0.3, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(robe, 1.2);
  ctx.beginPath();
  ctx.ellipse(-r * 0.12, r * 0.35, r * 0.18, r * 0.4, -0.15, 0, Math.PI * 2);
  ctx.fill();

  // Torso
  ctx.fillStyle = shade(robe, 1.05);
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.05, r * 0.35, r * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = trim;
  ctx.lineWidth = Math.max(1.5, r * 0.08);
  ctx.beginPath();
  ctx.moveTo(-r * 0.28, r * 0.12);
  ctx.quadraticCurveTo(0, r * 0.2, r * 0.28, r * 0.12);
  ctx.stroke();

  // Head
  ctx.fillStyle = '#b89068';
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.42, r * 0.28, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade('#b89068', 1.15);
  ctx.beginPath();
  ctx.ellipse(-r * 0.08, -r * 0.5, r * 0.12, r * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Beard
  ctx.fillStyle = '#c0b8a8';
  ctx.beginPath();
  ctx.moveTo(-r * 0.22, -r * 0.28);
  ctx.quadraticCurveTo(-r * 0.28, r * 0.15, 0, r * 0.35);
  ctx.quadraticCurveTo(r * 0.28, r * 0.15, r * 0.22, -r * 0.28);
  ctx.closePath();
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#1a1c18';
  ctx.beginPath();
  ctx.arc(-r * 0.1, -r * 0.42, r * 0.04, 0, Math.PI * 2);
  ctx.arc(r * 0.1, -r * 0.42, r * 0.04, 0, Math.PI * 2);
  ctx.fill();

  // Hat
  ctx.fillStyle = shade(robe, 0.9);
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.62, r * 0.55, r * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-r * 0.32, -r * 0.62);
  ctx.lineTo(r * 0.32, -r * 0.62);
  ctx.lineTo(r * 0.18, -r * 1.35);
  ctx.quadraticCurveTo(0, -r * 1.2, -r * 0.05, -r * 0.9);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(robe, 1.15);
  ctx.beginPath();
  ctx.moveTo(-r * 0.1, -r * 0.62);
  ctx.lineTo(r * 0.05, -r * 1.2);
  ctx.lineTo(r * 0.12, -r * 0.9);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = trim;
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.68, r * 0.35, r * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
}
