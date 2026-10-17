import type { BuildingId } from '@/buildings';
import type { Inventory, ResourceId } from '@/resources';

export type { Inventory };
import type { TroopId } from '@/troops';

/** WebSocket URL for the multiplayer server (same host as the page, port 3001). */
export function defaultWsUrl(port = 3001): string {
  if (typeof window === 'undefined') return `ws://localhost:${port}`;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname || 'localhost';
  return `${proto}//${host}:${port}`;
}

export const MAX_PLAYERS = 4;

export interface PlayerSnap {
  id: string;
  character: number;
  x: number;
  y: number;
  facingX: number;
  facingY: number;
  score: number;
  inventory: Inventory;
  name: string;
  lives: number;
  alive: boolean;
}

export interface HouseSnap {
  id: number;
  building: BuildingId;
  x: number;
  y: number;
  ownerId: string;
}

export interface TroopSnap {
  id: number;
  troop: TroopId;
  x: number;
  y: number;
  ownerId: string;
  order: 'follow' | 'garrison';
}

export interface CoinSnap {
  id: number;
  x: number;
  y: number;
}

export interface ResourceSnap {
  id: number;
  x: number;
  y: number;
  type: ResourceId;
}

export interface GameStateSnap {
  tick: number;
  seed: number;
  dayElapsed: number;
  players: PlayerSnap[];
  coins: CoinSnap[];
  resources: ResourceSnap[];
  houses: HouseSnap[];
  troops: TroopSnap[];
}

export type ClientMsg =
  | { type: 'create'; name: string; character: number }
  | { type: 'join'; code: string; name: string; character: number }
  | { type: 'start' }
  | { type: 'input'; ax: number; ay: number; interact: boolean; build: boolean; blink: boolean }
  | { type: 'pose'; x: number; y: number; facingX: number; facingY: number }
  | { type: 'action'; action: ClientAction };

export type ClientAction =
  | { kind: 'collectCoin'; id: number }
  | { kind: 'collectResource'; id: number }
  | { kind: 'build'; building: BuildingId; x: number; y: number }
  | { kind: 'hire'; troop: TroopId; hutId: number }
  | { kind: 'garrison'; station: boolean }
  | { kind: 'menuNav'; menu: 'build' | 'recruit' | 'none' }
  | { kind: 'hit'; targetId: string };

export type ServerMsg =
  | { type: 'error'; message: string }
  | { type: 'created'; code: string; playerId: string }
  | { type: 'joined'; code: string; playerId: string; hostId: string }
  | { type: 'lobby'; code: string; hostId: string; players: { id: string; name: string; character: number }[]; started: boolean }
  | { type: 'hello'; code: string; playerId: string; seed: number; hostId: string }
  | { type: 'state'; state: GameStateSnap };
