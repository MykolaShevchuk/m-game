import { Game } from '@/core/Game';
import { CharacterSelectScene } from '@/scenes/CharacterSelectScene';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const game = new Game(canvas);
game.scenes.switch(new CharacterSelectScene(game));
game.start();
