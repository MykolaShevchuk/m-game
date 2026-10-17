import type { Inventory, ResourceId } from '@/resources';

export type TroopId = 'scout' | 'soldier' | 'guard';

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
    color: '#c4a574',
    accent: '#6b4423',
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
    color: '#7a8a9a',
    accent: '#2f5fa8',
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
    color: '#9aa3ad',
    accent: '#c0392b',
    attackEvery: 1.05,
    attackRange: 32,
    knockback: 38,
    stun: 0.22,
  },
];

export const troopCostList = (def: TroopDef) =>
  (Object.entries(def.cost) as [ResourceId, number][]).filter(([, n]) => n > 0);

export const canAffordTroop = (inventory: Inventory, def: TroopDef) =>
  troopCostList(def).every(([id, n]) => inventory[id] >= n);

export function spendTroop(inventory: Inventory, def: TroopDef) {
  for (const [id, n] of troopCostList(def)) inventory[id] -= n;
}
