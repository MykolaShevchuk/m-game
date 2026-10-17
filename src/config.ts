export const CONFIG = {
  width: 960,
  height: 540,
  fixedStep: 1 / 60,
  player: { speed: 260, size: 24 },
  enemy: { minSpeed: 80, maxSpeed: 180, size: 20, spawnEvery: 1.5 },
  coin: { size: 12, count: 3 },
  colors: {
    bg: '#1a1d26',
    player: '#4fc3f7',
    enemy: '#ef5350',
    coin: '#ffd54f',
    text: '#eceff1',
  },
} as const;
