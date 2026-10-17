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
  upgrades.ts         Per-character upgrade pools offered every CONFIG.upgradeEvery points
  resources.ts        Collectible resource types and per-island-theme spawn weights
  core/
    Game.ts           Canvas setup + fixed-timestep game loop
    Camera.ts         Smooth follow camera, clamped to the world
    Scene.ts          Scene interface + SceneManager (switch/update/render)
    Input.ts          Keyboard state: isDown, wasPressed, axis()
    math.ts           Rect, clamp, rand, AABB overlap
    storage.ts        High score in localStorage
  entities/
    Entity.ts         Base class: position, size, alive flag
    Player.ts / Coin.ts
    Resource.ts       Resource pickup (wood, stone, crystal...) lying on an island
  scenes/
    CharacterSelectScene.ts  Title + pick Alien, Knight or Wizard
    PlayScene.ts      Gameplay: spawning, collisions, score
    GameOverScene.ts  Result + restart
  world/
    noise.ts          Seeded value noise + fBm
    themes.ts         The 10 island themes: palettes and tree styles
    WorldMap.ts       Archipelago generation, bridges, hillshade, props, walkability, chunked drawing
  ui/
    text.ts           Canvas text helper
    drawCharacter.ts  Procedural character art (used in select screen and in game)
    drawResource.ts   Procedural resource icons
    inventory.ts      Bottom-left inventory bar with resource counts
    popups.ts         Floating "+1 Wood" labels
    minimap.ts        Overview map with camera frame, player and coins
    UpgradePicker.ts  "Level up" overlay: pick 1 of 3 upgrades
```

## The map

Each game generates a new archipelago of `CONFIG.world.islands` (10) islands from a random seed. Island centres are scattered with a minimum spacing; elevation is fractal noise shaped by a domain-warped falloff around each centre, so coastlines get bays and peninsulas. Every island gets a theme from `src/world/themes.ts` (Greenwood, Pine, Dune, Palm, Frost, Ember, Amber, Blossom, Mire, Mesa) with its own palette and tree style.

Wooden bridges follow a minimum spanning tree over the island centres (plus two extra links), so every island is reachable. Coins only spawn on land connected to the start island. Terrain bands are set by `CONFIG.world.levels`: water and anything above `cliff` is impassable.

The world is too large for one canvas, so it is drawn in 512 px chunks rendered on demand and kept in a small LRU cache.

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
