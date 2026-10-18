import type { Inventory, ResourceId } from '@/resources';
import type { TroopId } from '@/troops';

export type BuildingId =
  | 'hut'
  | 'cottage'
  | 'stoneHouse'
  | 'crystalLodge'
  | 'emberKeep'
  | 'barracks'
  | 'wall'
  | 'pillar'
  | 'mansion';

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
  /** When false, hidden from the build menu (formed by merging). */
  buildable?: boolean;
  /** Troop ids offered when interacting with this building. */
  recruits?: TroopId[];
  /** Troops can be ordered to station around this building. */
  garrison?: boolean;
  /** Passive resource drip while the building stands. */
  produces?: { resource: ResourceId; every: number; amount?: number };
  /** Buffs while the player stands nearby. */
  aura?: BuildingAura;
}

/** Max gap between house footprints to count as “next to each other”. */
export const MANSION_MERGE_GAP = 28;

export const BUILDINGS: BuildingDef[] = [
  {
    id: 'hut',
    name: 'Hut',
    w: 36,
    h: 32,
    cost: { wood: 6, stone: 1 },
    wall: '#7a5a38',
    roof: '#5a3e28',
    trim: '#a88b62',
    effect: 'recruits troops',
    recruits: ['scout', 'soldier', 'guard'],
  },
  {
    id: 'cottage',
    name: 'Cottage',
    w: 48,
    h: 40,
    cost: { wood: 9, stone: 4 },
    wall: '#d4c4a8',
    roof: '#8b3a32',
    trim: '#6a4428',
    effect: 'grows wood',
    produces: { resource: 'wood', every: 10, amount: 2 },
  },
  {
    id: 'stoneHouse',
    name: 'Stone House',
    w: 52,
    h: 44,
    cost: { stone: 10, wood: 4 },
    wall: '#8e949a',
    roof: '#4a5258',
    trim: '#3a4248',
    effect: 'quarries stone',
    produces: { resource: 'stone', every: 12, amount: 2 },
  },
  {
    id: 'crystalLodge',
    name: 'Crystal Lodge',
    w: 48,
    h: 40,
    cost: { crystal: 6, wood: 4, stone: 3 },
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
    cost: { obsidian: 6, stone: 7, wood: 3 },
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
    cost: { wood: 7, stone: 6 },
    wall: '#6a5844',
    roof: '#3a4638',
    trim: '#a08860',
    effect: 'stations troops',
    garrison: true,
  },
  {
    id: 'wall',
    name: 'Wall',
    w: 40,
    h: 22,
    cost: { stone: 3, wood: 1 },
    wall: '#8a9096',
    roof: '#6a7076',
    trim: '#4a5056',
    effect: 'blocks path',
  },
  {
    id: 'pillar',
    name: 'Pillar',
    w: 28,
    h: 52,
    cost: { stone: 6, wood: 3 },
    wall: '#9aa0a6',
    roof: '#6a7078',
    trim: '#5a4840',
    effect: 'hires archers',
    recruits: ['archer'],
  },
  {
    id: 'mansion',
    name: 'Mansion',
    w: 88,
    h: 72,
    cost: {},
    wall: '#c8b898',
    roof: '#5a3048',
    trim: '#8a6a40',
    effect: 'elite troops',
    buildable: false,
    recruits: ['knight', 'champion'],
    produces: { resource: 'crystal', every: 28 },
    aura: { range: 120, magnet: 40, coinBonus: 1 },
  },
];

/** Buildings the player can place from the build menu. */
export const BUILD_MENU = BUILDINGS.filter((b) => b.buildable !== false);

export const BUILDING_BY_ID = Object.fromEntries(BUILDINGS.map((b) => [b.id, b])) as Record<
  BuildingId,
  BuildingDef
>;

export const costList = (def: BuildingDef) =>
  (Object.entries(def.cost) as [ResourceId, number][]).filter(([, n]) => n > 0);

export const canAfford = (inventory: Inventory, def: BuildingDef) =>
  costList(def).every(([id, n]) => inventory[id] >= n);

export function spend(inventory: Inventory, def: BuildingDef) {
  for (const [id, n] of costList(def)) inventory[id] -= n;
}

/** Residential houses that can merge into a mansion (not walls, barracks, etc.). */
export function isMergeableHouse(id: BuildingId) {
  return (
    id === 'hut' ||
    id === 'cottage' ||
    id === 'stoneHouse' ||
    id === 'crystalLodge' ||
    id === 'emberKeep'
  );
}

export interface HouseFootprint {
  x: number;
  y: number;
  w: number;
  h: number;
  building: BuildingId;
  ownerId: string | number;
}

/** Gap between two AABBs (0 if they touch or overlap). */
function footprintGap(a: HouseFootprint, b: HouseFootprint) {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)));
  const dy = Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)));
  if (dx === 0 || dy === 0) return Math.max(dx, dy);
  return Math.hypot(dx, dy);
}

function adjacent(a: HouseFootprint, b: HouseFootprint, maxGap: number) {
  return footprintGap(a, b) <= maxGap;
}

/**
 * Find four mergeable houses owned by `ownerId` that sit next to each other.
 * Prefers a cluster near `near` (usually the house just placed).
 */
export function findMansionCluster(
  houses: HouseFootprint[],
  ownerId: string | number,
  near?: { x: number; y: number },
  maxGap = MANSION_MERGE_GAP,
): number[] | null {
  const candidates = houses
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => h.ownerId === ownerId && isMergeableHouse(h.building));
  if (candidates.length < 4) return null;

  const n = candidates.length;
  const adj: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (adjacent(candidates[i].h, candidates[j].h, maxGap)) {
        adj[i][j] = adj[j][i] = true;
      }
    }
  }

  let best: number[] | null = null;
  let bestDist = Infinity;

  const choose = (start: number, chosen: number[]) => {
    if (chosen.length === 4) {
      const seen = new Set<number>([chosen[0]]);
      const stack = [chosen[0]];
      while (stack.length) {
        const u = stack.pop()!;
        for (const v of chosen) {
          if (!seen.has(v) && adj[u][v]) {
            seen.add(v);
            stack.push(v);
          }
        }
      }
      if (seen.size < 4) return;

      let cx = 0;
      let cy = 0;
      for (const ci of chosen) {
        const h = candidates[ci].h;
        cx += h.x + h.w / 2;
        cy += h.y + h.h / 2;
      }
      cx /= 4;
      cy /= 4;
      const dist = near ? Math.hypot(cx - near.x, cy - near.y) : 0;
      if (dist < bestDist) {
        bestDist = dist;
        best = chosen.map((ci) => candidates[ci].i);
      }
      return;
    }
    for (let i = start; i < n; i++) choose(i + 1, [...chosen, i]);
  };
  choose(0, []);
  return best;
}

/** Top-left placement for a mansion centered on a cluster of footprints. */
export function mansionPlacement(cluster: HouseFootprint[]): { x: number; y: number } {
  const mansion = BUILDING_BY_ID.mansion;
  let cx = 0;
  let cy = 0;
  for (const h of cluster) {
    cx += h.x + h.w / 2;
    cy += h.y + h.h / 2;
  }
  cx /= cluster.length;
  cy /= cluster.length;
  return { x: cx - mansion.w / 2, y: cy - mansion.h / 2 };
}
