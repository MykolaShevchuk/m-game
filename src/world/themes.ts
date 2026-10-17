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

/** Earthy temperate baseline — muted greens and warm sand. */
const temperate: IslandTheme = {
  name: 'Greenwood',
  sand: [196, 178, 132],
  dry: [148, 140, 92],
  grass: [86, 118, 62],
  forest: [48, 78, 46],
  highland: [102, 104, 78],
  rockLow: [112, 104, 96],
  rockHigh: [138, 132, 126],
  peak: [228, 230, 234],
  tree: 'round',
  treeColors: [
    [42, 78, 44],
    [56, 92, 48],
  ],
  treeDensity: 1,
  moisture: 0,
};

export const THEMES: IslandTheme[] = [
  temperate,
  {
    ...temperate,
    name: 'Pine Isle',
    dry: [112, 118, 78],
    grass: [72, 102, 58],
    forest: [38, 62, 42],
    tree: 'pine',
    treeColors: [
      [36, 64, 42],
      [44, 74, 48],
    ],
    treeDensity: 1.1,
    moisture: 0.1,
  },
  {
    ...temperate,
    name: 'Dune Isle',
    sand: [210, 188, 142],
    dry: [198, 170, 118],
    grass: [186, 162, 108],
    forest: [168, 146, 96],
    highland: [164, 138, 98],
    rockLow: [156, 122, 88],
    rockHigh: [172, 142, 108],
    peak: [198, 172, 138],
    tree: 'cactus',
    treeColors: [[72, 108, 64]],
    treeDensity: 0.12,
    moisture: -0.2,
  },
  {
    ...temperate,
    name: 'Palm Isle',
    sand: [218, 202, 158],
    dry: [128, 148, 78],
    grass: [78, 132, 68],
    forest: [42, 96, 52],
    highland: [88, 122, 72],
    tree: 'palm',
    treeColors: [
      [52, 118, 56],
      [68, 132, 58],
    ],
    treeDensity: 0.7,
    moisture: 0.05,
  },
  {
    ...temperate,
    name: 'Frost Isle',
    sand: [210, 220, 228],
    dry: [228, 234, 240],
    grass: [236, 242, 248],
    forest: [218, 228, 236],
    highland: [200, 212, 224],
    rockLow: [132, 146, 162],
    rockHigh: [188, 200, 214],
    peak: [248, 250, 255],
    tree: 'pine',
    treeColors: [
      [36, 58, 48],
      [44, 68, 54],
    ],
    treeDensity: 0.75,
    moisture: -0.05,
    snowyTrees: true,
  },
  {
    ...temperate,
    name: 'Ember Isle',
    sand: [78, 72, 68],
    dry: [92, 84, 78],
    grass: [82, 76, 72],
    forest: [64, 60, 56],
    highland: [74, 64, 58],
    rockLow: [58, 52, 50],
    rockHigh: [88, 68, 56],
    peak: [168, 78, 42],
    tree: 'dead',
    treeColors: [[68, 58, 48]],
    treeDensity: 0.25,
    moisture: 0,
  },
  {
    ...temperate,
    name: 'Amber Isle',
    dry: [168, 138, 82],
    grass: [142, 128, 68],
    forest: [118, 88, 52],
    highland: [122, 104, 72],
    treeColors: [
      [148, 82, 42],
      [162, 108, 48],
      [128, 64, 40],
    ],
  },
  {
    ...temperate,
    name: 'Blossom Isle',
    grass: [102, 132, 78],
    forest: [78, 112, 68],
    treeColors: [
      [176, 118, 138],
      [186, 138, 152],
      [158, 98, 122],
    ],
    treeDensity: 0.8,
  },
  {
    ...temperate,
    name: 'Mire Isle',
    sand: [118, 108, 82],
    dry: [98, 104, 64],
    grass: [74, 88, 52],
    forest: [52, 66, 42],
    highland: [86, 90, 68],
    treeColors: [
      [48, 64, 38],
      [58, 72, 42],
    ],
    treeDensity: 1.1,
    moisture: 0.2,
  },
  {
    ...temperate,
    name: 'Mesa Isle',
    sand: [198, 156, 112],
    dry: [178, 118, 78],
    grass: [168, 108, 68],
    forest: [148, 92, 58],
    highland: [142, 88, 62],
    rockLow: [132, 78, 56],
    rockHigh: [158, 102, 74],
    peak: [178, 128, 96],
    tree: 'cactus',
    treeColors: [[78, 102, 58]],
    treeDensity: 0.1,
    moisture: -0.2,
  },
];
