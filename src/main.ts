import { Game } from '@/core/Game';
import { MenuScene } from '@/scenes/MenuScene';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const game = new Game(canvas);
game.scenes.switch(new MenuScene(game));
game.start();
