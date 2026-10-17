import type { Inventory, ResourceId } from '@/resources';

export type BuildingId = 'hut' | 'cottage' | 'stoneHouse' | 'crystalLodge' | 'emberKeep';

export interface BuildingDef {
  id: BuildingId;
  name: string;
  w: number;
  h: number;
  cost: Partial<Record<ResourceId, number>>;
  wall: string;
  roof: string;
  trim: string;
}

export const BUILDINGS: BuildingDef[] = [
  {
    id: 'hut',
    name: 'Hut',
    w: 36,
    h: 32,
    cost: { wood: 3 },
    wall: '#8d6339',
    roof: '#6b4423',
    trim: '#c4a574',
  },
  {
    id: 'cottage',
    name: 'Cottage',
    w: 48,
    h: 40,
    cost: { wood: 5, stone: 2 },
    wall: '#e8d9c0',
    roof: '#c0392b',
    trim: '#7a4a22',
  },
  {
    id: 'stoneHouse',
    name: 'Stone House',
    w: 52,
    h: 44,
    cost: { stone: 6, wood: 3 },
    wall: '#9aa3ad',
    roof: '#4a5560',
    trim: '#2f3a44',
  },
  {
    id: 'crystalLodge',
    name: 'Crystal Lodge',
    w: 48,
    h: 40,
    cost: { crystal: 4, wood: 3 },
    wall: '#dceef8',
    roof: '#5ec8e8',
    trim: '#7fe3ff',
  },
  {
    id: 'emberKeep',
    name: 'Ember Keep',
    w: 56,
    h: 48,
    cost: { obsidian: 4, stone: 4 },
    wall: '#3a3238',
    roof: '#c45a28',
    trim: '#ff8a3d',
  },
];

export const costList = (def: BuildingDef) =>
  (Object.entries(def.cost) as [ResourceId, number][]).filter(([, n]) => n > 0);

export const canAfford = (inventory: Inventory, def: BuildingDef) =>
  costList(def).every(([id, n]) => inventory[id] >= n);

export function spend(inventory: Inventory, def: BuildingDef) {
  for (const [id, n] of costList(def)) inventory[id] -= n;
}
