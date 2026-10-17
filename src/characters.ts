export type CharacterId = 'scout' | 'knight' | 'mage';

export interface CharacterDef {
  id: CharacterId;
  name: string;
  description: string;
  perk: string;
  color: string;
  accent: string;
  speed: number;
  size: number;
  lives: number;
  /** Radius in px within which coins fly toward the player; 0 disables. */
  magnet: number;
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'scout',
    name: 'Scout',
    description: 'Quick and nimble ranger',
    perk: 'Fastest, smallest hitbox',
    color: '#5d8a3a',
    accent: '#2f4f1f',
    speed: 330,
    size: 20,
    lives: 1,
    magnet: 0,
  },
  {
    id: 'knight',
    name: 'Knight',
    description: 'Slow but armored warrior',
    perk: 'Survives 3 hits',
    color: '#9aa3ad',
    accent: '#2f5fa8',
    speed: 210,
    size: 26,
    lives: 3,
    magnet: 0,
  },
  {
    id: 'mage',
    name: 'Mage',
    description: 'Wielder of arcane pull',
    perk: 'Coins fly to you',
    color: '#6a4c9c',
    accent: '#ffd54f',
    speed: 260,
    size: 22,
    lives: 1,
    magnet: 110,
  },
];
