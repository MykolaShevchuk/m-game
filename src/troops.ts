import type { Inventory, ResourceId } from '@/resources';

export type TroopId = 'scout' | 'soldier' | 'guard' | 'archer' | 'knight' | 'champion';

export interface TroopDef {
  id: TroopId;
  name: string;
  description: string;
  cost: Partial<Record<ResourceId, number>>;
  size: number;
  speed: number;
  color: string;
  accent: string;
  attackEvery: number;
  attackRange: number;
  knockback: number;
  stun: number;
}

export const TROOPS: TroopDef[] = [
  {
    id: 'scout',
    name: 'Scout',
    description: 'Quick jabs',
    cost: { wood: 2 },
    size: 14,
    speed: 300,
    color: '#a89068',
    accent: '#5a4030',
    attackEvery: 0.45,
    attackRange: 30,
    knockback: 14,
    stun: 0,
  },
  {
    id: 'soldier',
    name: 'Soldier',
    description: 'Solid strikes',
    cost: { wood: 3, stone: 1 },
    size: 16,
    speed: 240,
    color: '#7a8288',
    accent: '#4a5868',
    attackEvery: 0.7,
    attackRange: 34,
    knockback: 24,
    stun: 0.08,
  },
  {
    id: 'guard',
    name: 'Guard',
    description: 'Slow, stunning blows',
    cost: { wood: 2, stone: 3 },
    size: 18,
    speed: 200,
    color: '#8a9094',
    accent: '#8a4840',
    attackEvery: 1.05,
    attackRange: 32,
    knockback: 38,
    stun: 0.22,
  },
  {
    id: 'archer',
    name: 'Archer',
    description: 'Long-range shots',
    cost: { wood: 3, stone: 2 },
    size: 15,
    speed: 220,
    color: '#7a6a58',
    accent: '#4a6a48',
    attackEvery: 0.85,
    attackRange: 110,
    knockback: 18,
    stun: 0.04,
  },
  {
    id: 'knight',
    name: 'Knight',
    description: 'Heavy armored blows',
    cost: { wood: 4, stone: 4, crystal: 2 },
    size: 20,
    speed: 210,
    color: '#6a7888',
    accent: '#c0a050',
    attackEvery: 0.85,
    attackRange: 38,
    knockback: 48,
    stun: 0.28,
  },
  {
    id: 'champion',
    name: 'Champion',
    description: 'Crushing power',
    cost: { wood: 3, stone: 3, crystal: 2, obsidian: 3 },
    size: 22,
    speed: 190,
    color: '#5a4058',
    accent: '#d07040',
    attackEvery: 1.0,
    attackRange: 40,
    knockback: 58,
    stun: 0.35,
  },
];

export const TROOP_BY_ID = Object.fromEntries(TROOPS.map((t) => [t.id, t])) as Record<TroopId, TroopDef>;

export const troopsFor = (ids: TroopId[]) => ids.map((id) => TROOP_BY_ID[id]);

export const troopCostList = (def: TroopDef) =>
  (Object.entries(def.cost) as [ResourceId, number][]).filter(([, n]) => n > 0);

export const canAffordTroop = (inventory: Inventory, def: TroopDef) =>
  troopCostList(def).every(([id, n]) => inventory[id] >= n);

export function spendTroop(inventory: Inventory, def: TroopDef) {
  for (const [id, n] of troopCostList(def)) inventory[id] -= n;
}
