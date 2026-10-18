export const CONFIG = {
  width: 960,
  height: 540,
  fixedStep: 1 / 60,
  world: {
    width: 5600,
    height: 3600,
    cell: 4,
    chunk: 512,
    islands: 10,
    /** Elevation thresholds (0..1) separating terrain bands. */
    levels: { deep: 0.3, shallow: 0.4, beach: 0.425, rock: 0.72, cliff: 0.78, snow: 0.84 },
  },
  coin: { size: 12, count: 60 },
  resource: { size: 18, count: 40, /** Seconds between each respawn when below the count. */ respawnEvery: 5 },
  upgradeEvery: 20,
  /** Hunger drains from full to empty over `duration` seconds. */
  hunger: { duration: 120, minSpeed: 0.42, berry: 0.34, cactus: 0.34, bread: 0.58 },
  /** Seconds for each day or night phase. */
  dayNightPhase: 3 * 60,
  /** Full day+night cycles before players can fight each other. */
  pvpAfterFullDays: 2,
  minimap: { width: 280, margin: 12 },
  colors: {
    bg: '#1c2228',
    player: '#4a90a8',
    coin: '#c9a227',
    text: '#e6e8ea',
  },
} as const;
