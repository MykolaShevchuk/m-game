import type { Player } from '@/entities/Player';

export interface RunModifiers {
  coinValue: number;
  enemySpeed: number;
}

export interface UpgradeTarget {
  player: Player;
  mods: RunModifiers;
}

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  available?(t: UpgradeTarget): boolean;
  apply(t: UpgradeTarget): void;
}

export const UPGRADES: Upgrade[] = [
  {
    id: 'speed',
    name: 'Swift Boots',
    description: '+12% move speed',
    icon: '➤',
    color: '#4fc3f7',
    apply: ({ player }) => (player.speed *= 1.12),
  },
  {
    id: 'heart',
    name: 'Extra Heart',
    description: '+1 life',
    icon: '♥',
    color: '#ef5350',
    available: ({ player }) => player.lives < 6,
    apply: ({ player }) => player.lives++,
  },
  {
    id: 'magnet',
    name: 'Coin Magnet',
    description: '+60 coin pull radius',
    icon: '◎',
    color: '#ffd54f',
    available: ({ player }) => player.magnet < 400,
    apply: ({ player }) => (player.magnet += 60),
  },
  {
    id: 'shrink',
    name: 'Shrink',
    description: '-12% size, harder to hit',
    icon: '▾',
    color: '#81c784',
    available: ({ player }) => player.w > 14,
    apply: ({ player }) => player.resize(player.w * 0.88),
  },
  {
    id: 'shield',
    name: 'Long Shield',
    description: '+0.75s invulnerability after a hit',
    icon: '✦',
    color: '#b39ddb',
    available: ({ player }) => player.lives > 1 && player.invulnerableTime < 4,
    apply: ({ player }) => (player.invulnerableTime += 0.75),
  },
  {
    id: 'coins',
    name: 'Golden Touch',
    description: 'Coins worth +1 point',
    icon: '$',
    color: '#ffb300',
    available: ({ mods }) => mods.coinValue < 4,
    apply: ({ mods }) => mods.coinValue++,
  },
  {
    id: 'slow',
    name: 'Frost Aura',
    description: 'Enemies move 12% slower',
    icon: '❄',
    color: '#80deea',
    available: ({ mods }) => mods.enemySpeed > 0.5,
    apply: ({ mods }) => (mods.enemySpeed *= 0.88),
  },
];

export function rollUpgrades(target: UpgradeTarget, count: number) {
  const pool = UPGRADES.filter((u) => u.available?.(target) ?? true);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
