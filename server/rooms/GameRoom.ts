import { Room, Client, ServerError } from 'colyseus';
import {
  BUILDING_BY_ID,
  BUILDINGS,
  canAfford,
  findMansionCluster,
  mansionPlacement,
  spend,
  type BuildingId,
} from '../../src/buildings';
import { CHARACTERS } from '../../src/characters';
import {
  CHEST_COINS,
  CHEST_COUNT,
  CHEST_LOOT,
  CHEST_OPEN_RANGE,
  CHEST_SIZE,
} from '../../src/chests';
import { CONFIG } from '../../src/config';
import {
  MAX_PLAYERS,
  type ClientAction,
  type GameStateSnap,
  type Inventory,
  type PlayerSnap,
  type ServerMsg,
} from '../../src/net/protocol';
import {
  emptyInventory,
  FOODS,
  RESOURCES,
  rollResource,
  type ResourceId,
} from '../../src/resources';
import { TROOP_BY_ID, canAffordTroop, spendTroop } from '../../src/troops';
import { isKnownTradeDeal, tradeDealKey } from '../../src/villages';
import { mulberry32 } from '../../src/world/noise';

const TICK_HZ = 20;
const FULL_DAY = CONFIG.dayNightPhase * 2;
const PVP_AFTER = CONFIG.pvpAfterFullDays * FULL_DAY;
const HIT_RANGE = 52;
const INVULN = 1.5;
const BUILD_RANGE = 160;
const TRADE_STOCK = 8;

interface NetPlayer {
  id: string;
  name: string;
  character: number;
  x: number;
  y: number;
  facingX: number;
  facingY: number;
  score: number;
  inventory: Inventory;
  ax: number;
  ay: number;
  lives: number;
  maxLives: number;
  alive: boolean;
  invuln: number;
}

interface NetHouse {
  id: number;
  building: BuildingId;
  x: number;
  y: number;
  ownerId: string;
  produceTimer: number;
}

interface NetChest {
  id: number;
  x: number;
  y: number;
  opened: boolean;
}

interface JoinOptions {
  name?: string;
  character?: number;
}

function roomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function rectsOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export class GameRoom extends Room {
  maxClients = MAX_PLAYERS;
  /** Message-based sync — no Schema patches. */
  patchRate = null;

  private hostId = '';
  private started = false;
  private seed = 0;
  private tick = 0;
  private dayElapsed = 0;
  private players = new Map<string, NetPlayer>();
  private coins: { id: number; x: number; y: number }[] = [];
  private resources: { id: number; x: number; y: number; type: ResourceId }[] = [];
  private houses: NetHouse[] = [];
  private troops: {
    id: number;
    troop: string;
    x: number;
    y: number;
    ownerId: string;
    order: 'follow' | 'garrison';
  }[] = [];
  private chests: NetChest[] = [];
  private tradeStock = new Map<string, number>();
  private nextCoinId = 1;
  private nextResId = 1;
  private nextHouseId = 1;
  private nextTroopId = 1;
  private nextChestId = 1;
  private rand: () => number = Math.random;

  onCreate() {
    this.roomId = roomCode();

    this.onMessage('start', (client) => this.handleStart(client));
    this.onMessage('input', (client, msg: { ax?: number; ay?: number }) => {
      const player = this.players.get(client.sessionId);
      if (!player) return;
      player.ax = Number(msg?.ax) || 0;
      player.ay = Number(msg?.ay) || 0;
      if (player.ax || player.ay) {
        const len = Math.hypot(player.ax, player.ay) || 1;
        player.facingX = player.ax / len;
        player.facingY = player.ay / len;
      }
    });
    this.onMessage(
      'pose',
      (client, msg: { x?: number; y?: number; facingX?: number; facingY?: number }) => {
        const player = this.players.get(client.sessionId);
        if (!player || !player.alive) return;
        // Client pose is authoritative (client runs map collision). Clamp to world.
        if (typeof msg?.x === 'number' && Number.isFinite(msg.x)) {
          player.x = Math.min(CONFIG.world.width - 8, Math.max(0, msg.x));
        }
        if (typeof msg?.y === 'number' && Number.isFinite(msg.y)) {
          player.y = Math.min(CONFIG.world.height - 8, Math.max(0, msg.y));
        }
        if (typeof msg?.facingX === 'number' && Number.isFinite(msg.facingX)) player.facingX = msg.facingX;
        if (typeof msg?.facingY === 'number' && Number.isFinite(msg.facingY)) player.facingY = msg.facingY;
      },
    );
    this.onMessage('action', (client, action: ClientAction) => {
      const player = this.players.get(client.sessionId);
      if (!player || !action) return;
      this.handleAction(player, action);
    });

    this.setSimulationInterval((dt) => this.tickRoom(dt / 1000), 1000 / TICK_HZ);
  }

  onJoin(client: Client, options: JoinOptions = {}) {
    if (this.started) {
      throw new ServerError(4000, 'Game already started');
    }
    if (this.players.size >= MAX_PLAYERS) {
      throw new ServerError(4001, 'Room full');
    }

    const character = Math.max(0, Math.min(CHARACTERS.length - 1, Number(options.character) || 0));
    const name = String(options.name || `Player${Math.floor(Math.random() * 90 + 10)}`).slice(0, 16);
    const player = this.makePlayer(client.sessionId, name, character);
    this.players.set(client.sessionId, player);

    if (!this.hostId) this.hostId = client.sessionId;

    this.broadcastMsg(this.lobbyPayload());
  }

  async onLeave(client: Client) {
    this.players.delete(client.sessionId);
    if (this.players.size === 0) return;

    if (this.hostId === client.sessionId) {
      this.hostId = [...this.players.keys()][0];
    }
    if (!this.started) this.broadcastMsg(this.lobbyPayload());
  }

  private handleStart(client: Client) {
    if (client.sessionId !== this.hostId) {
      this.sendMsg(client, { type: 'error', message: 'Only host can start' });
      return;
    }
    if (this.started) return;

    this.started = true;
    this.lock();
    this.seed = Math.floor(Math.random() * 2 ** 31);
    this.rand = mulberry32(this.seed ^ 0xc0ffee);
    this.spawnWorld();

    let i = 0;
    for (const p of this.players.values()) {
      p.x = 200 + i * 40;
      p.y = 200;
      i++;
    }

    for (const c of this.clients) {
      this.sendMsg(c, {
        type: 'hello',
        code: this.roomId,
        playerId: c.sessionId,
        seed: this.seed,
        hostId: this.hostId,
      });
    }
    this.broadcastMsg(this.lobbyPayload());
  }

  private tickRoom(dt: number) {
    if (!this.started) return;
    this.tick++;
    this.dayElapsed += dt;
    for (const p of this.players.values()) {
      p.invuln = Math.max(0, p.invuln - dt);
    }
    this.tickProduction(dt);
    this.broadcastMsg({ type: 'state', state: this.snapshot() });
  }

  private tickProduction(dt: number) {
    for (const h of this.houses) {
      const def = BUILDING_BY_ID[h.building];
      const prod = def?.produces;
      if (!prod) continue;
      h.produceTimer += dt;
      while (h.produceTimer >= prod.every) {
        h.produceTimer -= prod.every;
        const owner = this.players.get(h.ownerId);
        if (!owner) continue;
        const amount = prod.amount ?? 1;
        owner.inventory[prod.resource] += amount;
      }
    }
  }

  private makePlayer(id: string, name: string, character: number): NetPlayer {
    const def = CHARACTERS[character] ?? CHARACTERS[0];
    return {
      id,
      name,
      character,
      x: 0,
      y: 0,
      facingX: 0,
      facingY: 1,
      score: 0,
      inventory: emptyInventory(),
      ax: 0,
      ay: 0,
      lives: def.lives,
      maxLives: def.lives,
      alive: true,
      invuln: 0,
    };
  }

  private lobbyPayload(): ServerMsg {
    return {
      type: 'lobby',
      code: this.roomId,
      hostId: this.hostId,
      started: this.started,
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        character: p.character,
      })),
    };
  }

  private snapshot(): GameStateSnap {
    const players: PlayerSnap[] = [...this.players.values()].map((p) => ({
      id: p.id,
      character: p.character,
      x: p.x,
      y: p.y,
      facingX: p.facingX,
      facingY: p.facingY,
      score: p.score,
      inventory: { ...p.inventory },
      name: p.name,
      lives: p.lives,
      alive: p.alive,
    }));
    return {
      tick: this.tick,
      seed: this.seed,
      dayElapsed: this.dayElapsed,
      players,
      coins: this.coins,
      resources: this.resources,
      houses: this.houses.map((h) => {
        const every = BUILDING_BY_ID[h.building]?.produces?.every;
        return {
          id: h.id,
          building: h.building,
          x: h.x,
          y: h.y,
          ownerId: h.ownerId,
          produceProgress: every ? Math.min(1, h.produceTimer / every) : undefined,
        };
      }),
      troops: this.troops as GameStateSnap['troops'],
      chests: this.chests,
    };
  }

  private spawnWorld() {
    this.coins = [];
    this.resources = [];
    this.chests = [];
    const { width, height } = CONFIG.world;
    const coinSize = CONFIG.coin.size;
    const resSize = CONFIG.resource.size;

    for (let i = 0; i < CONFIG.coin.count; i++) {
      this.coins.push({
        id: this.nextCoinId++,
        x: 80 + this.rand() * (width - 160 - coinSize),
        y: 80 + this.rand() * (height - 160 - coinSize),
      });
    }

    const themes = ['Greenwood', 'Pine Isle', 'Frost Isle', 'Ember Isle', 'Palm Isle'];
    for (let i = 0; i < CONFIG.resource.count; i++) {
      const theme = themes[i % themes.length];
      this.resources.push({
        id: this.nextResId++,
        x: 80 + this.rand() * (width - 160 - resSize),
        y: 80 + this.rand() * (height - 160 - resSize),
        type: rollResource(theme),
      });
    }

    // Far corners / edges for chests (clients refine onto land via their map).
    const anchors = [
      { x: width * 0.12, y: height * 0.18 },
      { x: width * 0.88, y: height * 0.22 },
      { x: width * 0.55, y: height * 0.85 },
    ];
    for (let i = 0; i < CHEST_COUNT; i++) {
      const a = anchors[i % anchors.length];
      this.chests.push({
        id: this.nextChestId++,
        x: a.x + (this.rand() - 0.5) * 120 - CHEST_SIZE / 2,
        y: a.y + (this.rand() - 0.5) * 120 - CHEST_SIZE / 2,
        opened: false,
      });
    }
  }

  private canPlaceBuilding(player: NetPlayer, building: BuildingId, x: number, y: number) {
    const def = BUILDING_BY_ID[building];
    if (!def || def.buildable === false) return false;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (x < 0 || y < 0 || x + def.w > CONFIG.world.width || y + def.h > CONFIG.world.height) return false;

    const cx = x + def.w / 2;
    const cy = y + def.h / 2;
    if (Math.hypot(cx - (player.x + 12), cy - (player.y + 12)) > BUILD_RANGE) return false;

    for (const h of this.houses) {
      const hd = BUILDING_BY_ID[h.building];
      if (rectsOverlap(x, y, def.w, def.h, h.x, h.y, hd.w, hd.h)) return false;
    }
    return true;
  }

  private handleAction(player: NetPlayer, action: ClientAction) {
    if (action.kind === 'collectCoin') {
      const idx = this.coins.findIndex((c) => c.id === action.id);
      if (idx < 0) return;
      const c = this.coins[idx];
      if (Math.hypot(c.x - player.x, c.y - player.y) > 120) return;
      this.coins.splice(idx, 1);
      player.score += 1;
      return;
    }
    if (action.kind === 'collectResource') {
      const idx = this.resources.findIndex((r) => r.id === action.id);
      if (idx < 0) return;
      const r = this.resources[idx];
      if (Math.hypot(r.x - player.x, r.y - player.y) > 120) return;
      this.resources.splice(idx, 1);
      if (r.type in player.inventory) player.inventory[r.type]++;
      return;
    }
    if (action.kind === 'build') {
      const def = BUILDINGS.find((b) => b.id === action.building);
      if (!def || def.buildable === false || !canAfford(player.inventory, def)) return;
      if (!this.canPlaceBuilding(player, def.id, action.x, action.y)) return;
      spend(player.inventory, def);
      this.houses.push({
        id: this.nextHouseId++,
        building: def.id,
        x: action.x,
        y: action.y,
        ownerId: player.id,
        produceTimer: 0,
      });
      this.tryMergeMansion(player.id, action.x + def.w / 2, action.y + def.h / 2);
      return;
    }
    if (action.kind === 'hire') {
      const def = TROOP_BY_ID[action.troop];
      if (!def || !canAffordTroop(player.inventory, def)) return;
      const hut = this.houses.find((h) => h.id === action.hutId && h.ownerId === player.id);
      const hutDef = hut ? BUILDING_BY_ID[hut.building] : undefined;
      if (!hut || !hutDef?.recruits?.includes(action.troop)) return;
      if (Math.hypot(hut.x - player.x, hut.y - player.y) > 160) return;
      spendTroop(player.inventory, def);
      const x = hut.x + hutDef.w / 2;
      const y = hut.y + hutDef.h / 2;
      this.troops.push({
        id: this.nextTroopId++,
        troop: def.id,
        x,
        y,
        ownerId: player.id,
        order: 'follow',
      });
      return;
    }
    if (action.kind === 'garrison') {
      for (const t of this.troops) {
        if (t.ownerId === player.id) t.order = action.station ? 'garrison' : 'follow';
      }
      return;
    }

    if (action.kind === 'trade') {
      const give = Object.entries(action.give) as [keyof Inventory, number][];
      const get = Object.entries(action.get) as [keyof Inventory, number][];
      if (give.length !== 1 || get.length !== 1) return;
      const [giveId, giveN] = give[0];
      const [getId, getN] = get[0];
      if (!RESOURCES.some((r) => r.id === giveId) || !RESOURCES.some((r) => r.id === getId)) return;
      if (!isKnownTradeDeal(giveId, giveN, getId, getN)) return;
      if (giveN <= 0 || getN <= 0) return;
      if (player.inventory[giveId] < giveN) return;
      const key = tradeDealKey(giveId, giveN, getId, getN);
      const stock = this.tradeStock.get(key) ?? TRADE_STOCK;
      if (stock <= 0) return;
      this.tradeStock.set(key, stock - 1);
      player.inventory[giveId] -= giveN;
      player.inventory[getId] += getN;
      return;
    }

    if (action.kind === 'eat') {
      if (!FOODS.some((f) => f.id === action.id)) return;
      if ((player.inventory[action.id] ?? 0) <= 0) return;
      player.inventory[action.id]--;
      return;
    }

    if (action.kind === 'openChest') {
      const chest = this.chests.find((c) => c.id === action.chestId);
      if (!chest || chest.opened) return;
      if (Math.hypot(chest.x - player.x, chest.y - player.y) > CHEST_OPEN_RANGE) return;
      chest.opened = true;
      const cx = chest.x + CHEST_SIZE / 2;
      const cy = chest.y + CHEST_SIZE / 2;
      CHEST_LOOT.forEach((type, i) => {
        const ang = (i / CHEST_LOOT.length) * Math.PI * 2 + 0.4;
        const dist = 34 + (i % 4) * 12;
        this.resources.push({
          id: this.nextResId++,
          x: cx + Math.cos(ang) * dist - CONFIG.resource.size / 2,
          y: cy + Math.sin(ang) * dist - CONFIG.resource.size / 2,
          type,
        });
      });
      for (let i = 0; i < CHEST_COINS; i++) {
        const ang = (i / CHEST_COINS) * Math.PI * 2;
        const dist = 22 + (i % 3) * 10;
        this.coins.push({
          id: this.nextCoinId++,
          x: cx + Math.cos(ang) * dist - CONFIG.coin.size / 2,
          y: cy + Math.sin(ang) * dist - CONFIG.coin.size / 2,
        });
      }
      return;
    }

    if (action.kind === 'syncLives') {
      const lives = Math.floor(action.lives);
      const maxLives = Math.floor(action.maxLives);
      if (!Number.isFinite(lives) || !Number.isFinite(maxLives)) return;
      if (maxLives < 1 || maxLives > 12 || lives < 0 || lives > maxLives) return;
      // Only allow increasing max (upgrades); lives may match the new max.
      if (maxLives < player.maxLives) return;
      if (maxLives > player.maxLives + 2) return;
      player.maxLives = maxLives;
      player.lives = Math.min(maxLives, Math.max(player.lives, lives));
      return;
    }

    if (action.kind === 'hit') {
      if (this.dayElapsed < PVP_AFTER || !player.alive) return;
      const target = this.players.get(action.targetId);
      if (!target || !target.alive || target.id === player.id || target.invuln > 0) return;
      const dx = target.x - player.x;
      const dy = target.y - player.y;
      if (Math.hypot(dx, dy) > HIT_RANGE) return;
      target.lives -= 1;
      target.invuln = INVULN;
      if (target.lives <= 0) {
        target.alive = false;
        target.lives = 0;
      }
    }
  }

  private tryMergeMansion(ownerId: string, nearX: number, nearY: number) {
    const footprints = this.houses.map((h) => {
      const def = BUILDING_BY_ID[h.building];
      return {
        x: h.x,
        y: h.y,
        w: def.w,
        h: def.h,
        building: h.building,
        ownerId: h.ownerId,
      };
    });
    const indices = findMansionCluster(footprints, ownerId, { x: nearX, y: nearY });
    if (!indices) return;

    const cluster = indices.map((i) => footprints[i]);
    const spot = mansionPlacement(cluster);
    const remove = new Set(indices);
    this.houses = this.houses.filter((_, i) => !remove.has(i));
    this.houses.push({
      id: this.nextHouseId++,
      building: 'mansion',
      x: spot.x,
      y: spot.y,
      ownerId,
      produceTimer: 0,
    });
  }

  private sendMsg(client: Client, msg: ServerMsg) {
    client.send('msg', msg);
  }

  private broadcastMsg(msg: ServerMsg) {
    this.broadcast('msg', msg);
  }
}
