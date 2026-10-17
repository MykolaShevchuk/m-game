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
  characters.ts       Playable characters: stats and perks
  core/
    Game.ts           Canvas setup + fixed-timestep game loop
    Camera.ts         Smooth follow camera, clamped to the world
    Scene.ts          Scene interface + SceneManager (switch/update/render)
    Input.ts          Keyboard state: isDown, wasPressed, axis()
    math.ts           Rect, clamp, rand, AABB overlap
    storage.ts        High score in localStorage
  entities/
    Entity.ts         Base class: position, size, alive flag
    Player.ts / Enemy.ts / Coin.ts
  scenes/
    CharacterSelectScene.ts  Title + pick Scout, Knight or Mage
    PlayScene.ts      Gameplay: spawning, collisions, score
    GameOverScene.ts  Result + restart
  world/
    noise.ts          Seeded value noise + fBm
    WorldMap.ts       Island generation, terrain colors, hillshade, trees/rocks, walkability
  ui/
    text.ts           Canvas text helper
    drawCharacter.ts  Procedural character art (used in select screen and in game)
    minimap.ts        Overview map with camera frame, player and coins
```

## The map

Each game generates a new island from a random seed. Elevation comes from fractal noise mixed with a falloff that sinks the borders into the sea; a second noise layer controls moisture (dry grass → grassland → forest). Terrain bands are set by `CONFIG.world.levels`: water and anything above `cliff` is impassable. The terrain is painted once into an offscreen canvas and the camera draws only the visible part each frame.

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
