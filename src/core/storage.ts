const KEY = 'm-game:highscore';

export const loadHighScore = () => Number(localStorage.getItem(KEY) ?? 0);

export const saveHighScore = (score: number) => {
  if (score > loadHighScore()) localStorage.setItem(KEY, String(score));
};
