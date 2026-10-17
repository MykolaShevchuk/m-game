# m-game

A simple browser game built with TypeScript, HTML5 Canvas and Vite. No game engine, no runtime dependencies.

## Run

```bash
npm install
npm run dev       # dev server with hot reload
npm run build     # type-check + production build into dist/
npm run preview   # serve the production build
```

Controls: WASD / arrow keys to move, P / Esc to pause, Enter to start.

## Structure

```
index.html            Canvas host page
public/assets/        Static files (sprites, sounds), served at /assets/...
src/
  main.ts             Entry point: creates Game, opens the first scene
  config.ts           All tunable numbers and colors in one place
  core/
    Game.ts           Canvas setup + fixed-timestep game loop
    Scene.ts          Scene interface + SceneManager (switch/update/render)
    Input.ts          Keyboard state: isDown, wasPressed, axis()
    math.ts           Rect, clamp, rand, AABB overlap
    storage.ts        High score in localStorage
  entities/
    Entity.ts         Base class: position, size, alive flag
    Player.ts / Enemy.ts / Coin.ts
  scenes/
    MenuScene.ts      Title screen
    PlayScene.ts      Gameplay: spawning, collisions, score
    GameOverScene.ts  Result + restart
  ui/
    text.ts           Canvas text helper
```

## How it fits together

1. `Game` runs `requestAnimationFrame`, calls `update(dt)` at a fixed 60 Hz and `render(ctx)` once per frame.
2. `SceneManager` forwards those calls to the active scene. Change screens with `game.scenes.switch(new SomeScene(game))`.
3. Scenes own their entities and handle game rules (spawning, collisions, scoring).
4. Entities only know how to update and draw themselves.

## Extending

- **New entity**: extend `Entity`, implement `update` and `render`, add it to a scene's list.
- **New screen**: implement `Scene`, switch to it from another scene.
- **Sprites**: put images in `public/assets/`, load with `new Image()` and draw with `ctx.drawImage`.
- **Sound**: `new Audio('/assets/hit.wav').play()`, or the Web Audio API for many overlapping sounds.
- **Mouse/touch**: add `pointerdown`/`pointermove` listeners to `Input`.
- **Deploy**: `npm run build` and upload `dist/` to any static host (Vercel, Netlify, GitHub Pages).
