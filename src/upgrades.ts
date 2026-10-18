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
  available: ({ player }) => player.speed < player.character.speed * 1.55,
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
  description: '+70 loot pull radius',
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

const swiftStrikes = (name: string, icon: string, color: string): Upgrade => ({
  id: 'swift',
  name,
  description: 'Attacks 18% faster',
  icon,
  color,
  available: ({ player }) => player.combatCdMul > 0.55,
  apply: ({ player }) => (player.combatCdMul *= 0.82),
});

const reach = (name: string, icon: string, color: string, extra: number): Upgrade => ({
  id: 'reach',
  name,
  description: `+${extra} attack range`,
  icon,
  color,
  available: ({ player }) => player.combatRange < 80,
  apply: ({ player }) => (player.combatRange += extra),
});

const scavenger = (name: string, icon: string, color: string): Upgrade => ({
  id: 'scavenge',
  name,
  description: '25% chance of +1 extra resource',
  icon,
  color,
  available: ({ player }) => player.resourceLuck < 0.5,
  apply: ({ player }) => (player.resourceLuck += 0.25),
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
    swiftStrikes('Phase Jab', '⚡', '#80deea'),
    reach('Needle Range', '↗', '#b2ff59', 14),
    {
      id: 'lunge',
      name: 'Plasma Lunge',
      description: '+14 strike lunge',
      icon: '➤',
      color: '#c6ff00',
      available: ({ player }) => player.combatLunge < 28,
      apply: ({ player }) => (player.combatLunge += 14),
    },
    scavenger('Scavenger', '✦', '#cfd8dc'),
    {
      id: 'afterimage',
      name: 'Afterimage',
      description: '+0.4s invulnerability after a hit',
      icon: '◌',
      color: '#ea80fc',
      available: ({ player }) => player.invulnerableTime < 3.2,
      apply: ({ player }) => (player.invulnerableTime += 0.4),
    },
    coinValue('Star Dust', '★', '#ffd54f'),
    {
      id: 'blink-iframe',
      name: 'Phase Exit',
      description: 'Blinking grants 0.45s i-frames',
      icon: '◌',
      color: '#ff80ab',
      available: ({ player }) => player.blinkRange > 0 && player.blinkIframes < 0.4,
      apply: ({ player }) => {
        player.blinkIframes = 0.45;
      },
    },
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
      description: 'While invulnerable, bumping a foe hits them',
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
    {
      id: 'sweep',
      name: 'Wide Sweep',
      description: 'Strike in a wider arc',
      icon: '☾',
      color: '#90caf9',
      available: ({ player }) => player.combatCone < 0.5,
      apply: ({ player }) => (player.combatCone += 0.25),
    },
    reach('Longsword', '⚔', '#eceff1', 16),
    {
      id: 'crush',
      name: 'Crushing Blow',
      description: '+16 knockback, +0.1s stun',
      icon: '⚒',
      color: '#ff8a65',
      available: ({ player }) => player.combatKnock < 36,
      apply: ({ player }) => {
        player.combatKnock += 16;
        player.combatStun += 0.1;
      },
    },
    swiftStrikes('Quick Guard', '⚡', '#b0bec5'),
    {
      id: 'rally',
      name: 'Rally',
      description: 'Your troops attack 20% faster',
      icon: '⚑',
      color: '#ffcc80',
      available: ({ player }) => player.troopAtkMul > 0.6,
      apply: ({ player }) => (player.troopAtkMul *= 0.8),
    },
    magnet('War Horn', '◎', '#d7ccc8'),
    scavenger('Forager', '✤', '#aed581'),
  ],
  wizard: [
    magnet('Greater Pull', '◎', '#ffd54f'),
    coinValue('Golden Touch', '$', '#ffb300'),
    {
      id: 'frost',
      name: 'Frost Nova',
      description: 'Bolts stun +0.12s and knock farther',
      icon: '❄',
      color: '#80deea',
      available: ({ player }) => player.combatStun < 0.28,
      apply: ({ player }) => {
        player.combatStun += 0.12;
        player.combatKnock += 12;
      },
    },
    {
      id: 'fireball',
      name: 'Fireball',
      description: 'Auto-cast a bolt at the nearest foe every 3s',
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
      available: ({ player }) => player.fireballEvery > 1.2,
      apply: ({ player }) => (player.fireballEvery -= 0.5),
    },
    speed('Haste', '✧', '#b39ddb'),
    life('Arcane Ward', '✦', '#9575cd', 3),
    reach('Long Cast', '☄', '#ce93d8', 70),
    {
      id: 'twin',
      name: 'Twin Spark',
      description: 'Fire an extra bolt at an angle',
      icon: '✴',
      color: '#ea80fc',
      available: ({ player }) => player.boltExtra < 2,
      apply: ({ player }) => (player.boltExtra += 1),
    },
    swiftStrikes('Quick Incant', '⚡', '#b39ddb'),
    {
      id: 'mana-font',
      name: 'Mana Font',
      description: 'Regain 1 lost life every 28s',
      icon: '✙',
      color: '#81d4fa',
      available: ({ player }) => player.regenEvery === 0,
      apply: ({ player }) => (player.regenEvery = 28),
    },
    {
      id: 'overchannel',
      name: 'Overchannel',
      description: 'Bolts knock +14 and stun longer',
      icon: '☢',
      color: '#ffab40',
      available: ({ player }) => player.combatKnock < 40,
      apply: ({ player }) => {
        player.combatKnock += 14;
        player.combatStun += 0.08;
      },
    },
    scavenger('Familiar', '☽', '#fff59d'),
    {
      id: 'ward-up',
      name: 'Mirror Ward',
      description: '+0.5s invulnerability after a hit',
      icon: '◈',
      color: '#9575cd',
      available: ({ player }) => player.invulnerableTime < 3.5,
      apply: ({ player }) => (player.invulnerableTime += 0.5),
    },
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
