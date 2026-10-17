import { CHARACTERS } from '@/characters';

const KEY = 'm-game:highscore';
const CHARACTER_KEY = 'm-game:character';

export const loadHighScore = () => Number(localStorage.getItem(KEY) ?? 0);

export const saveHighScore = (score: number) => {
  if (score > loadHighScore()) localStorage.setItem(KEY, String(score));
};

/** Saved index into CHARACTERS, or null if none or invalid. */
export const loadCharacter = (): number | null => {
  const raw = localStorage.getItem(CHARACTER_KEY);
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const index = Number(raw);
  return index < CHARACTERS.length ? index : null;
};

export const saveCharacter = (index: number) => {
  localStorage.setItem(CHARACTER_KEY, String(index));
};
