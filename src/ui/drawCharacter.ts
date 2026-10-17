import type { CharacterDef } from '@/characters';

export interface DrawCharacterOpts {
  facing?: { x: number; y: number };
  walkTime?: number;
  time?: number;
}

/**
 * Soft painted silhouettes — same language as world props:
 * contact shadow, flat fills with slight shade, no neon outlines.
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
  const flip = facing.x < -0.05 ? -1 : 1;
  const moving = walk > 0.02;
  // Two steps per cycle; phase drives legs, arms, bob, and lean together.
  const phase = moving ? walk * 11 : (opts.time ?? 0) * 1.4;
  const swing = moving ? Math.sin(phase) : Math.sin(phase) * 0.08;
  const bob = moving ? Math.abs(Math.sin(phase)) * -r * 0.14 : Math.sin(phase) * -r * 0.02;
  const lean = moving ? swing * 0.08 : 0;
  const squash = moving ? 1 + Math.abs(Math.sin(phase)) * 0.04 : 1;

  ctx.save();
  ctx.translate(cx, cy + bob);
  ctx.scale(flip * (2 - squash), squash);
  ctx.rotate(lean);

  // Soft ground shadow — widens slightly on each footfall
  const foot = moving ? Math.abs(Math.sin(phase)) : 0;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.92, r * (0.62 + foot * 0.12), r * (0.18 + foot * 0.04), 0, 0, Math.PI * 2);
  ctx.fill();

  if (def.id === 'alien') drawAlien(ctx, def, r, swing, moving);
  else if (def.id === 'knight') drawKnight(ctx, def, r, swing, moving);
  else drawWizard(ctx, def, r, swing, moving);

  ctx.restore();
}

function shade(hex: string, k: number) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * k)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * k)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * k)));
  return `rgb(${r},${g},${b})`;
}

function drawAlien(ctx: CanvasRenderingContext2D, def: CharacterDef, r: number, swing: number, moving: boolean) {
  const skin = def.color;
  const suit = def.accent;
  const amp = moving ? 1 : 0.25;
  const leg = swing * r * 0.28 * amp;
  const arm = swing * r * 0.22 * amp;

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

  // Arms — opposite swing to legs
  ctx.fillStyle = shade(skin, 0.9);
  ctx.beginPath();
  ctx.ellipse(-r * 0.42, r * 0.05 - arm, r * 0.1, r * 0.28, 0.45 - swing * 0.4 * amp, 0, Math.PI * 2);
  ctx.ellipse(r * 0.42, r * 0.05 + arm, r * 0.1, r * 0.28, -0.45 + swing * 0.4 * amp, 0, Math.PI * 2);
  ctx.fill();

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

function drawKnight(ctx: CanvasRenderingContext2D, def: CharacterDef, r: number, swing: number, moving: boolean) {
  const steel = def.color;
  const cloth = def.accent;
  const amp = moving ? 1 : 0.25;
  const leg = swing * r * 0.26 * amp;
  const arm = swing * r * 0.18 * amp;

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

  // Shield
  ctx.fillStyle = cloth;
  ctx.beginPath();
  ctx.moveTo(-r * 0.85, -r * 0.15 - arm * 0.3);
  ctx.lineTo(-r * 0.45, -r * 0.2 - arm * 0.3);
  ctx.lineTo(-r * 0.42, r * 0.35 - arm * 0.3);
  ctx.quadraticCurveTo(-r * 0.65, r * 0.55 - arm * 0.3, -r * 0.88, r * 0.3 - arm * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(cloth, 1.2);
  ctx.fillRect(-r * 0.72, -r * 0.02 - arm * 0.3, r * 0.22, r * 0.08);
  ctx.fillRect(-r * 0.64, -r * 0.12 - arm * 0.3, r * 0.07, r * 0.35);

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

  // Sword arm
  ctx.fillStyle = shade(steel, 0.9);
  ctx.beginPath();
  ctx.ellipse(r * 0.42, r * 0.05 - arm, r * 0.12, r * 0.28, -0.5 + swing * 0.45 * amp, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shade(steel, 1.15);
  ctx.lineWidth = Math.max(2, r * 0.1);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(r * 0.5, r * 0.2 - arm * 0.5);
  ctx.lineTo(r * 0.72, -r * 0.55 - arm);
  ctx.stroke();
  ctx.fillStyle = '#5a4030';
  ctx.fillRect(r * 0.44, r * 0.15 - arm * 0.5, r * 0.12, r * 0.18);

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

function drawWizard(ctx: CanvasRenderingContext2D, def: CharacterDef, r: number, swing: number, moving: boolean) {
  const robe = def.color;
  const trim = def.accent;
  const amp = moving ? 1 : 0.25;
  const sway = swing * r * 0.12 * amp;
  const hem = swing * r * 0.1 * amp;

  // Staff — plants and lifts with the stride
  ctx.strokeStyle = '#5a4030';
  ctx.lineWidth = Math.max(2, r * 0.12);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(r * 0.7 + sway * 0.3, r * 0.85);
  ctx.lineTo(r * 0.78 + sway, -r * 0.85 - Math.abs(swing) * r * 0.08 * amp);
  ctx.stroke();
  ctx.fillStyle = shade(trim, 0.95);
  ctx.beginPath();
  ctx.moveTo(r * 0.78 + sway, -r * 1.05);
  ctx.lineTo(r * 0.9 + sway, -r * 0.75);
  ctx.lineTo(r * 0.78 + sway, -r * 0.7);
  ctx.lineTo(r * 0.66 + sway, -r * 0.75);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(trim, 1.25);
  ctx.beginPath();
  ctx.moveTo(r * 0.74 + sway, -r * 0.95);
  ctx.lineTo(r * 0.78 + sway, -r * 1.05);
  ctx.lineTo(r * 0.8 + sway, -r * 0.88);
  ctx.fill();

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
