import { createServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { BUILDINGS, canAfford, spend } from '../src/buildings';
import { CHARACTERS } from '../src/characters';
import { CONFIG } from '../src/config';
import {
  MAX_PLAYERS,
  type ClientAction,
  type ClientMsg,
  type GameStateSnap,
  type Inventory,
  type PlayerSnap,
  type ServerMsg,
} from '../src/net/protocol';
import { emptyInventory } from '../src/resources';
import { TROOPS, canAffordTroop, spendTroop } from '../src/troops';

const PORT = Number(process.env.PORT) || 3001;
const TICK_HZ = 20;
const FULL_DAY = CONFIG.dayNightPhase * 2;
const PVP_AFTER = CONFIG.pvpAfterFullDays * FULL_DAY;
const HIT_RANGE = 52;
const INVULN = 1.5;

interface NetPlayer {
  id: string;
  name: string;
  character: number;
  ws: WebSocket;
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

interface Room {
  code: string;
  hostId: string;
  players: Map<string, NetPlayer>;
  started: boolean;
  seed: number;
  tick: number;
  dayElapsed: number;
  coins: { id: number; x: number; y: number }[];
  resources: { id: number; x: number; y: number; type: string }[];
  houses: { id: number; building: string; x: number; y: number; ownerId: string }[];
  troops: {
    id: number;
    troop: string;
    x: number;
    y: number;
    ownerId: string;
    order: 'follow' | 'garrison';
  }[];
  nextCoinId: number;
  nextResId: number;
  nextHouseId: number;
  nextTroopId: number;
}

const rooms = new Map<string, Room>();
const socketRoom = new Map<WebSocket, string>();
const socketPlayer = new Map<WebSocket, string>();

function roomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function send(ws: WebSocket, msg: ServerMsg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(room: Room, msg: ServerMsg) {
  for (const p of room.players.values()) send(p.ws, msg);
}

function lobbyPayload(room: Room): ServerMsg {
  return {
    type: 'lobby',
    code: room.code,
    hostId: room.hostId,
    started: room.started,
    players: [...room.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      character: p.character,
    })),
  };
}

function snapshot(room: Room): GameStateSnap {
  const players: PlayerSnap[] = [...room.players.values()].map((p) => ({
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
    tick: room.tick,
    seed: room.seed,
    dayElapsed: room.dayElapsed,
    players,
    coins: room.coins,
    resources: room.resources as GameStateSnap['resources'],
    houses: room.houses as GameStateSnap['houses'],
    troops: room.troops as GameStateSnap['troops'],
  };
}

function spawnWorld(room: Room) {
  room.coins = [];
  room.resources = [];
  for (let i = 0; i < 40; i++) {
    room.coins.push({
      id: room.nextCoinId++,
      x: 400 + (i % 10) * 80,
      y: 400 + Math.floor(i / 10) * 80,
    });
  }
}

function handleAction(room: Room, player: NetPlayer, action: ClientAction) {
  if (action.kind === 'collectCoin') {
    const idx = room.coins.findIndex((c) => c.id === action.id);
    if (idx < 0) return;
    const c = room.coins[idx];
    if (Math.hypot(c.x - player.x, c.y - player.y) > 120) return;
    room.coins.splice(idx, 1);
    player.score += 1;
    return;
  }
  if (action.kind === 'collectResource') {
    const idx = room.resources.findIndex((r) => r.id === action.id);
    if (idx < 0) return;
    const r = room.resources[idx];
    if (Math.hypot(r.x - player.x, r.y - player.y) > 120) return;
    room.resources.splice(idx, 1);
    const type = r.type as keyof Inventory;
    if (type in player.inventory) player.inventory[type]++;
    return;
  }
  if (action.kind === 'build') {
    const def = BUILDINGS.find((b) => b.id === action.building);
    if (!def || !canAfford(player.inventory, def)) return;
    spend(player.inventory, def);
    room.houses.push({
      id: room.nextHouseId++,
      building: def.id,
      x: action.x,
      y: action.y,
      ownerId: player.id,
    });
    return;
  }
  if (action.kind === 'hire') {
    const def = TROOPS.find((t) => t.id === action.troop);
    if (!def || !canAffordTroop(player.inventory, def)) return;
    spendTroop(player.inventory, def);
    const hut = room.houses.find((h) => h.id === action.hutId);
    const x = (hut?.x ?? player.x) + 20;
    const y = (hut?.y ?? player.y) + 20;
    room.troops.push({
      id: room.nextTroopId++,
      troop: def.id,
      x,
      y,
      ownerId: player.id,
      order: 'follow',
    });
    return;
  }
  if (action.kind === 'garrison') {
    for (const t of room.troops) {
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

  if (action.kind === 'hit') {
    if (room.dayElapsed < PVP_AFTER || !player.alive) return;
    const target = room.players.get(action.targetId);
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

function makePlayer(
  id: string,
  name: string,
  character: number,
  ws: WebSocket,
): NetPlayer {
  const def = CHARACTERS[character] ?? CHARACTERS[0];
  return {
    id,
    name,
    character,
    ws,
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

function onMessage(ws: WebSocket, raw: string) {
  let msg: ClientMsg;
  try {
    msg = JSON.parse(raw) as ClientMsg;
  } catch {
    return;
  }

  if (msg.type === 'create') {
    let c = roomCode();
    while (rooms.has(c)) c = roomCode();
    const id = crypto.randomUUID();
    const player = makePlayer(id, msg.name, msg.character, ws);
    const room: Room = {
      code: c,
      hostId: id,
      players: new Map([[id, player]]),
      started: false,
      seed: 0,
      tick: 0,
      dayElapsed: 0,
      coins: [],
      resources: [],
      houses: [],
      troops: [],
      nextCoinId: 1,
      nextResId: 1,
      nextHouseId: 1,
      nextTroopId: 1,
    };
    rooms.set(c, room);
    socketRoom.set(ws, c);
    socketPlayer.set(ws, id);
    send(ws, { type: 'created', code: c, playerId: id });
    broadcast(room, lobbyPayload(room));
    return;
  }

  if (msg.type === 'join') {
    const room = rooms.get(msg.code.toUpperCase());
    if (!room) {
      send(ws, { type: 'error', message: 'Room not found' });
      return;
    }
    if (room.started) {
      send(ws, { type: 'error', message: 'Game already started' });
      return;
    }
    if (room.players.size >= MAX_PLAYERS) {
      send(ws, { type: 'error', message: 'Room full' });
      return;
    }
    const id = crypto.randomUUID();
    const player = makePlayer(id, msg.name, msg.character, ws);
    room.players.set(id, player);
    socketRoom.set(ws, room.code);
    socketPlayer.set(ws, id);
    send(ws, { type: 'joined', code: room.code, playerId: id, hostId: room.hostId });
    broadcast(room, lobbyPayload(room));
    return;
  }

  const code = socketRoom.get(ws);
  const playerId = socketPlayer.get(ws);
  if (!code || !playerId) return;
  const room = rooms.get(code);
  const player = room?.players.get(playerId);
  if (!room || !player) return;

  if (msg.type === 'start') {
    if (playerId !== room.hostId) {
      send(ws, { type: 'error', message: 'Only host can start' });
      return;
    }
    room.started = true;
    room.seed = Math.floor(Math.random() * 2 ** 31);
    spawnWorld(room);
    let i = 0;
    for (const p of room.players.values()) {
      p.x = 200 + i * 40;
      p.y = 200;
      i++;
    }
    for (const p of room.players.values()) {
      send(p.ws, {
        type: 'hello',
        code: room.code,
        playerId: p.id,
        seed: room.seed,
        hostId: room.hostId,
      });
    }
    broadcast(room, lobbyPayload(room));
    return;
  }

  if (msg.type === 'input') {
    player.ax = msg.ax;
    player.ay = msg.ay;
    return;
  }

  if (msg.type === 'pose') {
    player.x = msg.x;
    player.y = msg.y;
    player.facingX = msg.facingX;
    player.facingY = msg.facingY;
    return;
  }

  if (msg.type === 'action') {
    handleAction(room, player, msg.action);
  }
}

function onClose(ws: WebSocket) {
  const code = socketRoom.get(ws);
  const playerId = socketPlayer.get(ws);
  socketRoom.delete(ws);
  socketPlayer.delete(ws);
  if (!code || !playerId) return;
  const room = rooms.get(code);
  if (!room) return;
  room.players.delete(playerId);
  if (room.players.size === 0) {
    rooms.delete(code);
    return;
  }
  if (room.hostId === playerId) {
    room.hostId = [...room.players.keys()][0];
  }
  broadcast(room, lobbyPayload(room));
}

const httpServer = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('m-game multiplayer server\n');
});

const wss = new WebSocketServer({ server: httpServer });
wss.on('connection', (ws) => {
  ws.on('message', (data) => onMessage(ws, String(data)));
  ws.on('close', () => onClose(ws));
});

setInterval(() => {
  const dt = 1 / TICK_HZ;
  for (const room of rooms.values()) {
    if (!room.started) continue;
    room.tick++;
    room.dayElapsed += dt;
    for (const p of room.players.values()) {
      p.invuln = Math.max(0, p.invuln - dt);
      if (!p.alive) continue;
      p.x += p.ax * 260 * dt;
      p.y += p.ay * 260 * dt;
    }
    broadcast(room, { type: 'state', state: snapshot(room) });
  }
}, 1000 / TICK_HZ);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`m-game server listening on ws://0.0.0.0:${PORT} (LAN: ws://<your-ip>:${PORT})`);
});
