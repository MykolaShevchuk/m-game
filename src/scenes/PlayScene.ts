import { BUILDINGS, canAfford, spend, type BuildingDef } from '@/buildings';
import { CHARACTERS } from '@/characters';
import { CONFIG } from '@/config';
import { Camera } from '@/core/Camera';
import type { Game } from '@/core/Game';
import type { PlayerControls, PlayerSlot } from '@/core/Input';
import { overlaps, type Rect } from '@/core/math';
import type { Scene } from '@/core/Scene';
import { Bolt } from '@/entities/Bolt';
import { Coin } from '@/entities/Coin';
import { House } from '@/entities/House';
import { Player } from '@/entities/Player';
import { Resource } from '@/entities/Resource';
import { Troop } from '@/entities/Troop';
import type { NetClient } from '@/net/NetClient';
import type { GameStateSnap, ServerMsg } from '@/net/protocol';
import { grantReward, QuestTracker, rewardList, type QuestDef } from '@/quests';
import { emptyInventory, RESOURCE_BY_ID, rollResource, type Inventory } from '@/resources';
import { TROOPS, canAffordTroop, spendTroop } from '@/troops';
import { buildMenuCards, drawBuildMenu } from '@/ui/buildMenu';
import { drawHouse } from '@/ui/drawHouse';
import { pointIn } from '@/ui/hit';
import { drawInventory, inventoryHeight } from '@/ui/inventory';
import { drawMinimap } from '@/ui/minimap';
import { Popups } from '@/ui/popups';
import { drawQuestPanel } from '@/ui/questPanel';
import { drawText } from '@/ui/text';
import { drawTouchControls, touchBottomPad, touchLayout } from '@/ui/touchControls';
import { drawTroopMenu, troopMenuCards } from '@/ui/troopMenu';
import { UpgradePicker } from '@/ui/UpgradePicker';
import { rollUpgrades, type RunModifiers, type Upgrade } from '@/upgrades';
import { DayNight, formatClock } from '@/world/dayNight';
import { WorldMap } from '@/world/WorldMap';
import { GameOverScene } from './GameOverScene';
import { ModeSelectScene } from './ModeSelectScene';

const MAGNET_SPEED = 320;
const BANNER_TIME = 2.5;
const PLACE_GAP = 18;
/** Must clear the largest building half-size + place gap. */
const INTERACT_RANGE = 88;
const BOLT_SPEED = 460;

interface Agent {
  id: number;
  netId?: string;
  player: Player;
  camera: Camera;
  controls: PlayerControls;
  inventory: Inventory;
  score: number;
  building: boolean;
  recruiting: boolean;
  selectedBuilding: number;
  selectedTroop: number;
  mods: RunModifiers;
  nextUpgradeAt: number;
  picker: UpgradePicker | null;
  upgradesTaken: Upgrade[];
  currentIsland: number;
  visited: Set<number>;
  quests: QuestTracker;
  /** When true, movement comes from network snapshots. */
  remote: boolean;
}

export interface PlaySceneOptions {
  characters: number[];
  splitScreen?: boolean;
  seed?: number;
  net?: NetClient;
  localNetId?: string;
}

export class PlayScene implements Scene {
  private map: WorldMap;
  private agents: Agent[] = [];
  private coins: Coin[] = [];
  private resources: Resource[] = [];
  private popups = new Popups();
  private paused = false;
  private banner = { text: '', time: 0 };
  private houses: House[] = [];
  private troops: Troop[] = [];
  private dayNight = new DayNight();
  private resourceSpawnTimer = 0;
  private splitScreen: boolean;
  private net: NetClient | null;
  private localNetId: string | null;
  private menuOwner: Agent | null = null;
  private netStatus = '';
  private touchLayout = touchLayout(CONFIG.width, CONFIG.height);
  private combatEnded = false;
  private endTimer = 0;
  private bolts: Bolt[] = [];
  private swings: { x: number; y: number; angle: number; range: number; cone: number; color: string; age: number; life: number }[] = [];

  constructor(
    private game: Game,
    options: PlaySceneOptions | number,
  ) {
    const opts: PlaySceneOptions =
      typeof options === 'number' ? { characters: [options], splitScreen: false } : options;
    this.splitScreen = !!opts.splitScreen && opts.characters.length > 1;
    this.net = opts.net ?? null;
    this.localNetId = opts.localNetId ?? null;

    const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
    this.map = new WorldMap(seed);

    const viewW = this.splitScreen ? this.game.width / 2 : this.game.width;
    const viewH = this.game.height;

    opts.characters.forEach((charIndex, i) => {
      const character = CHARACTERS[charIndex];
      const spawn = this.map.spawnPoint(character.size);
      const offset = i === 0 ? 0 : 36;
      const controls =
        this.splitScreen
          ? this.game.input.slot(Math.min(i, 1) as PlayerSlot)
          : this.game.input.solo();
      const player = new Player(spawn.x + offset, spawn.y, controls, this.map, character, i);
      player.blocked = (r) => this.houses.some((h) => overlaps(r, h));
      const camera = new Camera(viewW, viewH, this.map.width, this.map.height);
      camera.follow(player, Infinity);
      this.agents.push({
        id: i,
        netId: i === 0 ? this.localNetId ?? undefined : undefined,
        player,
        camera,
        controls,
        inventory: emptyInventory(),
        score: 0,
        building: false,
        recruiting: false,
        selectedBuilding: 0,
        selectedTroop: 0,
        mods: { coinValue: 1, enemySpeed: 1 },
        nextUpgradeAt: CONFIG.upgradeEvery,
        picker: null,
        upgradesTaken: [],
        currentIsland: -1,
        visited: new Set(),
        quests: new QuestTracker(),
        remote: false,
      });
    });

    if (!this.net) {
      this.refillCoins();
      this.refillResources();
    } else {
      this.net.onMessage = (msg) => this.onNet(msg);
      this.net.onClose = () => {
        this.netStatus = 'Disconnected';
        this.game.scenes.switch(new ModeSelectScene(this.game));
      };
      this.net.flush();
    }
  }

  private primaryLocal(): Agent {
    if (this.net && this.localNetId) {
      return this.agents.find((a) => a.netId === this.localNetId) ?? this.agents[0];
    }
    return this.agents[0];
  }

  enter() {
    this.game.input.setTouchUi(true);
    this.syncTouchHandlers();
  }

  exit() {
    this.game.input.setTouchUi(false);
    this.game.input.setTouchHandlers(null, []);
  }

  private syncCameras() {
    const viewW = this.splitScreen ? this.game.width / 2 : this.game.width;
    const viewH = this.game.height;
    for (const a of this.agents) a.camera.resize(viewW, viewH);
  }

  private needsConfirm() {
    const a = this.primaryLocal();
    return (a.building || a.recruiting) && this.menuOwner === a;
  }

  private syncTouchHandlers() {
    if (!this.game.input.showTouchUi) return;
    const layout = touchLayout(this.game.width, this.game.height, { confirm: this.needsConfirm() });
    this.touchLayout = layout;
    const stick = layout.stick;
    this.game.input.setTouchHandlers(
      {
        contains: (x, y) => Math.hypot(x - stick.cx, y - stick.cy) <= stick.radius + 28,
        setAxis: (p) => {
          if (!p) {
            this.game.input.setStickAxis(null);
            return;
          }
          let dx = p.x - stick.cx;
          let dy = p.y - stick.cy;
          const len = Math.hypot(dx, dy) || 1;
          const max = stick.radius;
          if (len > max) {
            dx = (dx / len) * max;
            dy = (dy / len) * max;
          }
          this.game.input.setStickAxis({ x: dx / max, y: dy / max });
        },
      },
      layout.buttons.map((b) => ({
        action: b.id,
        contains: (x, y) => Math.hypot(x - b.x, y - b.y) <= b.r + 8,
      })),
    );
  }

  private placeBuilding(agent: Agent) {
    const def = BUILDINGS[agent.selectedBuilding];
    const spot = this.previewRect(agent, def);
    const px = agent.player.x + agent.player.w / 2;
    const py = agent.player.y;
    if (!canAfford(agent.inventory, def)) {
      this.popups.add('Not enough resources', '#ef5350', px, py);
      return;
    }
    if (!this.canPlace(agent, def, spot)) {
      this.popups.add("Can't place here", '#ef5350', px, py);
      return;
    }
    if (this.net) {
      this.net.send({
        type: 'action',
        action: { kind: 'build', building: def.id, x: spot.x, y: spot.y },
      });
      this.popups.add(`Building ${def.name}…`, def.roof, spot.x + def.w / 2, spot.y);
    } else {
      spend(agent.inventory, def);
      this.houses.push(new House(spot.x, spot.y, def, agent.id));
      this.popups.add(`Built ${def.name}!`, def.roof, spot.x + def.w / 2, spot.y);
      this.completeQuests(agent, agent.quests.report({ type: 'build', building: def.id }));
    }
  }

  update(dt: number) {
    this.syncCameras();
    this.syncTouchHandlers();
    for (const agent of this.agents) {
      if (agent.picker) {
        const choice = agent.picker.update(this.game.input, this.game.width, this.game.height);
        if (choice) {
          choice.apply({ player: agent.player, mods: agent.mods });
          agent.upgradesTaken.push(choice);
          agent.picker = null;
          this.checkUpgrade(agent);
        }
        return;
      }
    }

    if (this.game.input.wasPressed('KeyP', 'Escape')) {
      this.paused = !this.paused;
      if (this.paused) {
        for (const a of this.agents) {
          a.building = false;
          a.recruiting = false;
        }
        this.menuOwner = null;
      }
    }
    if (this.paused) {
      const tap = this.game.input.consumeTap();
      if (this.game.input.wasPressed('KeyC') && !this.net) {
        this.game.scenes.switch(new ModeSelectScene(this.game));
      } else if (tap && !this.net) {
        const { width: w, height: h } = this.game;
        if (pointIn(tap, w / 2 - 120, h / 2 + 24, 240, 36)) {
          this.game.scenes.switch(new ModeSelectScene(this.game));
        }
      }
      return;
    }

    if (this.combatEnded) {
      this.endTimer -= dt;
      if (this.endTimer <= 0) this.finishCombat();
      this.popups.update(dt);
      return;
    }

    if (this.net) this.sendNetInput();

    for (const agent of this.agents) {
      if (agent.remote || agent.player.lives <= 0) continue;
      this.updateBuild(agent);
      this.updateInteract(agent);
    }

    this.updateBuildings(dt);
    if (!this.net) {
      const { phase, pvpUnlocked } = this.dayNight.update(dt);
      if (phase) {
        this.banner = { text: phase === 'Night' ? 'Night falls' : 'Dawn breaks', time: BANNER_TIME };
        if (phase === 'Night') {
          for (const a of this.agents) this.completeQuests(a, a.quests.report({ type: 'night' }));
        }
      }
      if (pvpUnlocked && this.canFight()) {
        this.banner = { text: 'PvP unlocked — fight!', time: BANNER_TIME + 1 };
      }
    }

    const blocked = (r: Rect) => this.houses.some((h) => overlaps(r, h));
    for (const agent of this.agents) {
      if (agent.player.lives <= 0) continue;
      if (!agent.remote) agent.player.update(dt);
      agent.camera.follow(agent.player, dt);
      this.trackIsland(agent, dt);
    }

    const barracks = this.findBuilding(this.agents[0], (h) => !!h.def.garrison, Infinity);
    for (const t of this.troops) {
      const owner = this.agents.find((a) => a.id === t.ownerId) ?? this.agents[0];
      if (t.order === 'garrison' && barracks) t.garrisonAt(dt, barracks, blocked);
      else if (this.dayNight.pvpActive && this.canFight()) {
        const foe = this.nearestFoe(owner, Infinity);
        if (foe && t.order === 'follow') t.follow(dt, foe.player, blocked);
        else t.follow(dt, owner.player, blocked);
      } else {
        t.follow(dt, owner.player, blocked);
      }
    }

    this.coins.forEach((c) => c.update(dt));
    this.resources.forEach((r) => r.update(dt));
    this.popups.update(dt);

    for (const agent of this.agents) {
      if (agent.remote || agent.player.lives <= 0) continue;
      const aura = this.activeAura(agent);
      this.pull(agent, this.coins, dt, aura.magnet);
      this.pull(agent, this.resources, dt, aura.magnet);
      this.collectCoins(agent, aura.coinBonus);
      this.collectResources(agent);
      this.checkUpgrade(agent);
    }

    this.updateCombat();

    if (!this.net) {
      this.refillCoins();
      this.tickResourceSpawn(dt);
    }

    if (this.net) this.sendNetPose();
  }

  private canFight() {
    return this.agents.length > 1 || !!this.net;
  }

  private nearestFoe(agent: Agent, maxDist: number): Agent | null {
    let best: Agent | null = null;
    let bestDist = maxDist;
    const px = agent.player.x + agent.player.w / 2;
    const py = agent.player.y + agent.player.h / 2;
    for (const other of this.agents) {
      if (other === agent || other.player.lives <= 0) continue;
      const dx = px - (other.player.x + other.player.w / 2);
      const dy = py - (other.player.y + other.player.h / 2);
      const dist = Math.hypot(dx, dy);
      if (dist < bestDist) {
        best = other;
        bestDist = dist;
      }
    }
    return best;
  }

  private updateCombat() {
    if (!this.dayNight.pvpActive || !this.canFight()) {
      this.bolts.length = 0;
      return;
    }

    for (const agent of this.agents) {
      if (agent.remote || agent.player.lives <= 0) continue;
      if (agent.building || agent.recruiting) continue;
      if (agent.controls.interactPressed() && !this.nearestBuilding(agent)) this.tryAttack(agent);
    }

    this.updateBolts();
    this.updateTroopAttacks();

    for (const s of this.swings) s.age += CONFIG.fixedStep;
    this.swings = this.swings.filter((s) => s.age < s.life);

    this.checkCombatEnd();
  }

  private tryAttack(agent: Agent) {
    const p = agent.player;
    const c = p.character.combat;
    if (p.attackCd > 0 || p.stun > 0) return;
    p.attackCd = c.cooldown;
    p.swingT = 0.16;
    if (c.lunge) p.lunge(c.lunge);

    const px = p.x + p.w / 2;
    const py = p.y + p.h / 2;
    const angle = Math.atan2(p.facing.y, p.facing.x);
    this.swings.push({
      x: px,
      y: py,
      angle,
      range: c.style === 'bolt' ? 36 : c.range,
      cone: c.style === 'bolt' ? 0.35 : c.cone,
      color: p.character.accent,
      age: 0,
      life: 0.16,
    });

    if (c.style === 'bolt') {
      const len = Math.hypot(p.facing.x, p.facing.y) || 1;
      this.bolts.push(
        new Bolt(px, py, (p.facing.x / len) * BOLT_SPEED, (p.facing.y / len) * BOLT_SPEED, agent.id, p.character.accent),
      );
      return;
    }

    this.slashHit(agent, px, py, c.range, c.cone, c.knockback, c.stun);
  }

  private slashHit(
    attacker: Agent,
    px: number,
    py: number,
    range: number,
    cone: number,
    knockback: number,
    stun: number,
  ) {
    const fx = attacker.player.facing.x;
    const fy = attacker.player.facing.y;
    for (const foe of this.agents) {
      if (foe === attacker || foe.player.lives <= 0) continue;
      const dx = foe.player.x + foe.player.w / 2 - px;
      const dy = foe.player.y + foe.player.h / 2 - py;
      const dist = Math.hypot(dx, dy);
      if (dist > range + foe.player.w / 2) continue;
      const aim = Math.hypot(fx, fy) || 1;
      const dot = (dx * fx + dy * fy) / (dist * aim || 1);
      if (dot < Math.cos(cone)) continue;
      if (foe.player.swingT > 0.04) {
        this.clash(attacker, foe);
        continue;
      }
      this.dealHit(attacker, foe, { knockback, stun, label: '-1' });
    }
  }

  private clash(a: Agent, b: Agent) {
    const ax = a.player.x + a.player.w / 2;
    const ay = a.player.y + a.player.h / 2;
    const bx = b.player.x + b.player.w / 2;
    const by = b.player.y + b.player.h / 2;
    a.player.knockback(bx, by, 36);
    b.player.knockback(ax, ay, 36);
    this.popups.add('Clash!', '#ffd54f', (ax + bx) / 2, (ay + by) / 2);
  }

  private updateBolts() {
    for (const bolt of this.bolts) {
      bolt.update(CONFIG.fixedStep);
      const owner = this.agents.find((a) => a.id === bolt.ownerId);
      if (!owner) {
        bolt.alive = false;
        continue;
      }
      for (const foe of this.agents) {
        if (foe === owner || foe.player.lives <= 0) continue;
        if (!overlaps(bolt, foe.player)) continue;
        const c = owner.player.character.combat;
        this.dealHit(owner, foe, { knockback: c.knockback, stun: c.stun, label: 'Bolt!' });
        bolt.alive = false;
        break;
      }
    }
    this.bolts = this.bolts.filter((b) => b.alive);
  }

  private updateTroopAttacks() {
    for (const t of this.troops) {
      const owner = this.agents.find((a) => a.id === t.ownerId);
      if (!owner || owner.player.lives <= 0 || t.attackCd > 0) continue;
      const foe = this.nearestFoe(owner, t.def.attackRange + 8);
      if (!foe) continue;
      const dx = foe.player.x + foe.player.w / 2 - (t.x + t.w / 2);
      const dy = foe.player.y + foe.player.h / 2 - (t.y + t.h / 2);
      if (Math.hypot(dx, dy) > t.def.attackRange) continue;
      t.attackCd = t.def.attackEvery;
      this.swings.push({
        x: t.x + t.w / 2,
        y: t.y + t.h / 2,
        angle: Math.atan2(dy, dx),
        range: t.def.attackRange,
        cone: 0.8,
        color: t.def.accent,
        age: 0,
        life: 0.12,
      });
      this.dealHit(owner, foe, {
        knockback: t.def.knockback,
        stun: t.def.stun,
        label: t.def.name,
        fromX: t.x + t.w / 2,
        fromY: t.y + t.h / 2,
      });
    }
  }

  private dealHit(
    attacker: Agent,
    victim: Agent,
    opts: { knockback: number; stun: number; label: string; fromX?: number; fromY?: number },
  ) {
    if (victim.player.lives <= 0 || victim.player.isInvulnerable) return;

    const ax = opts.fromX ?? attacker.player.x + attacker.player.w / 2;
    const ay = opts.fromY ?? attacker.player.y + attacker.player.h / 2;

    if (this.net && victim.netId && !attacker.remote) {
      this.net.send({ type: 'action', action: { kind: 'hit', targetId: victim.netId } });
      victim.player.knockback(ax, ay, opts.knockback);
      victim.player.stun = Math.max(victim.player.stun, opts.stun);
      this.popups.add(opts.label, '#ef5350', victim.player.x + victim.player.w / 2, victim.player.y);
      return;
    }

    const fatal = victim.player.hit();
    victim.player.knockback(ax, ay, opts.knockback);
    victim.player.stun = Math.max(victim.player.stun, opts.stun);
    this.popups.add(opts.label, '#ef5350', victim.player.x + victim.player.w / 2, victim.player.y);
    if (fatal) {
      this.banner = {
        text: `Player ${victim.id + 1} eliminated!`,
        time: BANNER_TIME + 0.5,
      };
    }
  }

  private checkCombatEnd() {
    if (!this.canFight() || this.combatEnded) return;
    if (this.agents.length < 2) return;
    const alive = this.agents.filter((a) => a.player.lives > 0);
    if (alive.length === 1) {
      this.combatEnded = true;
      this.endTimer = 2.2;
      this.banner = { text: `Player ${alive[0].id + 1} wins!`, time: 2.2 };
    } else if (alive.length === 0) {
      this.combatEnded = true;
      this.endTimer = 2.2;
      this.banner = { text: 'Draw!', time: 2.2 };
    }
  }

  private finishCombat() {
    const alive = this.agents.filter((a) => a.player.lives > 0);
    const local = this.primaryLocal();
    const charIndex = Math.max(0, CHARACTERS.indexOf(local.player.character));
    const title =
      alive.length === 0 ? 'DRAW' : alive.includes(local) && alive.length === 1 ? 'VICTORY' : 'DEFEATED';
    this.game.scenes.switch(new GameOverScene(this.game, local.score, charIndex, title));
  }

  private sendNetInput() {
    if (!this.net?.connected) return;
    const c = this.game.input.slot(0);
    const axis = c.axis();
    this.net.send({
      type: 'input',
      ax: axis.x,
      ay: axis.y,
      interact: c.interactPressed(),
      build: c.buildPressed(),
      blink: c.blinkPressed(),
    });
  }

  private sendNetPose() {
    if (!this.net?.connected) return;
    const a = this.primaryLocal();
    this.net.send({
      type: 'pose',
      x: a.player.x,
      y: a.player.y,
      facingX: a.player.facing.x,
      facingY: a.player.facing.y,
    });
  }

  private onNet(msg: ServerMsg) {
    if (msg.type === 'error') {
      this.netStatus = msg.message;
      return;
    }
    if (msg.type === 'state') this.applyNetState(msg.state);
  }

  private applyNetState(state: GameStateSnap) {
    const wasPvp = this.dayNight.pvpActive;
    this.dayNight.setElapsed(state.dayElapsed);
    if (!wasPvp && this.dayNight.pvpActive && this.canFight()) {
      this.banner = { text: 'PvP unlocked — fight!', time: BANNER_TIME + 1 };
    }

    // Sync remote player poses / create missing agents
    for (const snap of state.players) {
      let agent = this.agents.find((a) => a.netId === snap.id);
      if (!agent) {
        const character = CHARACTERS[snap.character] ?? CHARACTERS[0];
        const controls = this.game.input.slot(0);
        const player = new Player(snap.x, snap.y, controls, this.map, character, this.agents.length);
        player.blocked = (r) => this.houses.some((h) => overlaps(r, h));
        const viewW = this.game.width;
        const camera = new Camera(viewW, this.game.height, this.map.width, this.map.height);
        camera.follow(player, Infinity);
        const isLocal = snap.id === this.localNetId;
        agent = {
          id: this.agents.length,
          netId: snap.id,
          player,
          camera,
          controls,
          inventory: { ...snap.inventory },
          score: snap.score,
          building: false,
          recruiting: false,
          selectedBuilding: 0,
          selectedTroop: 0,
          mods: { coinValue: 1, enemySpeed: 1 },
          nextUpgradeAt: CONFIG.upgradeEvery,
          picker: null,
          upgradesTaken: [],
          currentIsland: -1,
          visited: new Set(),
          quests: new QuestTracker(),
          remote: !isLocal,
        };
        this.agents.push(agent);
      }
      agent.score = snap.score;
      agent.inventory = { ...snap.inventory };
      const prevLives = agent.player.lives;
      agent.player.lives = snap.alive ? snap.lives : 0;
      if (prevLives > agent.player.lives) agent.player.flashHurt();
      if (agent.remote) {
        agent.player.x = snap.x;
        agent.player.y = snap.y;
        agent.player.facing = { x: snap.facingX, y: snap.facingY };
      }
    }
    this.checkCombatEnd();

    // World entities from server
    const coinMap = new Map(state.coins.map((c) => [c.id, c]));
    this.coins = this.coins.filter((c) => {
      const id = (c as Coin & { netId?: number }).netId;
      return id == null || coinMap.has(id);
    });
    for (const c of state.coins) {
      if (!this.coins.some((x) => (x as Coin & { netId?: number }).netId === c.id)) {
        const coin = new Coin(c.x, c.y);
        (coin as Coin & { netId?: number }).netId = c.id;
        this.coins.push(coin);
      }
    }

    const resMap = new Map(state.resources.map((r) => [r.id, r]));
    this.resources = this.resources.filter((r) => {
      const id = (r as Resource & { netId?: number }).netId;
      return id == null || resMap.has(id);
    });
    for (const r of state.resources) {
      let ent = this.resources.find((x) => (x as Resource & { netId?: number }).netId === r.id);
      if (!ent) {
        ent = new Resource(r.x, r.y, r.type);
        (ent as Resource & { netId?: number }).netId = r.id;
        this.resources.push(ent);
      } else {
        ent.x = r.x;
        ent.y = r.y;
      }
    }

    // Rebuild houses from server so all clients share placements.
    const houseSnaps = state.houses;
    if (houseSnaps.length || this.net) {
      const next: House[] = [];
      for (const h of houseSnaps) {
        const def = BUILDINGS.find((b) => b.id === h.building);
        if (!def) continue;
        const owner = this.agents.find((a) => a.netId === h.ownerId);
        next.push(new House(h.x, h.y, def, owner?.id ?? 0));
      }
      this.houses = next;
    }
  }

  private completeQuests(agent: Agent, done: QuestDef[]) {
    for (const quest of done) {
      grantReward(agent.inventory, quest.reward);
      this.banner = { text: `Quest complete: ${quest.title}`, time: BANNER_TIME };
      const parts = rewardList(quest.reward).map(([id, n]) => `+${n} ${RESOURCE_BY_ID[id].name}`);
      const px = agent.player.x + agent.player.w / 2;
      const py = agent.player.y;
      this.popups.add(parts.join('  ') || 'Reward claimed!', '#81c784', px, py);
    }
    if (done.length) this.syncQuestProgress(agent);
  }

  private syncQuestProgress(agent: Agent) {
    const quest = agent.quests.active;
    if (!quest) return;
    if (quest.goal.kind === 'score') {
      this.completeQuests(agent, agent.quests.report({ type: 'score', total: agent.score }));
    } else if (quest.goal.kind === 'islands') {
      this.completeQuests(agent, agent.quests.report({ type: 'islands', total: agent.visited.size }));
    }
  }

  private updateBuild(agent: Agent) {
    if (agent.controls.buildPressed()) {
      if (this.menuOwner && this.menuOwner !== agent) {
        this.menuOwner.building = false;
        this.menuOwner.recruiting = false;
      }
      agent.building = !agent.building;
      if (agent.building) {
        agent.recruiting = false;
        this.menuOwner = agent;
      } else if (this.menuOwner === agent) {
        this.menuOwner = null;
      }
    }
    if (!agent.building || this.menuOwner !== agent) return;

    const input = this.game.input;
    const n = BUILDINGS.length;
    const viewW = this.splitScreen ? this.game.width / 2 : this.game.width;
    const pad = this.game.input.showTouchUi ? touchBottomPad(this.game.height) : 0;
    const menuLayout = { originX: 0, viewW, viewH: this.game.height - pad };
    const tap = input.peekTap();
    if (tap) {
      const cards = buildMenuCards(menuLayout);
      const hit = cards.find((c) => pointIn(tap, c.x, c.y, c.w, c.h));
      if (hit) {
        input.consumeTap();
        agent.selectedBuilding = hit.index;
        this.placeBuilding(agent);
        return;
      }
    }
    if (input.wasPressed('KeyQ')) agent.selectedBuilding = (agent.selectedBuilding + n - 1) % n;
    if (input.wasPressed('KeyE')) agent.selectedBuilding = (agent.selectedBuilding + 1) % n;
    for (let i = 0; i < n; i++) {
      if (input.wasPressed(`Digit${i + 1}`)) agent.selectedBuilding = i;
    }

    if (input.wasPressed('Enter')) this.placeBuilding(agent);
  }

  private updateBuildings(dt: number) {
    for (const h of this.houses) {
      const produced = h.update(dt);
      if (!produced) continue;
      const owner = this.agents.find((a) => a.id === h.ownerId) ?? this.agents[0];
      owner.inventory[produced]++;
      const def = RESOURCE_BY_ID[produced];
      this.popups.add(`+1 ${def.name}`, def.color, h.x + h.w / 2, h.y - 4);
    }
    this.pullToBuildings(dt);
  }

  /** Crystal Lodge (and similar) suck nearby loot onto their doorstep. */
  private pullToBuildings(dt: number) {
    for (const h of this.houses) {
      const aura = h.def.aura;
      if (!aura?.magnet) continue;
      const hx = h.x + h.w / 2;
      const hy = h.y + h.h / 2;
      const soft = Math.max(h.w, h.h) * 0.55 + 6;
      for (const item of [...this.coins, ...this.resources]) {
        const dx = hx - (item.x + item.w / 2);
        const dy = hy - (item.y + item.h / 2);
        const dist = Math.hypot(dx, dy);
        if (dist <= soft || dist >= aura.range) continue;
        const step = Math.min(dist - soft, MAGNET_SPEED * dt);
        item.x += (dx / dist) * step;
        item.y += (dy / dist) * step;
      }
    }
  }

  private activeAura(agent: Agent) {
    let magnet = 0;
    let coinBonus = 0;
    const px = agent.player.x + agent.player.w / 2;
    const py = agent.player.y + agent.player.h / 2;
    for (const h of this.houses) {
      const aura = h.def.aura;
      if (!aura) continue;
      const dx = px - (h.x + h.w / 2);
      const dy = py - (h.y + h.h / 2);
      if (Math.hypot(dx, dy) > aura.range) continue;
      magnet += aura.magnet ?? 0;
      coinBonus += aura.coinBonus ?? 0;
    }
    return { magnet, coinBonus };
  }

  private findBuilding(agent: Agent, ok: (h: House) => boolean, maxDist = Infinity): House | null {
    let best: House | null = null;
    let bestDist = maxDist;
    const px = agent.player.x + agent.player.w / 2;
    const py = agent.player.y + agent.player.h / 2;
    for (const h of this.houses) {
      if (!ok(h)) continue;
      const dx = px - (h.x + h.w / 2);
      const dy = py - (h.y + h.h / 2);
      const dist = Math.hypot(dx, dy);
      if (dist < bestDist) {
        best = h;
        bestDist = dist;
      }
    }
    return best;
  }

  private nearestBuilding(agent: Agent) {
    return this.findBuilding(agent, () => true, INTERACT_RANGE);
  }

  private interactKeyLabel(agent: Agent) {
    return agent.id === 0 || this.net ? 'F' : 'M';
  }

  private buildKeyLabel(agent: Agent) {
    return agent.id === 0 || this.net ? 'B' : 'K';
  }

  private interactHint(agent: Agent, house: House) {
    const key = this.interactKeyLabel(agent);
    const { def } = house;
    if (def.recruits) return agent.recruiting ? `${key} — Close shop` : `${key} — Recruit troops`;
    if (def.garrison) {
      const mine = this.troops.filter((t) => t.ownerId === agent.id);
      const stationed = mine.some((t) => t.order === 'garrison');
      return stationed ? `${key} — Recall troops` : `${key} — Station troops`;
    }
    if (def.produces) return `${key} — Check ${def.name}`;
    if (def.aura) return `${key} — Check ${def.name}`;
    return `${key} — ${def.name}`;
  }

  private interactWith(agent: Agent, house: House) {
    const { def } = house;
    const px = agent.player.x + agent.player.w / 2;
    const py = agent.player.y;

    if (def.recruits) {
      if (this.menuOwner && this.menuOwner !== agent) {
        this.menuOwner.building = false;
        this.menuOwner.recruiting = false;
      }
      agent.recruiting = true;
      agent.building = false;
      this.menuOwner = agent;
      return;
    }

    if (def.garrison) {
      const mine = this.troops.filter((t) => t.ownerId === agent.id);
      if (mine.length === 0) {
        this.popups.add('No troops to station', '#ef5350', px, py);
        return;
      }
      const anyFollowing = mine.some((t) => t.order === 'follow');
      if (anyFollowing) {
        for (const t of mine) t.order = 'garrison';
        this.popups.add('Troops to Barracks!', def.trim, house.x + house.w / 2, house.y);
      } else {
        for (const t of mine) t.order = 'follow';
        this.popups.add('Troops, follow!', '#81c784', px, py);
      }
      if (this.net) {
        this.net.send({ type: 'action', action: { kind: 'garrison', station: anyFollowing } });
      }
      return;
    }

    if (def.produces) {
      const res = RESOURCE_BY_ID[def.produces.resource];
      const left = Math.ceil(house.produceCooldownLeft);
      this.popups.add(
        `${def.name}: +1 ${res.name} · ${left}s left`,
        res.color,
        house.x + house.w / 2,
        house.y,
      );
      return;
    }

    if (def.aura) {
      const parts: string[] = [];
      if (def.aura.magnet) parts.push('pulls loot');
      if (def.aura.coinBonus) parts.push(`coins +${def.aura.coinBonus}`);
      this.popups.add(`${def.name}: ${parts.join(', ')} nearby`, def.trim, house.x + house.w / 2, house.y);
      return;
    }

    this.popups.add(def.name, def.trim, house.x + house.w / 2, house.y);
  }

  private updateInteract(agent: Agent) {
    if (!agent.controls.interactPressed()) {
      // still allow menu nav if recruiting
    } else if (!agent.building) {
      if (agent.recruiting) {
        agent.recruiting = false;
        if (this.menuOwner === agent) this.menuOwner = null;
      } else if (this.dayNight.pvpActive && this.canFight() && !this.nearestBuilding(agent)) {
        // Combat uses F / interact; buildings still win if you're standing on one.
      } else {
        const nearby = this.nearestBuilding(agent);
        if (nearby) this.interactWith(agent, nearby);
      }
    }

    const recruitHut =
      agent.recruiting && this.menuOwner === agent
        ? this.findBuilding(agent, (h) => !!h.def.recruits, INTERACT_RANGE)
        : null;
    if (agent.recruiting && !recruitHut) {
      agent.recruiting = false;
      if (this.menuOwner === agent) this.menuOwner = null;
    }
    if (!agent.recruiting || !recruitHut || this.menuOwner !== agent) return;

    const input = this.game.input;
    const n = TROOPS.length;
    const hire = () => {
      const def = TROOPS[agent.selectedTroop];
      if (!canAffordTroop(agent.inventory, def)) return;
      spendTroop(agent.inventory, def);
      const angle = Math.random() * Math.PI * 2;
      const dist = 28 + Math.random() * 12;
      const x = recruitHut.x + recruitHut.w / 2 + Math.cos(angle) * dist - def.size / 2;
      const y = recruitHut.y + recruitHut.h / 2 + Math.sin(angle) * dist - def.size / 2;
      const mine = this.troops.filter((t) => t.ownerId === agent.id).length;
      this.troops.push(new Troop(x, y, def, this.map, mine, agent.id));
      this.popups.add(`Hired ${def.name}!`, def.accent, x + def.size / 2, y);
      this.completeQuests(agent, agent.quests.report({ type: 'hire', troop: def.id }));
    };

    const viewW = this.splitScreen ? this.game.width / 2 : this.game.width;
    const pad = this.game.input.showTouchUi ? touchBottomPad(this.game.height) : 0;
    const menuLayout = { originX: 0, viewW, viewH: this.game.height - pad };
    const tap = input.peekTap();
    if (tap) {
      const cards = troopMenuCards(menuLayout);
      const hit = cards.find((c) => pointIn(tap, c.x, c.y, c.w, c.h));
      if (hit) {
        input.consumeTap();
        agent.selectedTroop = hit.index;
        hire();
        return;
      }
    }
    if (input.wasPressed('KeyQ')) agent.selectedTroop = (agent.selectedTroop + n - 1) % n;
    if (input.wasPressed('KeyE')) agent.selectedTroop = (agent.selectedTroop + 1) % n;
    for (let i = 0; i < n; i++) {
      if (input.wasPressed(`Digit${i + 1}`)) agent.selectedTroop = i;
    }

    if (input.wasPressed('Enter')) hire();
  }

  private previewRect(agent: Agent, def: BuildingDef): Rect {
    const p = agent.player;
    const fx = p.facing.x;
    const fy = p.facing.y;
    return {
      x: p.x + p.w / 2 + fx * (p.w / 2 + PLACE_GAP + def.w / 2) - def.w / 2,
      y: p.y + p.h / 2 + fy * (p.h / 2 + PLACE_GAP + def.h / 2) - def.h / 2,
      w: def.w,
      h: def.h,
    };
  }

  private canPlace(agent: Agent, def: BuildingDef, spot: Rect) {
    if (!canAfford(agent.inventory, def)) return false;
    if (this.agents.some((a) => overlaps(spot, a.player))) return false;
    if (this.houses.some((h) => overlaps(spot, h))) return false;
    // Corners + center only — dense grids rejected large footprints on jagged coasts.
    const inset = 4;
    const points: [number, number][] = [
      [spot.x + inset, spot.y + inset],
      [spot.x + spot.w - inset, spot.y + inset],
      [spot.x + inset, spot.y + spot.h - inset],
      [spot.x + spot.w - inset, spot.y + spot.h - inset],
      [spot.x + spot.w / 2, spot.y + spot.h / 2],
    ];
    return points.every(([x, y]) => this.map.islandAt(x, y) >= 0);
  }

  private isFree(x: number, y: number, size: number) {
    return !this.houses.some((h) => overlaps(h, { x, y, w: size, h: size }));
  }

  private trackIsland(agent: Agent, dt: number) {
    this.banner.time = Math.max(0, this.banner.time - dt);
    const island = this.map.islandAt(agent.player.x + agent.player.w / 2, agent.player.y + agent.player.h / 2);
    if (island < 0 || island === agent.currentIsland) return;
    agent.currentIsland = island;
    const name = this.map.islands[island].theme.name;
    const isNew = !agent.visited.has(island);
    agent.visited.add(island);
    if (!agent.remote) {
      this.banner = { text: isNew ? `Discovered ${name}` : name, time: BANNER_TIME };
      if (isNew) this.completeQuests(agent, agent.quests.report({ type: 'islands', total: agent.visited.size }));
    }
  }

  private checkUpgrade(agent: Agent) {
    if (agent.score < agent.nextUpgradeAt) return;
    const options = rollUpgrades({ player: agent.player, mods: agent.mods }, 3);
    if (options.length === 0) return;
    agent.nextUpgradeAt += CONFIG.upgradeEvery;
    agent.picker = new UpgradePicker(options);
  }

  private pull(agent: Agent, items: Rect[], dt: number, auraMagnet = 0) {
    const radius = agent.player.magnet + auraMagnet;
    if (!radius) return;
    const px = agent.player.x + agent.player.w / 2;
    const py = agent.player.y + agent.player.h / 2;
    for (const item of items) {
      const dx = px - (item.x + item.w / 2);
      const dy = py - (item.y + item.h / 2);
      const dist = Math.hypot(dx, dy);
      if (dist > 0 && dist < radius) {
        const step = Math.min(dist, MAGNET_SPEED * dt);
        item.x += (dx / dist) * step;
        item.y += (dy / dist) * step;
      }
    }
  }

  private collectCoins(agent: Agent, coinBonus: number) {
    let scored = false;
    for (const coin of this.coins) {
      if (!overlaps(agent.player, coin)) continue;
      coin.alive = false;
      const netId = (coin as Coin & { netId?: number }).netId;
      if (this.net && netId != null) {
        this.net.send({ type: 'action', action: { kind: 'collectCoin', id: netId } });
      } else {
        // Ember Keep: +1 when the coin sits in its aura (not stacked with standing buff).
        agent.score += agent.mods.coinValue + Math.max(coinBonus, this.coinBuildingBonus(coin));
        scored = true;
      }
    }
    this.coins = this.coins.filter((c) => c.alive);
    if (scored) this.completeQuests(agent, agent.quests.report({ type: 'score', total: agent.score }));
  }

  /** Extra score from Ember Keep when the coin itself sits in range. */
  private coinBuildingBonus(coin: Rect) {
    let bonus = 0;
    const cx = coin.x + coin.w / 2;
    const cy = coin.y + coin.h / 2;
    for (const h of this.houses) {
      const aura = h.def.aura;
      if (!aura?.coinBonus) continue;
      const dx = cx - (h.x + h.w / 2);
      const dy = cy - (h.y + h.h / 2);
      if (Math.hypot(dx, dy) <= aura.range) bonus += aura.coinBonus;
    }
    return bonus;
  }

  private refillCoins() {
    while (this.coins.length < CONFIG.coin.count) {
      const p = this.map.randomWalkablePoint(CONFIG.coin.size, (x, y) => this.isFree(x, y, CONFIG.coin.size));
      if (!p) break;
      this.coins.push(new Coin(p.x, p.y));
    }
  }

  private collectResources(agent: Agent) {
    for (const r of this.resources) {
      if (!overlaps(agent.player, r)) continue;
      r.alive = false;
      const netId = (r as Resource & { netId?: number }).netId;
      if (this.net && netId != null) {
        this.net.send({ type: 'action', action: { kind: 'collectResource', id: netId } });
      } else {
        agent.inventory[r.type]++;
        const def = RESOURCE_BY_ID[r.type];
        this.popups.add(`+1 ${def.name}`, def.color, r.x + r.w / 2, r.y - 4);
        this.completeQuests(agent, agent.quests.report({ type: 'collect', resource: r.type }));
      }
    }
    this.resources = this.resources.filter((r) => r.alive);
  }

  private tickResourceSpawn(dt: number) {
    if (this.resources.length >= CONFIG.resource.count) {
      this.resourceSpawnTimer = 0;
      return;
    }
    this.resourceSpawnTimer += dt;
    while (
      this.resourceSpawnTimer >= CONFIG.resource.respawnEvery &&
      this.resources.length < CONFIG.resource.count
    ) {
      this.resourceSpawnTimer -= CONFIG.resource.respawnEvery;
      if (!this.spawnOneResource()) break;
    }
  }

  private refillResources() {
    while (this.resources.length < CONFIG.resource.count) {
      if (!this.spawnOneResource()) break;
    }
  }

  private spawnOneResource() {
    if (this.resources.length >= CONFIG.resource.count) return false;
    const size = CONFIG.resource.size;
    const islandOf = (x: number, y: number) => this.map.islandAt(x + size / 2, y + size / 2);
    const perIsland = this.map.islands.map(() => 0);
    for (const r of this.resources) {
      const i = islandOf(r.x, r.y);
      if (i >= 0) perIsland[i]++;
    }
    while (true) {
      const fewest = Math.min(...perIsland);
      if (fewest === Infinity) return false;
      const island = perIsland.indexOf(fewest);
      const p = this.map.randomWalkablePoint(size, (x, y) => islandOf(x, y) === island && this.isFree(x, y, size));
      if (!p) {
        perIsland[island] = Infinity;
        continue;
      }
      this.resources.push(new Resource(p.x, p.y, rollResource(this.map.islands[island].theme.name)));
      return true;
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    this.syncCameras();
    const { width: w, height: h } = this.game;
    if (this.splitScreen && this.agents.length >= 2) {
      const hw = w / 2;
      this.renderViewport(ctx, this.agents[0], 0, 0, hw, h);
      this.renderViewport(ctx, this.agents[1], hw, 0, hw, h);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hw, 0);
      ctx.lineTo(hw, h);
      ctx.stroke();
    } else {
      const agent = this.primaryLocal();
      this.renderViewport(ctx, agent, 0, 0, w, h);
    }

    if (this.banner.time > 0) {
      ctx.globalAlpha = Math.min(1, this.banner.time, (BANNER_TIME - this.banner.time) * 4);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.roundRect(w / 2 - 190, 34, 380, 52, 10);
      ctx.fill();
      drawText(ctx, this.banner.text, w / 2, 60, 26, 'center');
      ctx.globalAlpha = 1;
    }

    for (const agent of this.agents) {
      if (agent.picker) {
        agent.picker.render(ctx, w, h);
        break;
      }
    }

    if (this.paused) {
      const touch = this.game.input.touchPreferred;
      drawText(ctx, 'PAUSED', w / 2, h / 2, 48, 'center');
      ctx.globalAlpha = 0.8;
      drawText(
        ctx,
        this.net
          ? touch
            ? 'Tap Ⅱ to resume'
            : 'Esc to resume'
          : touch
            ? 'Tap here for modes'
            : 'C for modes',
        w / 2,
        h / 2 + 40,
        16,
        'center',
      );
      ctx.globalAlpha = 1;
    }

    if (this.game.input.showTouchUi && !this.paused) {
      const axis = this.game.input.getStickAxis();
      const stickActive = axis.x !== 0 || axis.y !== 0;
      drawTouchControls(ctx, this.touchLayout, stickActive ? axis : null);
    }

    if (this.netStatus) drawText(ctx, this.netStatus, w / 2, 20, 14, 'center');
  }

  private renderViewport(
    ctx: CanvasRenderingContext2D,
    agent: Agent,
    ox: number,
    oy: number,
    vw: number,
    vh: number,
  ) {
    const cx = Math.round(agent.camera.x);
    const cy = Math.round(agent.camera.y);

    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, oy, vw, vh);
    ctx.clip();
    ctx.translate(ox, oy);

    this.map.draw(ctx, cx, cy, vw, vh);

    ctx.save();
    ctx.translate(-cx, -cy);
    this.resources.forEach((r) => r.render(ctx));
    this.coins.forEach((c) => c.render(ctx));
    const sprites = [...this.houses, ...this.troops, ...this.agents.map((a) => a.player)].sort(
      (a, b) => a.y + a.h - (b.y + b.h),
    );
    sprites.forEach((s) => s.render(ctx));
    this.bolts.forEach((b) => b.render(ctx));
    this.renderSwings(ctx);
    if (agent.building && this.menuOwner === agent) this.renderPreview(ctx, agent);
    this.popups.render(ctx);
    ctx.restore();

    this.dayNight.render(ctx, vw, vh);

    const players = this.agents.map((a) => ({
      rect: a.player,
      color: a.player.character.color,
    }));
    drawMinimap(ctx, this.map, agent.camera, agent.player, this.coins, this.houses, {
      originX: 0,
      viewW: vw,
      width: Math.min(140, vw - 24),
      players,
    });

    this.renderHud(ctx, agent, vw);
    this.renderIslandInfo(ctx, agent, vw);

    const touchPad = this.game.input.showTouchUi ? touchBottomPad(vh) : 0;
    const hudH = vh - touchPad;
    const menuLayout = {
      originX: 0,
      viewW: vw,
      viewH: hudH,
      closeHint: agent.building
        ? `${this.buildKeyLabel(agent)} to close`
        : `${this.interactKeyLabel(agent)} to close`,
    };
    if (agent.building && this.menuOwner === agent) {
      drawBuildMenu(ctx, agent.inventory, BUILDINGS[agent.selectedBuilding], menuLayout);
    } else if (agent.recruiting && this.menuOwner === agent) {
      drawTroopMenu(ctx, agent.inventory, TROOPS[agent.selectedTroop], menuLayout);
    } else {
      drawInventory(ctx, agent.inventory, {
        originX: 0,
        viewW: vw,
        viewH: hudH,
        scale: this.splitScreen ? 0.85 : 1,
      });
      this.renderInteractHint(ctx, agent, vw, hudH);
    }

    drawText(ctx, this.splitScreen ? (agent.id === 0 ? 'P1' : 'P2') : '', 12, vh - 8, 12);

    ctx.restore();
  }

  private renderSwings(ctx: CanvasRenderingContext2D) {
    for (const s of this.swings) {
      const k = 1 - s.age / s.life;
      ctx.save();
      ctx.strokeStyle = s.color;
      ctx.globalAlpha = 0.35 + 0.55 * k;
      ctx.lineWidth = 3 + 3 * k;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.range * (0.55 + 0.45 * k), s.angle - s.cone, s.angle + s.cone);
      ctx.stroke();
      ctx.restore();
    }
  }

  private renderPreview(ctx: CanvasRenderingContext2D, agent: Agent) {
    const def = BUILDINGS[agent.selectedBuilding];
    const spot = this.previewRect(agent, def);
    const ok = this.canPlace(agent, def, spot);
    ctx.globalAlpha = 0.55;
    drawHouse(ctx, def, spot.x, spot.y);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = ok ? '#81c784' : '#ef5350';
    ctx.lineWidth = 2;
    ctx.strokeRect(spot.x - 1, spot.y - 1, spot.w + 2, spot.h + 2);
  }

  private renderIslandInfo(ctx: CanvasRenderingContext2D, agent: Agent, vw: number) {
    const minimapW = Math.min(140, vw - 24);
    const minimapH = (this.map.height / this.map.width) * minimapW;
    const name = agent.currentIsland >= 0 ? this.map.islands[agent.currentIsland].theme.name : 'Open sea';
    drawText(
      ctx,
      `${name}  ·  ${agent.visited.size}/${this.map.islands.length}`,
      vw - CONFIG.minimap.margin,
      CONFIG.minimap.margin + minimapH + 14,
      11,
      'right',
    );
  }

  private renderInteractHint(ctx: CanvasRenderingContext2D, agent: Agent, vw: number, vh: number) {
    const lift = inventoryHeight(this.splitScreen ? 0.85 : 1) + 28;
    const nearby = this.nearestBuilding(agent);
    if (nearby) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.beginPath();
      ctx.roundRect(vw / 2 - 110, vh - lift - 16, 220, 28, 8);
      ctx.fill();
      drawText(ctx, this.interactHint(agent, nearby), vw / 2, vh - lift, 13, 'center');
      return;
    }
    const aura = this.activeAura(agent);
    if (!aura.magnet && !aura.coinBonus) return;
    const parts: string[] = [];
    if (aura.magnet) parts.push('Crystal pull');
    if (aura.coinBonus) parts.push(`Ember +${aura.coinBonus}`);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect(vw / 2 - 100, vh - lift - 16, 200, 28, 8);
    ctx.fill();
    drawText(ctx, parts.join(' · '), vw / 2, vh - lift, 13, 'center');
  }

  private renderHud(ctx: CanvasRenderingContext2D, agent: Agent, vw: number) {
    drawText(ctx, `Score: ${agent.score}`, 12, 22, 14);
    const hearts =
      agent.player.lives <= 0
        ? '✕'
        : '♥'.repeat(Math.max(0, agent.player.lives)) +
          '♡'.repeat(Math.max(0, agent.player.maxLives - agent.player.lives));
    drawText(ctx, hearts, 12, 38, this.dayNight.pvpActive && this.canFight() ? 18 : 14);
    const mine = this.troops.filter((t) => t.ownerId === agent.id);
    const stationed = mine.filter((t) => t.order === 'garrison').length;
    const troopLabel = stationed > 0 ? `T:${mine.length}(${stationed})` : `T:${mine.length}`;
    drawText(
      ctx,
      `H:${this.houses.length} ${troopLabel} · ${this.buildKeyLabel(agent)}/${this.interactKeyLabel(agent)}`,
      12,
      54,
      12,
    );
    const phaseIcon = this.dayNight.isNight ? '☾' : '☀';
    const dayLabel = `Day ${Math.min(this.dayNight.fullDays + 1, CONFIG.pvpAfterFullDays)}/${CONFIG.pvpAfterFullDays}`;
    const pvpLabel = this.canFight()
      ? this.dayNight.pvpActive
        ? ' · FIGHT!'
        : ` · PvP ${formatClock(this.dayNight.untilPvp)}`
      : '';
    drawText(
      ctx,
      `${phaseIcon} ${formatClock(this.dayNight.remaining)} · ${dayLabel}${pvpLabel}`,
      12,
      128,
      12,
    );
    if (!this.splitScreen || vw > 400) {
      drawQuestPanel(ctx, agent.quests.active, agent.quests.currentProgress, 12, 148);
    }

    const barW = Math.min(140, vw - 24);
    const progress = 1 - (agent.nextUpgradeAt - agent.score) / CONFIG.upgradeEvery;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(12, 68, barW, 7);
    ctx.fillStyle = CONFIG.colors.coin;
    ctx.fillRect(12, 68, barW * Math.min(1, Math.max(0, progress)), 7);

    agent.upgradesTaken.forEach((u, i) => {
      ctx.fillStyle = u.color;
      ctx.font = '14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(u.icon, 22 + i * 18, 96);
    });

    if (agent.player.blinkRange > 0) {
      const status = agent.player.blinkTimer > 0 ? `${agent.player.blinkTimer.toFixed(1)}s` : 'ready';
      drawText(ctx, `Blink: ${status}`, 12, 112, 12);
    }

    if (this.dayNight.pvpActive && this.canFight() && agent.player.lives > 0) {
      const c = agent.player.character.combat;
      const ready = agent.player.attackCd <= 0;
      const verb = c.style === 'bolt' ? 'Bolt' : 'Strike';
      drawText(
        ctx,
        ready ? `${this.interactKeyLabel(agent)} ${verb}` : `${verb} ${agent.player.attackCd.toFixed(1)}s`,
        12,
        168,
        12,
      );
    }
  }
}
