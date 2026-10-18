import { CHARACTERS } from '@/characters';

const KEY = 'm-game:highscore';
const CHARACTER_KEY = 'm-game:character';
const TUTORIAL_KEY = 'm-game:tutorial';
const MUSIC_KEY = 'm-game:music';

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

export const loadTutorialDone = () => localStorage.getItem(TUTORIAL_KEY) === '1';

export const saveTutorialDone = () => {
  localStorage.setItem(TUTORIAL_KEY, '1');
};

/** Music enabled by default. */
export const loadMusicEnabled = () => localStorage.getItem(MUSIC_KEY) !== '0';

export const saveMusicEnabled = (on: boolean) => {
  localStorage.setItem(MUSIC_KEY, on ? '1' : '0');
};
