export type CharacterId = 'alien' | 'knight' | 'wizard';

export interface CharacterDef {
  id: CharacterId;
  name: string;
  description: string;
  perk: string;
  color: string;
  accent: string;
  speed: number;
  /** Body / hurtbox size — used for movement, blocking, and taking hits. */
  size: number;
  /** Pickup box size; defaults to `size` when omitted. Alien uses a larger one. */
  collectSize?: number;
  lives: number;
  /** Radius in px within which coins fly toward the player; 0 disables. */
  magnet: number;
  combat: {
    style: 'slash' | 'bolt';
    cooldown: number;
    range: number;
    /** Half-angle of the melee arc, in radians. */
    cone: number;
    knockback: number;
    lunge: number;
    stun: number;
  };
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'alien',
    name: 'Alien',
    description: 'Speedy visitor from beyond',
    perk: 'Big grab, tiny hurtbox',
    color: '#6a7a58',
    accent: '#8a9094',
    speed: 190,
    size: 20,
    collectSize: 40,
    lives: 3,
    magnet: 0,
    combat: { style: 'slash', cooldown: 0.28, range: 50, cone: 0.7, knockback: 26, lunge: 20, stun: 0 },
  },
  {
    id: 'knight',
    name: 'Knight',
    description: 'Slow but armored warrior',
    perk: 'Survives 5 hits',
    color: '#8a8e8a',
    accent: '#4a5a68',
    speed: 120,
    size: 26,
    lives: 5,
    magnet: 0,
    combat: { style: 'slash', cooldown: 0.55, range: 64, cone: 1.05, knockback: 46, lunge: 10, stun: 0.12 },
  },
  {
    id: 'wizard',
    name: 'Wizard',
    description: 'Old master of arcane pull',
    perk: 'Coins fly to you',
    color: '#5a4e62',
    accent: '#a89050',
    speed: 150,
    size: 22,
    lives: 3,
    magnet: 110,
    combat: { style: 'bolt', cooldown: 0.65, range: 280, cone: 0.2, knockback: 34, lunge: 0, stun: 0.08 },
  },
];
