import { RESOURCE_BY_ID, type Inventory, type ResourceId } from '@/resources';
import type { IslandTheme } from '@/world/themes';

export const VILLAGE_W = 172;
export const VILLAGE_H = 132;
export const VILLAGE_TRADE_RANGE = 80;
export const VILLAGE_RESTOCK = 22;

export interface TradeOffer {
  giveId: ResourceId;
  giveN: number;
  getId: ResourceId;
  getN: number;
  stock: number;
  max: number;
}

export interface VillageHut {
  x: number;
  y: number;
  w: number;
  h: number;
  wall: string;
  roof: string;
  trim: string;
}

/** Collision boxes relative to the village origin. */
export const VILLAGE_HUTS: Omit<VillageHut, 'wall' | 'roof' | 'trim'>[] = [
  { x: 8, y: 6, w: 42, h: 36 },
  { x: 120, y: 10, w: 44, h: 38 },
  { x: 8, y: 86, w: 40, h: 34 },
];

export const VILLAGE_STALL = { x: 68, y: 50, w: 40, h: 30 };

const STOCK = 8;

const NAMES: Record<string, string> = {
  Greenwood: 'Greenwood Hamlet',
  'Pine Isle': 'Pine Camp',
  'Dune Isle': 'Dune Outpost',
  'Palm Isle': 'Palm Wharf',
  'Frost Isle': 'Frost Haven',
  'Ember Isle': 'Ember Forge',
  'Amber Isle': 'Amber Market',
  'Blossom Isle': 'Blossom Fair',
  'Mire Isle': 'Mire Dock',
  'Mesa Isle': 'Mesa Post',
};

type Deal = [ResourceId, number, ResourceId, number];

const DEALS: Record<string, Deal[]> = {
  Greenwood: [
    ['wood', 3, 'stone', 1],
    ['berries', 4, 'crystal', 1],
    ['wood', 2, 'berries', 1],
  ],
  'Pine Isle': [
    ['wood', 3, 'stone', 1],
    ['wood', 4, 'crystal', 1],
    ['stone', 3, 'berries', 2],
  ],
  'Dune Isle': [
    ['cactusFruit', 3, 'wood', 1],
    ['cactusFruit', 2, 'stone', 1],
    ['cactusFruit', 4, 'shell', 1],
  ],
  'Palm Isle': [
    ['shell', 3, 'wood', 1],
    ['shell', 2, 'berries', 1],
    ['shell', 4, 'crystal', 1],
  ],
  'Frost Isle': [
    ['crystal', 1, 'wood', 2],
    ['crystal', 1, 'stone', 2],
    ['crystal', 2, 'obsidian', 1],
  ],
  'Ember Isle': [
    ['obsidian', 1, 'stone', 2],
    ['obsidian', 1, 'crystal', 1],
    ['obsidian', 2, 'wood', 3],
  ],
  'Amber Isle': [
    ['wood', 3, 'stone', 1],
    ['berries', 4, 'crystal', 1],
    ['wood', 4, 'obsidian', 1],
  ],
  'Blossom Isle': [
    ['berries', 3, 'wood', 1],
    ['berries', 4, 'crystal', 1],
    ['berries', 5, 'shell', 1],
  ],
  'Mire Isle': [
    ['wood', 3, 'stone', 1],
    ['berries', 3, 'wood', 1],
    ['wood', 5, 'crystal', 1],
  ],
  'Mesa Isle': [
    ['stone', 3, 'wood', 1],
    ['cactusFruit', 3, 'obsidian', 1],
    ['stone', 4, 'crystal', 1],
  ],
};

const FALLBACK: Deal[] = [
  ['wood', 3, 'stone', 1],
  ['stone', 3, 'wood', 1],
  ['berries', 4, 'crystal', 1],
];

export function villageName(theme: IslandTheme) {
  return NAMES[theme.name] ?? `${theme.name} Village`;
}

export function makeOffers(theme: IslandTheme): TradeOffer[] {
  const deals = DEALS[theme.name] ?? FALLBACK;
  return deals.map(([giveId, giveN, getId, getN]) => ({
    giveId,
    giveN,
    getId,
    getN,
    stock: STOCK,
    max: STOCK,
  }));
}

export function canAffordOffer(inventory: Inventory, offer: TradeOffer) {
  return inventory[offer.giveId] >= offer.giveN && offer.stock > 0;
}

export function applyOffer(inventory: Inventory, offer: TradeOffer) {
  inventory[offer.giveId] -= offer.giveN;
  inventory[offer.getId] += offer.getN;
  offer.stock -= 1;
}

export function offerLabel(offer: TradeOffer) {
  const give = RESOURCE_BY_ID[offer.giveId].name;
  const get = RESOURCE_BY_ID[offer.getId].name;
  return `${offer.giveN} ${give} → ${offer.getN} ${get}`;
}

export function rgbCss(c: [number, number, number], k = 1) {
  return `rgb(${Math.round(c[0] * k)}, ${Math.round(c[1] * k)}, ${Math.round(c[2] * k)})`;
}

export function hutColors(theme: IslandTheme): Pick<VillageHut, 'wall' | 'roof' | 'trim'> {
  return {
    wall: rgbCss(theme.sand, 0.88),
    roof: rgbCss(theme.forest, 0.78),
    trim: rgbCss(theme.rockLow, 0.85),
  };
}
