import type { CharacterId } from '@/characters';
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

const speed = (name: string, icon: string, color: string): Upgrade => ({
  id: 'speed',
  name,
  description: '+12% move speed',
  icon,
  color,
  apply: ({ player }) => (player.speed *= 1.12),
});

const life = (name: string, icon: string, color: string, max: number): Upgrade => ({
  id: 'life',
  name,
  description: '+1 life',
  icon,
  color,
  available: ({ player }) => player.maxLives < max,
  apply: ({ player }) => {
    player.maxLives++;
    player.lives++;
  },
});

const magnet = (name: string, icon: string, color: string): Upgrade => ({
  id: 'magnet',
  name,
  description: '+70 coin pull radius',
  icon,
  color,
  available: ({ player }) => player.magnet < 450,
  apply: ({ player }) => (player.magnet += 70),
});

const coinValue = (name: string, icon: string, color: string): Upgrade => ({
  id: 'coins',
  name,
  description: 'Coins worth +1 point',
  icon,
  color,
  available: ({ mods }) => mods.coinValue < 4,
  apply: ({ mods }) => mods.coinValue++,
});

const slow = (name: string, icon: string, color: string): Upgrade => ({
  id: 'slow',
  name,
  description: 'Enemies move 12% slower',
  icon,
  color,
  available: ({ mods }) => mods.enemySpeed > 0.5,
  apply: ({ mods }) => (mods.enemySpeed *= 0.88),
});

export const UPGRADES: Record<CharacterId, Upgrade[]> = {
  alien: [
    speed('Warp Drive', '➤', '#7bd66b'),
    {
      id: 'shrink',
      name: 'Shrink Ray',
      description: '-12% size, harder to hit',
      icon: '▾',
      color: '#a5d6a7',
      available: ({ player }) => player.w > 12,
      apply: ({ player }) => player.resize(player.w * 0.88),
    },
    {
      id: 'blink',
      name: 'Teleporter',
      description: 'Press Space to blink ahead',
      icon: '»',
      color: '#ff5cf0',
      available: ({ player }) => player.blinkRange === 0,
      apply: ({ player }) => (player.blinkRange = 160),
    },
    {
      id: 'blink-up',
      name: 'Quantum Coils',
      description: 'Blink: -0.6s cooldown, +40 range',
      icon: '⌁',
      color: '#ff5cf0',
      available: ({ player }) => player.blinkRange > 0 && player.blinkCooldown > 1.2,
      apply: ({ player }) => {
        player.blinkCooldown -= 0.6;
        player.blinkRange += 40;
      },
    },
    magnet('Tractor Beam', '◎', '#c7d2dc'),
    life('Spare Clone', '☻', '#7bd66b', 3),
    slow('Time Dilation', '◷', '#80deea'),
  ],
  knight: [
    life('Extra Heart', '♥', '#ef5350', 8),
    {
      id: 'shield',
      name: 'Long Shield',
      description: '+0.75s invulnerability after a hit',
      icon: '✦',
      color: '#2f5fa8',
      available: ({ player }) => player.invulnerableTime < 4,
      apply: ({ player }) => (player.invulnerableTime += 0.75),
    },
    {
      id: 'bash',
      name: 'Shield Bash',
      description: 'Destroy enemies you touch while invulnerable',
      icon: '✚',
      color: '#90a4ae',
      available: ({ player }) => !player.shieldBash,
      apply: ({ player }) => (player.shieldBash = true),
    },
    {
      id: 'regen',
      name: 'Second Wind',
      description: 'Regain 1 lost life every 25s',
      icon: '✙',
      color: '#66bb6a',
      available: ({ player }) => player.regenEvery === 0,
      apply: ({ player }) => (player.regenEvery = 25),
    },
    {
      id: 'regen-up',
      name: 'Vigor',
      description: 'Second Wind 5s faster',
      icon: '❤',
      color: '#66bb6a',
      available: ({ player }) => player.regenEvery > 10,
      apply: ({ player }) => (player.regenEvery -= 5),
    },
    speed('War Horse', '♞', '#bcaaa4'),
    coinValue('Royal Bounty', '♛', '#ffd54f'),
  ],
  wizard: [
    magnet('Greater Pull', '◎', '#ffd54f'),
    coinValue('Golden Touch', '$', '#ffb300'),
    slow('Frost Nova', '❄', '#80deea'),
    {
      id: 'fireball',
      name: 'Fireball',
      description: 'Auto-cast at nearby enemies every 3s',
      icon: '✹',
      color: '#ff7043',
      available: ({ player }) => player.fireballEvery === 0,
      apply: ({ player }) => (player.fireballEvery = 3),
    },
    {
      id: 'fireball-up',
      name: 'Pyromancy',
      description: 'Fireball 0.5s faster',
      icon: '♨',
      color: '#ff7043',
      available: ({ player }) => player.fireballEvery > 1,
      apply: ({ player }) => (player.fireballEvery -= 0.5),
    },
    speed('Haste', '✧', '#b39ddb'),
    life('Arcane Ward', '✦', '#9575cd', 3),
  ],
};

export function rollUpgrades(target: UpgradeTarget, count: number) {
  const pool = UPGRADES[target.player.character.id].filter((u) => u.available?.(target) ?? true);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
