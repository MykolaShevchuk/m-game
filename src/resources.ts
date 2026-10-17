export type ResourceId = 'wood' | 'stone' | 'berries' | 'cactusFruit' | 'shell' | 'crystal' | 'obsidian';

export interface ResourceDef {
  id: ResourceId;
  name: string;
  /** Used for the minimap dot and the pickup popup. */
  color: string;
}

export const RESOURCES: ResourceDef[] = [
  { id: 'wood', name: 'Wood', color: '#a1704a' },
  { id: 'stone', name: 'Stone', color: '#9ea4ab' },
  { id: 'berries', name: 'Berries', color: '#d64561' },
  { id: 'cactusFruit', name: 'Cactus Fruit', color: '#e05aa8' },
  { id: 'shell', name: 'Shell', color: '#f4c9b0' },
  { id: 'crystal', name: 'Crystal', color: '#7fe3ff' },
  { id: 'obsidian', name: 'Obsidian', color: '#9b7cd6' },
];

export const RESOURCE_BY_ID = Object.fromEntries(RESOURCES.map((r) => [r.id, r])) as Record<ResourceId, ResourceDef>;

type Weights = Partial<Record<ResourceId, number>>;

const DEFAULT_WEIGHTS: Weights = { wood: 4, berries: 2, stone: 2 };

/** Spawn weights keyed by island theme name. */
const THEME_WEIGHTS: Record<string, Weights> = {
  Greenwood: { wood: 5, berries: 3, stone: 2 },
  'Pine Isle': { wood: 6, stone: 2, berries: 1 },
  'Dune Isle': { cactusFruit: 5, stone: 2 },
  'Palm Isle': { shell: 5, wood: 2, berries: 1, stone: 1 },
  'Frost Isle': { crystal: 5, stone: 3 },
  'Ember Isle': { obsidian: 5, stone: 3 },
  'Amber Isle': { wood: 5, berries: 2, stone: 2 },
  'Blossom Isle': { berries: 5, wood: 2, stone: 1 },
  'Mire Isle': { wood: 3, berries: 3, stone: 1 },
  'Mesa Isle': { stone: 4, cactusFruit: 3, obsidian: 1 },
};

export function rollResource(themeName: string): ResourceId {
  const weights = Object.entries(THEME_WEIGHTS[themeName] ?? DEFAULT_WEIGHTS) as [ResourceId, number][];
  let roll = Math.random() * weights.reduce((sum, [, w]) => sum + w, 0);
  for (const [id, w] of weights) {
    roll -= w;
    if (roll < 0) return id;
  }
  return weights[0][0];
}

export type Inventory = Record<ResourceId, number>;

export const emptyInventory = () => Object.fromEntries(RESOURCES.map((r) => [r.id, 0])) as Inventory;
