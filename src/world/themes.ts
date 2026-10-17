export type RGB = [number, number, number];
export type TreeStyle = 'round' | 'pine' | 'palm' | 'cactus' | 'dead';

export interface IslandTheme {
  name: string;
  sand: RGB;
  dry: RGB;
  grass: RGB;
  forest: RGB;
  highland: RGB;
  rockLow: RGB;
  rockHigh: RGB;
  peak: RGB;
  tree: TreeStyle;
  treeColors: RGB[];
  treeDensity: number;
  /** Added to the moisture noise; positive means lusher. */
  moisture: number;
  snowyTrees?: boolean;
}

const temperate: IslandTheme = {
  name: 'Greenwood',
  sand: [214, 198, 142],
  dry: [168, 162, 96],
  grass: [94, 148, 60],
  forest: [44, 92, 44],
  highland: [112, 118, 82],
  rockLow: [118, 108, 98],
  rockHigh: [150, 144, 138],
  peak: [238, 240, 245],
  tree: 'round',
  treeColors: [
    [40, 95, 40],
    [55, 110, 45],
  ],
  treeDensity: 1,
  moisture: 0,
};

export const THEMES: IslandTheme[] = [
  temperate,
  {
    ...temperate,
    name: 'Pine Isle',
    dry: [120, 130, 80],
    grass: [78, 120, 62],
    forest: [34, 70, 44],
    tree: 'pine',
    treeColors: [
      [30, 70, 45],
      [38, 84, 52],
    ],
    treeDensity: 1.1,
    moisture: 0.1,
  },
  {
    ...temperate,
    name: 'Dune Isle',
    sand: [226, 206, 150],
    dry: [214, 186, 120],
    grass: [204, 178, 112],
    forest: [184, 160, 98],
    highland: [180, 150, 100],
    rockLow: [170, 130, 90],
    rockHigh: [190, 155, 115],
    peak: [210, 180, 140],
    tree: 'cactus',
    treeColors: [[80, 130, 70]],
    treeDensity: 0.12,
    moisture: -0.2,
  },
  {
    ...temperate,
    name: 'Palm Isle',
    sand: [240, 226, 170],
    dry: [140, 180, 70],
    grass: [80, 170, 60],
    forest: [30, 120, 50],
    highland: [90, 140, 70],
    tree: 'palm',
    treeColors: [
      [60, 150, 60],
      [80, 170, 60],
    ],
    treeDensity: 0.7,
    moisture: 0.05,
  },
  {
    ...temperate,
    name: 'Frost Isle',
    sand: [200, 205, 210],
    dry: [220, 226, 232],
    grass: [232, 238, 244],
    forest: [210, 220, 228],
    highland: [200, 210, 220],
    rockLow: [130, 140, 150],
    rockHigh: [170, 180, 190],
    peak: [250, 252, 255],
    tree: 'pine',
    treeColors: [[50, 80, 70]],
    treeDensity: 0.6,
    moisture: 0,
    snowyTrees: true,
  },
  {
    ...temperate,
    name: 'Ember Isle',
    sand: [70, 66, 64],
    dry: [90, 84, 78],
    grass: [80, 76, 72],
    forest: [60, 58, 56],
    highland: [70, 60, 56],
    rockLow: [50, 46, 46],
    rockHigh: [80, 60, 50],
    peak: [235, 95, 30],
    tree: 'dead',
    treeColors: [[70, 60, 50]],
    treeDensity: 0.25,
    moisture: 0,
  },
  {
    ...temperate,
    name: 'Amber Isle',
    dry: [190, 160, 90],
    grass: [170, 150, 70],
    forest: [150, 100, 50],
    highland: [140, 120, 80],
    treeColors: [
      [200, 90, 30],
      [220, 140, 40],
      [170, 50, 30],
    ],
  },
  {
    ...temperate,
    name: 'Blossom Isle',
    grass: [120, 170, 90],
    forest: [100, 150, 80],
    treeColors: [
      [240, 160, 200],
      [250, 190, 215],
      [225, 130, 180],
    ],
    treeDensity: 0.8,
  },
  {
    ...temperate,
    name: 'Mire Isle',
    sand: [120, 110, 80],
    dry: [100, 110, 60],
    grass: [80, 96, 50],
    forest: [56, 72, 40],
    highland: [90, 96, 70],
    treeColors: [
      [50, 70, 35],
      [65, 80, 40],
    ],
    treeDensity: 1.1,
    moisture: 0.2,
  },
  {
    ...temperate,
    name: 'Mesa Isle',
    sand: [220, 170, 120],
    dry: [200, 120, 70],
    grass: [190, 110, 60],
    forest: [170, 95, 55],
    highland: [160, 90, 60],
    rockLow: [150, 80, 55],
    rockHigh: [180, 110, 80],
    peak: [200, 140, 100],
    tree: 'cactus',
    treeColors: [[90, 120, 60]],
    treeDensity: 0.1,
    moisture: -0.2,
  },
];
