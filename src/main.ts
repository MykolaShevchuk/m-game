import { Game } from '@/core/Game';
import { ModeSelectScene } from '@/scenes/ModeSelectScene';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const game = new Game(canvas);
game.scenes.switch(new ModeSelectScene(game));
game.start();
