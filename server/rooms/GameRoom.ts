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
import { CONFIG } from '../../src/config';
import {
  MAX_PLAYERS,
  type ClientAction,
  type GameStateSnap,
  type Inventory,
  type PlayerSnap,
  type ServerMsg,
} from '../../src/net/protocol';
import { emptyInventory, FOODS } from '../../src/resources';
import { TROOP_BY_ID, canAffordTroop, spendTroop } from '../../src/troops';

const TICK_HZ = 20;
const FULL_DAY = CONFIG.dayNightPhase * 2;
const PVP_AFTER = CONFIG.pvpAfterFullDays * FULL_DAY;
const HIT_RANGE = 52;
const INVULN = 1.5;

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
  alive: boolean;
  invuln: number;
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
  private resources: { id: number; x: number; y: number; type: string }[] = [];
  private houses: { id: number; building: BuildingId; x: number; y: number; ownerId: string }[] = [];
  private troops: {
    id: number;
    troop: string;
    x: number;
    y: number;
    ownerId: string;
    order: 'follow' | 'garrison';
  }[] = [];
  private nextCoinId = 1;
  private nextHouseId = 1;
  private nextTroopId = 1;

  onCreate() {
    this.roomId = roomCode();

    this.onMessage('start', (client) => this.handleStart(client));
    this.onMessage('input', (client, msg: { ax?: number; ay?: number }) => {
      const player = this.players.get(client.sessionId);
      if (!player) return;
      player.ax = Number(msg?.ax) || 0;
      player.ay = Number(msg?.ay) || 0;
    });
    this.onMessage(
      'pose',
      (client, msg: { x?: number; y?: number; facingX?: number; facingY?: number }) => {
        const player = this.players.get(client.sessionId);
        if (!player) return;
        if (typeof msg?.x === 'number') player.x = msg.x;
        if (typeof msg?.y === 'number') player.y = msg.y;
        if (typeof msg?.facingX === 'number') player.facingX = msg.facingX;
        if (typeof msg?.facingY === 'number') player.facingY = msg.facingY;
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
      if (!p.alive) continue;
      p.x += p.ax * 260 * dt;
      p.y += p.ay * 260 * dt;
    }
    this.broadcastMsg({ type: 'state', state: this.snapshot() });
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
      resources: this.resources as GameStateSnap['resources'],
      houses: this.houses as GameStateSnap['houses'],
      troops: this.troops as GameStateSnap['troops'],
    };
  }

  private spawnWorld() {
    this.coins = [];
    this.resources = [];
    for (let i = 0; i < 40; i++) {
      this.coins.push({
        id: this.nextCoinId++,
        x: 400 + (i % 10) * 80,
        y: 400 + Math.floor(i / 10) * 80,
      });
    }
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
      const type = r.type as keyof Inventory;
      if (type in player.inventory) player.inventory[type]++;
      return;
    }
    if (action.kind === 'build') {
      const def = BUILDINGS.find((b) => b.id === action.building);
      if (!def || def.buildable === false || !canAfford(player.inventory, def)) return;
      spend(player.inventory, def);
      this.houses.push({
        id: this.nextHouseId++,
        building: def.id,
        x: action.x,
        y: action.y,
        ownerId: player.id,
      });
      this.tryMergeMansion(player.id, action.x + def.w / 2, action.y + def.h / 2);
      return;
    }
    if (action.kind === 'hire') {
      const def = TROOP_BY_ID[action.troop];
      if (!def || !canAffordTroop(player.inventory, def)) return;
      const hut = this.houses.find((h) => h.id === action.hutId);
      const hutDef = hut ? BUILDING_BY_ID[hut.building] : undefined;
      if (!hutDef?.recruits?.includes(action.troop)) return;
      spendTroop(player.inventory, def);
      const x = (hut?.x ?? player.x) + 20;
      const y = (hut?.y ?? player.y) + 20;
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
    }

    if (action.kind === 'trade') {
      const give = Object.entries(action.give) as [keyof Inventory, number][];
      const get = Object.entries(action.get) as [keyof Inventory, number][];
      if (give.some(([id, n]) => n <= 0 || !(id in player.inventory) || player.inventory[id] < n)) return;
      if (get.some(([id, n]) => n <= 0 || !(id in player.inventory))) return;
      for (const [id, n] of give) player.inventory[id] -= n;
      for (const [id, n] of get) player.inventory[id] += n;
      return;
    }

    if (action.kind === 'eat') {
      if (!FOODS.some((f) => f.id === action.id)) return;
      if ((player.inventory[action.id] ?? 0) <= 0) return;
      player.inventory[action.id]--;
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
    });
  }

  private sendMsg(client: Client, msg: ServerMsg) {
    client.send('msg', msg);
  }

  private broadcastMsg(msg: ServerMsg) {
    this.broadcast('msg', msg);
  }
}
