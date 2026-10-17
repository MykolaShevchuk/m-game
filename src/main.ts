import { Game } from '@/core/Game';
import { loadCharacter } from '@/core/storage';
import { CharacterSelectScene } from '@/scenes/CharacterSelectScene';
import { PlayScene } from '@/scenes/PlayScene';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const game = new Game(canvas);
const saved = loadCharacter();
game.scenes.switch(saved === null ? new CharacterSelectScene(game) : new PlayScene(game, saved));
game.start();
