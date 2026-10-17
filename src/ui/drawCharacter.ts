import type { CharacterDef } from '@/characters';

export interface DrawCharacterOpts {
  /** Facing direction; negative x flips the sprite. Default faces right-ish down. */
  facing?: { x: number; y: number };
  /** Accumulated walk time for leg / arm swing. */
  walkTime?: number;
}

/** Draws a character centered on (cx, cy); `size` is the overall body diameter. */
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
  const facing = opts.facing ?? { x: 1, y: 0.3 };
  const flip = facing.x < -0.05 ? -1 : 1;
  const moving = walk > 0;
  const swing = moving ? Math.sin(walk * 12) : Math.sin(walk * 2) * 0.15;
  const bob = moving ? Math.abs(Math.sin(walk * 12)) * -r * 0.08 : 0;

  ctx.save();
  ctx.translate(cx, cy + bob);
  ctx.scale(flip, 1);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1, size / 18);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';

  // Ground shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.92, r * 0.85, r * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  if (def.id === 'alien') drawAlien(ctx, def, r, swing, moving);
  else if (def.id === 'knight') drawKnight(ctx, def, r, swing, moving);
  else drawWizard(ctx, def, r, swing, moving);

  ctx.restore();
}

function shade(hex: string, amount: number): string {
  const n = hex.replace('#', '');
  const v = parseInt(n.length === 3 ? n.split('').map((c) => c + c).join('') : n, 16);
  const r = Math.min(255, Math.max(0, ((v >> 16) & 255) + amount));
  const g = Math.min(255, Math.max(0, ((v >> 8) & 255) + amount));
  const b = Math.min(255, Math.max(0, (v & 255) + amount));
  return `rgb(${r},${g},${b})`;
}

function drawAlien(ctx: CanvasRenderingContext2D, def: CharacterDef, r: number, swing: number, moving: boolean) {
  const skin = def.color;
  const suit = def.accent;
  const legSwing = swing * r * 0.22;

  // Legs
  for (const side of [-1, 1] as const) {
    const lx = side * r * 0.22;
    const ly = r * 0.35 + side * legSwing;
    ctx.strokeStyle = shade(skin, -35);
    ctx.lineWidth = Math.max(2, r * 0.16);
    ctx.beginPath();
    ctx.moveTo(lx, r * 0.15);
    ctx.quadraticCurveTo(lx + side * r * 0.08, ly + r * 0.2, lx + side * 0.05 * r, r * 0.72);
    ctx.stroke();
    ctx.fillStyle = shade(skin, -20);
    ctx.beginPath();
    ctx.ellipse(lx + side * 0.05 * r, r * 0.78, r * 0.16, r * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Backpack
  ctx.fillStyle = shade(suit, -25);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.lineWidth = Math.max(1, r / 14);
  ctx.beginPath();
  ctx.roundRect(-r * 0.55, -r * 0.15, r * 0.35, r * 0.55, r * 0.1);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ff5cf0';
  ctx.shadowColor = '#ff5cf0';
  ctx.shadowBlur = r * 0.35;
  ctx.beginPath();
  ctx.arc(-r * 0.38, r * 0.05, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-r * 0.38, r * 0.28, r * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Arms
  for (const side of [-1, 1] as const) {
    const ax = side * r * 0.55;
    const ay = r * 0.05 - side * swing * r * 0.18;
    ctx.strokeStyle = shade(skin, -15);
    ctx.lineWidth = Math.max(2, r * 0.14);
    ctx.beginPath();
    ctx.moveTo(side * r * 0.28, -r * 0.05);
    ctx.quadraticCurveTo(ax, ay, ax + side * r * 0.05, ay + r * 0.35);
    ctx.stroke();
    // Three-finger hand
    ctx.fillStyle = skin;
    const hx = ax + side * r * 0.05;
    const hy = ay + r * 0.38;
    ctx.beginPath();
    ctx.arc(hx, hy, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
    for (let f = -1; f <= 1; f++) {
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + side * r * 0.12 + f * r * 0.06, hy + r * 0.14);
      ctx.stroke();
    }
  }

  // Torso (suit)
  const bodyGrad = ctx.createLinearGradient(-r * 0.4, -r * 0.2, r * 0.4, r * 0.5);
  bodyGrad.addColorStop(0, shade(suit, 20));
  bodyGrad.addColorStop(1, shade(suit, -30));
  ctx.fillStyle = bodyGrad;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.lineWidth = Math.max(1, r / 16);
  ctx.beginPath();
  ctx.moveTo(-r * 0.42, -r * 0.15);
  ctx.quadraticCurveTo(-r * 0.5, r * 0.2, -r * 0.32, r * 0.55);
  ctx.lineTo(r * 0.32, r * 0.55);
  ctx.quadraticCurveTo(r * 0.5, r * 0.2, r * 0.42, -r * 0.15);
  ctx.quadraticCurveTo(0, -r * 0.35, -r * 0.42, -r * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Chest panel + belt
  ctx.fillStyle = shade(skin, 10);
  ctx.beginPath();
  ctx.roundRect(-r * 0.18, -r * 0.05, r * 0.36, r * 0.28, r * 0.06);
  ctx.fill();
  ctx.fillStyle = '#5a6a78';
  ctx.fillRect(-r * 0.38, r * 0.32, r * 0.76, r * 0.1);
  ctx.fillStyle = '#ff5cf0';
  ctx.beginPath();
  ctx.arc(0, r * 0.37, r * 0.07, 0, Math.PI * 2);
  ctx.fill();

  // Neck
  ctx.fillStyle = skin;
  ctx.fillRect(-r * 0.12, -r * 0.42, r * 0.24, r * 0.22);

  drawAlienHead(ctx, 0, -r * 0.55, r * 0.48, skin, moving ? swing * 0.05 : 0);
}

function drawAlienHead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  skin: string,
  tipPulse: number,
) {
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.lineWidth = Math.max(1, r / 10);

  // Antennae
  for (const side of [-1, 1] as const) {
    const tipX = x + side * r * 0.95;
    const tipY = y - r * 1.85 + tipPulse * r * side;
    ctx.strokeStyle = shade(skin, -40);
    ctx.lineWidth = Math.max(1.5, r * 0.12);
    ctx.beginPath();
    ctx.moveTo(x + side * r * 0.35, y - r * 0.75);
    ctx.quadraticCurveTo(x + side * r * 0.55, y - r * 1.45, tipX, tipY);
    ctx.stroke();
    ctx.fillStyle = '#ff5cf0';
    ctx.shadowColor = '#ff5cf0';
    ctx.shadowBlur = r * 0.7;
    ctx.beginPath();
    ctx.arc(tipX, tipY, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Cranium
  const headGrad = ctx.createRadialGradient(x - r * 0.2, y - r * 0.3, r * 0.1, x, y, r * 1.2);
  headGrad.addColorStop(0, shade(skin, 35));
  headGrad.addColorStop(1, shade(skin, -25));
  ctx.fillStyle = headGrad;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.lineWidth = Math.max(1, r / 12);
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.2, r * 1.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Cheek ridges
  ctx.strokeStyle = shade(skin, -45);
  ctx.lineWidth = Math.max(1, r * 0.08);
  for (const side of [-1, 1] as const) {
    ctx.beginPath();
    ctx.moveTo(x + side * r * 0.7, y + r * 0.15);
    ctx.quadraticCurveTo(x + side * r * 0.95, y + r * 0.35, x + side * r * 0.55, y + r * 0.55);
    ctx.stroke();
  }

  // Eyes
  for (const side of [-1, 1] as const) {
    ctx.fillStyle = '#0a0a12';
    ctx.beginPath();
    ctx.ellipse(x + side * r * 0.42, y + r * 0.05, r * 0.42, r * 0.28, side * 0.45, 0, Math.PI * 2);
    ctx.fill();
    // Iris glow
    ctx.fillStyle = '#3dff9a';
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.ellipse(x + side * r * 0.4, y + r * 0.08, r * 0.18, r * 0.12, side * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(x + side * r * 0.32, y - r * 0.02, r * 0.09, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tiny mouth + nostrils
  ctx.fillStyle = shade(skin, -50);
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.55, r * 0.14, r * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(skin, -60);
  ctx.beginPath();
  ctx.arc(x - r * 0.08, y + r * 0.38, r * 0.04, 0, Math.PI * 2);
  ctx.arc(x + r * 0.08, y + r * 0.38, r * 0.04, 0, Math.PI * 2);
  ctx.fill();
}

function drawKnight(ctx: CanvasRenderingContext2D, def: CharacterDef, r: number, swing: number, moving: boolean) {
  const metal = def.color;
  const cloth = def.accent;
  const legSwing = swing * r * 0.2;

  // Cape
  ctx.fillStyle = shade(cloth, -20);
  ctx.beginPath();
  ctx.moveTo(-r * 0.35, -r * 0.2);
  ctx.quadraticCurveTo(-r * 0.95, r * 0.1, -r * 0.7, r * 0.75 + (moving ? Math.abs(swing) * r * 0.1 : 0));
  ctx.quadraticCurveTo(-r * 0.1, r * 0.55, r * 0.15, r * 0.35);
  ctx.lineTo(r * 0.1, -r * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.lineWidth = Math.max(1, r / 18);
  ctx.stroke();

  // Legs / greaves
  for (const side of [-1, 1] as const) {
    const lx = side * r * 0.2;
    const footY = r * 0.78 + side * legSwing * 0.5;
    ctx.fillStyle = shade(metal, -15);
    ctx.beginPath();
    ctx.roundRect(lx - r * 0.12, r * 0.25 + side * legSwing * 0.3, r * 0.24, r * 0.42, r * 0.06);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = shade(metal, -35);
    ctx.beginPath();
    ctx.ellipse(lx, footY, r * 0.18, r * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Shield (behind sword arm side — drawn first so body overlaps rim)
  drawShield(ctx, -r * 0.72, r * 0.1, r, cloth);

  // Torso / breastplate
  const plate = ctx.createLinearGradient(-r * 0.4, -r * 0.25, r * 0.45, r * 0.55);
  plate.addColorStop(0, shade(metal, 40));
  plate.addColorStop(0.45, metal);
  plate.addColorStop(1, shade(metal, -40));
  ctx.fillStyle = plate;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.lineWidth = Math.max(1, r / 14);
  ctx.beginPath();
  ctx.moveTo(-r * 0.48, -r * 0.2);
  ctx.lineTo(r * 0.48, -r * 0.2);
  ctx.lineTo(r * 0.4, r * 0.45);
  ctx.quadraticCurveTo(0, r * 0.6, -r * 0.4, r * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Surcoat stripe + rivets
  ctx.fillStyle = cloth;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(-r * 0.12, -r * 0.18, r * 0.24, r * 0.62);
  ctx.globalAlpha = 1;
  ctx.fillStyle = shade(metal, 50);
  for (const [rx, ry] of [
    [-0.32, -0.05],
    [0.32, -0.05],
    [-0.28, 0.25],
    [0.28, 0.25],
  ]) {
    ctx.beginPath();
    ctx.arc(rx * r, ry * r, r * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pauldrons
  for (const side of [-1, 1] as const) {
    ctx.fillStyle = shade(metal, side > 0 ? 10 : -10);
    ctx.beginPath();
    ctx.ellipse(side * r * 0.48, -r * 0.12, r * 0.22, r * 0.16, side * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Sword arm
  const swordSwing = -swing * 0.35;
  ctx.save();
  ctx.translate(r * 0.45, 0);
  ctx.rotate(swordSwing);
  ctx.strokeStyle = shade(metal, -20);
  ctx.lineWidth = Math.max(2, r * 0.14);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(r * 0.15, r * 0.35);
  ctx.stroke();
  // Blade
  const blade = ctx.createLinearGradient(r * 0.1, r * 0.2, r * 0.55, -r * 0.7);
  blade.addColorStop(0, '#dfe6ee');
  blade.addColorStop(1, '#8a94a0');
  ctx.fillStyle = blade;
  ctx.beginPath();
  ctx.moveTo(r * 0.08, r * 0.28);
  ctx.lineTo(r * 0.28, r * 0.18);
  ctx.lineTo(r * 0.42, -r * 0.75);
  ctx.lineTo(r * 0.18, -r * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.lineWidth = Math.max(1, r / 20);
  ctx.stroke();
  // Crossguard + grip
  ctx.fillStyle = '#c9a227';
  ctx.fillRect(r * 0.05, r * 0.18, r * 0.32, r * 0.08);
  ctx.fillStyle = '#5c3a1e';
  ctx.fillRect(r * 0.14, r * 0.26, r * 0.1, r * 0.22);
  ctx.restore();

  // Neck / gorget
  ctx.fillStyle = shade(metal, -10);
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.28, r * 0.22, r * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Helmet
  drawKnightHelm(ctx, 0, -r * 0.55, r * 0.42, metal);
}

function drawKnightHelm(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, metal: string) {
  const helm = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  helm.addColorStop(0, shade(metal, 45));
  helm.addColorStop(1, shade(metal, -35));
  ctx.fillStyle = helm;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.lineWidth = Math.max(1, r / 10);
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.05, r * 1.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Visor slit
  ctx.fillStyle = '#12141a';
  ctx.beginPath();
  ctx.roundRect(x - r * 0.75, y - r * 0.08, r * 1.5, r * 0.32, r * 0.08);
  ctx.fill();
  ctx.fillStyle = 'rgba(80, 200, 255, 0.25)';
  ctx.fillRect(x - r * 0.7, y - r * 0.02, r * 1.4, r * 0.08);

  // Nasal + brow ridge
  ctx.strokeStyle = shade(metal, -40);
  ctx.lineWidth = Math.max(1.5, r * 0.12);
  ctx.beginPath();
  ctx.moveTo(x, y - r * 0.15);
  ctx.lineTo(x, y + r * 0.35);
  ctx.stroke();

  // Plume
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.moveTo(x - r * 0.12, y - r * 0.95);
  ctx.quadraticCurveTo(x - r * 0.05, y - r * 1.85, x + r * 0.35, y - r * 1.55);
  ctx.quadraticCurveTo(x + r * 0.1, y - r * 1.15, x + r * 0.12, y - r * 0.95);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Chin plate
  ctx.fillStyle = shade(metal, -20);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.7, y + r * 0.35);
  ctx.quadraticCurveTo(x, y + r * 0.95, x + r * 0.7, y + r * 0.35);
  ctx.quadraticCurveTo(x, y + r * 0.55, x - r * 0.7, y + r * 0.35);
  ctx.fill();
  ctx.stroke();
}

function drawWizard(ctx: CanvasRenderingContext2D, def: CharacterDef, r: number, swing: number, _moving: boolean) {
  const robe = def.color;
  const trim = def.accent;
  const skin = '#e8b892';
  const legSwing = swing * r * 0.12;

  // Staff (behind)
  drawStaff(ctx, r * 0.85, r * 0.05, r, trim, swing);

  // Robe skirts
  ctx.fillStyle = shade(robe, -15);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.lineWidth = Math.max(1, r / 16);
  ctx.beginPath();
  ctx.moveTo(-r * 0.35, r * 0.05);
  ctx.quadraticCurveTo(-r * 0.85 - legSwing, r * 0.55, -r * 0.55, r * 0.85);
  ctx.quadraticCurveTo(0, r * 0.95, r * 0.55, r * 0.85);
  ctx.quadraticCurveTo(r * 0.85 + legSwing, r * 0.55, r * 0.35, r * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Fold lines
  ctx.strokeStyle = shade(robe, -45);
  ctx.lineWidth = Math.max(1, r / 22);
  for (const fx of [-0.25, 0, 0.25]) {
    ctx.beginPath();
    ctx.moveTo(fx * r, r * 0.15);
    ctx.quadraticCurveTo(fx * r + legSwing * 0.3, r * 0.5, fx * r * 0.8, r * 0.82);
    ctx.stroke();
  }

  // Shoes peeking out
  ctx.fillStyle = '#3a2a18';
  ctx.beginPath();
  ctx.ellipse(-r * 0.28 + legSwing * 0.4, r * 0.88, r * 0.16, r * 0.08, -0.2, 0, Math.PI * 2);
  ctx.ellipse(r * 0.28 - legSwing * 0.4, r * 0.88, r * 0.16, r * 0.08, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Sleeves / arms
  for (const side of [-1, 1] as const) {
    if (side > 0) continue; // right arm holds staff — sleeve suggestion only
    ctx.fillStyle = shade(robe, 5);
    ctx.beginPath();
    ctx.moveTo(side * r * 0.25, -r * 0.1);
    ctx.quadraticCurveTo(side * r * 0.7, r * 0.05 - swing * r * 0.1, side * r * 0.55, r * 0.4);
    ctx.quadraticCurveTo(side * r * 0.35, r * 0.35, side * r * 0.2, r * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.stroke();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(side * r * 0.55, r * 0.42, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  // Torso
  const body = ctx.createLinearGradient(0, -r * 0.3, 0, r * 0.4);
  body.addColorStop(0, shade(robe, 25));
  body.addColorStop(1, shade(robe, -20));
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-r * 0.4, -r * 0.25);
  ctx.lineTo(r * 0.4, -r * 0.25);
  ctx.lineTo(r * 0.32, r * 0.35);
  ctx.lineTo(-r * 0.32, r * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.stroke();

  // Sash + buckle
  ctx.fillStyle = trim;
  ctx.fillRect(-r * 0.34, r * 0.08, r * 0.68, r * 0.1);
  ctx.fillStyle = shade(trim, -40);
  ctx.beginPath();
  ctx.arc(0, r * 0.13, r * 0.08, 0, Math.PI * 2);
  ctx.fill();

  // Collar
  ctx.fillStyle = shade(robe, 40);
  ctx.beginPath();
  ctx.moveTo(-r * 0.28, -r * 0.22);
  ctx.lineTo(0, -r * 0.05);
  ctx.lineTo(r * 0.28, -r * 0.22);
  ctx.closePath();
  ctx.fill();

  // Head
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, -r * 0.45, r * 0.36, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Ears
  ctx.beginPath();
  ctx.arc(-r * 0.36, -r * 0.42, r * 0.08, 0, Math.PI * 2);
  ctx.arc(r * 0.36, -r * 0.42, r * 0.08, 0, Math.PI * 2);
  ctx.fill();

  // Eyes + brows
  ctx.fillStyle = '#2a1a10';
  ctx.beginPath();
  ctx.arc(-r * 0.12, -r * 0.48, r * 0.05, 0, Math.PI * 2);
  ctx.arc(r * 0.12, -r * 0.48, r * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3a2a20';
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.beginPath();
  ctx.moveTo(-r * 0.22, -r * 0.58);
  ctx.quadraticCurveTo(-r * 0.12, -r * 0.64, -r * 0.02, -r * 0.56);
  ctx.moveTo(r * 0.02, -r * 0.56);
  ctx.quadraticCurveTo(r * 0.12, -r * 0.64, r * 0.22, -r * 0.58);
  ctx.stroke();

  // Nose
  ctx.strokeStyle = shade(skin, -40);
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.48);
  ctx.lineTo(r * 0.04, -r * 0.36);
  ctx.stroke();

  drawBeard(ctx, 0, -r * 0.42, r * 0.36);
  drawHat(ctx, 0, -r * 0.5, r * 0.38, robe, trim);
}

function drawBeard(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const beard = ctx.createLinearGradient(x, y, x, y + r * 2);
  beard.addColorStop(0, '#f5f7fa');
  beard.addColorStop(1, '#b8c0c8');
  ctx.fillStyle = beard;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.lineWidth = Math.max(1, r / 12);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.9, y + r * 0.1);
  ctx.quadraticCurveTo(x - r * 0.95, y + r * 1.1, x - r * 0.35, y + r * 1.75);
  ctx.quadraticCurveTo(x, y + r * 2.05, x + r * 0.35, y + r * 1.75);
  ctx.quadraticCurveTo(x + r * 0.95, y + r * 1.1, x + r * 0.9, y + r * 0.1);
  ctx.quadraticCurveTo(x, y + r * 0.55, x - r * 0.9, y + r * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Mustache
  ctx.beginPath();
  ctx.moveTo(x - r * 0.45, y + r * 0.2);
  ctx.quadraticCurveTo(x, y + r * 0.45, x + r * 0.45, y + r * 0.2);
  ctx.quadraticCurveTo(x, y + r * 0.28, x - r * 0.45, y + r * 0.2);
  ctx.fill();

  // Strand lines
  ctx.strokeStyle = 'rgba(140, 150, 160, 0.55)';
  ctx.lineWidth = Math.max(0.8, r / 20);
  for (const sx of [-0.4, -0.15, 0.15, 0.4]) {
    ctx.beginPath();
    ctx.moveTo(x + sx * r, y + r * 0.5);
    ctx.quadraticCurveTo(x + sx * r * 1.1, y + r * 1.2, x + sx * r * 0.7, y + r * 1.7);
    ctx.stroke();
  }
}

function drawShield(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const w = r * 0.85;
  const h = r * 1.05;
  const face = ctx.createLinearGradient(x - w / 2, y - h / 2, x + w / 2, y + h / 2);
  face.addColorStop(0, shade(color, 35));
  face.addColorStop(1, shade(color, -25));
  ctx.fillStyle = face;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.lineWidth = Math.max(1.2, r / 14);
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y - h / 2);
  ctx.lineTo(x + w / 2, y - h / 2);
  ctx.lineTo(x + w / 2, y + h * 0.05);
  ctx.quadraticCurveTo(x + w / 2, y + h / 2, x, y + h * 0.58);
  ctx.quadraticCurveTo(x - w / 2, y + h / 2, x - w / 2, y + h * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Rim
  ctx.strokeStyle = shade(color, 50);
  ctx.lineWidth = Math.max(1, r / 18);
  ctx.beginPath();
  ctx.moveTo(x - w / 2 + 2, y - h / 2 + 2);
  ctx.lineTo(x + w / 2 - 2, y - h / 2 + 2);
  ctx.lineTo(x + w / 2 - 2, y + h * 0.05);
  ctx.quadraticCurveTo(x + w / 2 - 2, y + h / 2 - 2, x, y + h * 0.5);
  ctx.quadraticCurveTo(x - w / 2 + 2, y + h / 2 - 2, x - w / 2 + 2, y + h * 0.05);
  ctx.closePath();
  ctx.stroke();

  // Cross
  ctx.fillStyle = '#f4f1ea';
  ctx.fillRect(x - w * 0.08, y - h * 0.38, w * 0.16, h * 0.78);
  ctx.fillRect(x - w * 0.38, y - h * 0.1, w * 0.76, h * 0.16);
  // Boss
  ctx.fillStyle = '#d4af37';
  ctx.beginPath();
  ctx.arc(x, y + h * 0.02, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
}

function drawHat(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, star: string) {
  // Brim
  const brim = ctx.createLinearGradient(x, y - r, x, y);
  brim.addColorStop(0, shade(color, 20));
  brim.addColorStop(1, shade(color, -30));
  ctx.fillStyle = brim;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.lineWidth = Math.max(1, r / 12);
  ctx.beginPath();
  ctx.ellipse(x, y - r * 0.5, r * 1.45, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Cone
  ctx.fillStyle = shade(color, 10);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.85, y - r * 0.55);
  ctx.lineTo(x + r * 0.85, y - r * 0.55);
  ctx.quadraticCurveTo(x + r * 0.55, y - r * 1.6, x + r * 0.15, y - r * 2.35);
  ctx.quadraticCurveTo(x - r * 0.1, y - r * 1.7, x - r * 0.85, y - r * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Band
  ctx.fillStyle = star;
  ctx.beginPath();
  ctx.ellipse(x, y - r * 0.62, r * 0.9, r * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Buckle gem
  ctx.fillStyle = '#fff8c4';
  ctx.beginPath();
  ctx.arc(x, y - r * 0.62, r * 0.1, 0, Math.PI * 2);
  ctx.fill();

  // Stars
  ctx.fillStyle = star;
  for (const [sx, sy, s] of [
    [-0.2, -1.15, 0.16],
    [0.28, -1.65, 0.12],
    [0.05, -2.05, 0.09],
  ] as const) {
    drawStar(ctx, x + sx * r, y + sy * r, s * r);
  }
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
  ctx.fill();
}

function drawStaff(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  glow: string,
  swing: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(swing * 0.12);

  // Wood shaft with grain hint
  const wood = ctx.createLinearGradient(-2, 0, 2, 0);
  wood.addColorStop(0, '#8b5a2b');
  wood.addColorStop(0.5, '#6b4423');
  wood.addColorStop(1, '#4a2e14');
  ctx.strokeStyle = wood;
  ctx.lineWidth = Math.max(2.5, r / 6);
  ctx.beginPath();
  ctx.moveTo(0, r * 0.95);
  ctx.lineTo(0, -r * 1.05);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 220, 160, 0.25)';
  ctx.lineWidth = Math.max(1, r / 16);
  ctx.beginPath();
  ctx.moveTo(-r * 0.04, r * 0.7);
  ctx.lineTo(-r * 0.04, -r * 0.8);
  ctx.stroke();

  // Binding rings
  ctx.strokeStyle = '#c9a227';
  ctx.lineWidth = Math.max(1.5, r / 12);
  for (const ry of [-0.3, 0.2, 0.55]) {
    ctx.beginPath();
    ctx.ellipse(0, ry * r, r * 0.12, r * 0.05, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Crystal orb
  const orbY = -r * 1.25;
  ctx.fillStyle = glow;
  ctx.shadowColor = glow;
  ctx.shadowBlur = r * 0.9;
  ctx.beginPath();
  ctx.arc(0, orbY, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.beginPath();
  ctx.arc(-r * 0.08, orbY - r * 0.08, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.lineWidth = Math.max(1, r / 16);
  ctx.beginPath();
  ctx.arc(0, orbY, r * 0.28, 0, Math.PI * 2);
  ctx.stroke();

  // Prongs holding crystal
  ctx.strokeStyle = '#c9a227';
  ctx.lineWidth = Math.max(1.5, r / 14);
  ctx.beginPath();
  ctx.moveTo(-r * 0.18, -r * 1.0);
  ctx.lineTo(-r * 0.22, orbY);
  ctx.moveTo(r * 0.18, -r * 1.0);
  ctx.lineTo(r * 0.22, orbY);
  ctx.stroke();

  ctx.restore();
}
