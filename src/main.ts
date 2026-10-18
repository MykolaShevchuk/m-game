import { Game } from '@/core/Game';
import { MainMenuScene } from '@/scenes/MainMenuScene';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const game = new Game(canvas);
game.scenes.switch(new MainMenuScene(game));
game.start();
