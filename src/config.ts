export const CONFIG = {
  width: 960,
  height: 540,
  fixedStep: 1 / 60,
  world: {
    width: 2560,
    height: 1600,
    cell: 4,
    /** Elevation thresholds (0..1) separating terrain bands. */
    levels: { deep: 0.3, shallow: 0.4, beach: 0.425, rock: 0.72, cliff: 0.78, snow: 0.84 },
  },
  coin: { size: 12, count: 25 },
  upgradeEvery: 30,
  minimap: { width: 200, margin: 12 },
  colors: {
    bg: '#1a1d26',
    player: '#4fc3f7',
    coin: '#ffd54f',
    text: '#eceff1',
  },
} as const;
