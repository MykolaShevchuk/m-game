import type { ResourceId } from '@/resources';

export const CHEST_COUNT = 3;
export const CHEST_MIN_SPREAD = 700;
export const CHEST_COINS = 18;
export const CHEST_SIZE = 30;
export const CHEST_OPEN_RANGE = 100;

/** Resource piles spilled (or granted) when a chest opens. */
export const CHEST_LOOT: ResourceId[] = [
  'wood',
  'wood',
  'wood',
  'wood',
  'wood',
  'wood',
  'stone',
  'stone',
  'stone',
  'stone',
  'stone',
  'crystal',
  'crystal',
  'crystal',
  'obsidian',
  'obsidian',
  'berries',
  'berries',
  'berries',
  'berries',
  'shell',
  'shell',
  'cactusFruit',
  'bread',
  'bread',
];
