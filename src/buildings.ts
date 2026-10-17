import type { Inventory, ResourceId } from '@/resources';

export type BuildingId = 'hut' | 'cottage' | 'stoneHouse' | 'crystalLodge' | 'emberKeep' | 'barracks';

export interface BuildingAura {
  /** Distance from building center where the aura applies. */
  range: number;
  /** Extra pickup pull radius while standing in range. */
  magnet?: number;
  /** Extra score per coin collected while in range. */
  coinBonus?: number;
}

export interface BuildingDef {
  id: BuildingId;
  name: string;
  w: number;
  h: number;
  cost: Partial<Record<ResourceId, number>>;
  wall: string;
  roof: string;
  trim: string;
  /** Short label shown in the build menu. */
  effect: string;
  /** Opens a troop shop when the player stands nearby. */
  recruits?: boolean;
  /** Troops can be ordered to station around this building. */
  garrison?: boolean;
  /** Passive resource drip while the building stands. */
  produces?: { resource: ResourceId; every: number };
  /** Buffs while the player stands nearby. */
  aura?: BuildingAura;
}

export const BUILDINGS: BuildingDef[] = [
  {
    id: 'hut',
    name: 'Hut',
    w: 36,
    h: 32,
    cost: { wood: 8, stone: 2 },
    wall: '#7a5a38',
    roof: '#5a3e28',
    trim: '#a88b62',
    effect: 'recruits troops',
    recruits: true,
  },
  {
    id: 'cottage',
    name: 'Cottage',
    w: 48,
    h: 40,
    cost: { wood: 12, stone: 5 },
    wall: '#d4c4a8',
    roof: '#8b3a32',
    trim: '#6a4428',
    effect: 'grows wood',
    produces: { resource: 'wood', every: 18 },
  },
  {
    id: 'stoneHouse',
    name: 'Stone House',
    w: 52,
    h: 44,
    cost: { stone: 14, wood: 6 },
    wall: '#8e949a',
    roof: '#4a5258',
    trim: '#3a4248',
    effect: 'quarries stone',
    produces: { resource: 'stone', every: 24 },
  },
  {
    id: 'crystalLodge',
    name: 'Crystal Lodge',
    w: 48,
    h: 40,
    cost: { crystal: 8, wood: 6, stone: 4 },
    wall: '#c8d4dc',
    roof: '#6a8fa0',
    trim: '#8eb0c0',
    effect: 'pulls loot nearby',
    aura: { range: 100, magnet: 110 },
  },
  {
    id: 'emberKeep',
    name: 'Ember Keep',
    w: 56,
    h: 48,
    cost: { obsidian: 8, stone: 10, wood: 4 },
    wall: '#3e383c',
    roof: '#8a4a28',
    trim: '#b06a38',
    effect: 'rich coins nearby',
    aura: { range: 110, coinBonus: 1 },
  },
  {
    id: 'barracks',
    name: 'Barracks',
    w: 54,
    h: 46,
    cost: { wood: 10, stone: 8 },
    wall: '#6a5844',
    roof: '#3a4638',
    trim: '#a08860',
    effect: 'stations troops',
    garrison: true,
  },
];
export const costList = (def: BuildingDef) =>
  (Object.entries(def.cost) as [ResourceId, number][]).filter(([, n]) => n > 0);

export const canAfford = (inventory: Inventory, def: BuildingDef) =>
  costList(def).every(([id, n]) => inventory[id] >= n);

export function spend(inventory: Inventory, def: BuildingDef) {
  for (const [id, n] of costList(def)) inventory[id] -= n;
}
