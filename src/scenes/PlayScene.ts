import { Music } from '@/audio/Music';
import {
  BUILD_MENU,
  BUILDING_BY_ID,
  BUILDINGS,
  canAfford,
  findMansionCluster,
  mansionPlacement,
  spend,
  type BuildingDef,
} from '@/buildings';
import { CHARACTERS } from '@/characters';
import { CONFIG } from '@/config';
import { Camera } from '@/core/Camera';
import type { Game } from '@/core/Game';
import type { PlayerControls, PlayerSlot, TouchPadHandler } from '@/core/Input';
import { overlaps, type Rect } from '@/core/math';
import { loadTutorialDone, saveTutorialDone } from '@/core/storage';
import type { Scene } from '@/core/Scene';
import { Bolt } from '@/entities/Bolt';
import {
  CHEST_COINS,
  CHEST_COUNT,
  CHEST_LOOT,
  CHEST_MIN_SPREAD,
  CHEST_SIZE,
} from '@/chests';
import { Chest } from '@/entities/Chest';
import { Coin } from '@/entities/Coin';
import { House } from '@/entities/House';
import { Player } from '@/entities/Player';
import { Resource } from '@/entities/Resource';
import { Troop } from '@/entities/Troop';
import { Village } from '@/entities/Village';
import type { NetClient } from '@/net/NetClient';
import type { GameStateSnap, ServerMsg } from '@/net/protocol';
import { grantReward, QuestTracker, rewardList, type QuestDef } from '@/quests';
import {
  emptyInventory,
  RESOURCE_BY_ID,
  rollResource,
  takeFood,
  type Inventory,
  type ResourceId,
} from '@/resources';
import { TROOP_BY_ID, canAffordTroop, spendTroop, troopsFor } from '@/troops';
import { buildMenuCards, drawBuildMenu } from '@/ui/buildMenu';
import { drawSwingFx, type SwingFx } from '@/ui/combatFx';
import { ATTACK_POSE } from '@/ui/drawCharacter';
import { drawHouse } from '@/ui/drawHouse';
import { pointIn } from '@/ui/hit';
import { drawInventory, inventoryHeight } from '@/ui/inventory';
import { drawMinimap } from '@/ui/minimap';
import { Popups } from '@/ui/popups';
import { drawQuestPanel } from '@/ui/questPanel';
import { drawText } from '@/ui/text';
import {
  drawTouchControls,
  pointInStickHit,
  touchBottomPad,
  touchLayout,
  type TouchLayout,
} from '@/ui/touchControls';
import { drawTradeMenu, tradeMenuCards } from '@/ui/tradeMenu';
import { drawTroopMenu, troopMenuCards } from '@/ui/troopMenu';
import { applyOffer, canAffordOffer, VILLAGE_TRADE_RANGE } from '@/villages';
import { Tutorial } from '@/ui/tutorial';
import { UpgradePicker } from '@/ui/UpgradePicker';
import { rollUpgrades, type RunModifiers, type Upgrade } from '@/upgrades';
import { DayNight, formatClock } from '@/world/dayNight';
import { WorldMap } from '@/world/WorldMap';
import { GameOverScene } from './GameOverScene';
import { MainMenuScene } from './MainMenuScene';

const PRE_PVP_THEME = `${import.meta.env.BASE_URL}audio/blueprint_of_a_kingdom.mp3`;
const PVP_THEME = `${import.meta.env.BASE_URL}audio/under_iron_skies.mp3`;

function hungerColor(h: number) {
  if (h > 0.5) {
    const t = (h - 0.5) * 2;
    return `rgb(${Math.round(255 - 126 * t)}, ${Math.round(193 + 3 * t)}, ${Math.round(7 + 125 * t)})`;
  }
  const t = h * 2;
  return `rgb(${Math.round(239 + 16 * t)}, ${Math.round(83 + 110 * t)}, ${Math.round(80 - 73 * t)})`;
}

const MAGNET_SPEED = 320;
const BANNER_TIME = 2.5;
const PLACE_GAP = 18;
/** Must clear the largest building half-size + place gap. */
const INTERACT_RANGE = 88;
const BOLT_SPEED = 460;
/** Followers only strike when an enemy is this close to their owner. */
const TROOP_PROTECT_RANGE = 96;
/** Barracks battle-line spacing / stand-off from the building. */
const FORM_SPACING = 24;
const FORM_FORWARD = 40;
const SHIELD_BASH_CD = 0.45;

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
  trading: boolean;
  selectedBuilding: number;
  selectedTroop: number;
  selectedTrade: number;
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
  private chests: Chest[] = [];
  private popups = new Popups();
  /** Optimistic eat — roll back hunger if the server rejects. */
  private eatExpect: { id: ResourceId; count: number; restore: number } | null = null;
  private paused = false;
  private banner = { text: '', time: 0 };
  private houses: House[] = [];
  private villages: Village[] = [];
  private troops: Troop[] = [];
  private dayNight = new DayNight();
  private resourceSpawnTimer = 0;
  private splitScreen: boolean;
  private net: NetClient | null;
  private localNetId: string | null;
  private menuOwner: Agent | null = null;
  private netStatus = '';
  private touchLayouts: TouchLayout[] = [touchLayout(CONFIG.width, CONFIG.height, { slot: 0 })];
  /** Floating joystick origins while fingers drag (one per local player). */
  private stickOrigins: [{ x: number; y: number } | null, { x: number; y: number } | null] = [null, null];
  private combatEnded = false;
  private endTimer = 0;
  private bolts: Bolt[] = [];
  private swings: SwingFx[] = [];
  private prePvpMusic = new Music(PRE_PVP_THEME);
  private pvpMusic = new Music(PVP_THEME);
  private pvpThemeStarted = false;
  private tutorial: Tutorial | null = null;

  constructor(
    private game: Game,
    options: PlaySceneOptions | number,
  ) {
    const opts: PlaySceneOptions =
      typeof options === 'number' ? { characters: [options], splitScreen: false } : options;
    this.splitScreen = !!opts.splitScreen && opts.characters.length > 1;
    this.net = opts.net ?? null;
    this.localNetId = opts.localNetId ?? null;
    // Skip the overlay tutorial in split co-op so both screen pads show immediately.
    this.tutorial = this.splitScreen || loadTutorialDone() ? null : new Tutorial();

    const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
    this.map = new WorldMap(seed);
    this.villages = this.map.villageSites.map(
      (s) => new Village(s.x, s.y, this.map.islands[s.island].theme, s.island),
    );

    const vp0 = this.agentViewport(0);

    opts.characters.forEach((charIndex, i) => {
      const character = CHARACTERS[charIndex];
      const size = character.size;
      let spawn = this.map.spawnPoint(size);
      if (this.obstructs({ x: spawn.x, y: spawn.y, w: size, h: size })) {
        spawn =
          this.map.randomWalkablePoint(
            size,
            (x, y) => this.map.islandAt(x + size / 2, y + size / 2) === 0 && !this.obstructs({ x, y, w: size, h: size }),
          ) ?? spawn;
      }
      const offset = i === 0 ? 0 : 36;
      const controls =
        this.splitScreen
          ? this.game.input.slot(Math.min(i, 1) as PlayerSlot)
          : this.game.input.solo();
      const player = new Player(spawn.x + offset, spawn.y, controls, this.map, character, i);
      player.blocked = (r) => this.obstructs(r);
      const camera = new Camera(vp0.vw, vp0.vh, this.map.width, this.map.height);
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
        trading: false,
        selectedBuilding: 0,
        selectedTroop: 0,
        selectedTrade: 0,
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
      this.spawnChests();
    } else {
      this.net.onMessage = (msg) => this.onNet(msg);
      this.net.onClose = () => {
        this.netStatus = 'Disconnected';
        this.game.scenes.switch(new MainMenuScene(this.game));
      };
      this.net.flush();
    }
  }

  private syncLivesToServer(agent: Agent) {
    if (!this.net || agent.remote) return;
    this.net.send({
      type: 'action',
      action: {
        kind: 'syncLives',
        lives: agent.player.lives,
        maxLives: agent.player.maxLives,
      },
    });
  }

  private primaryLocal(): Agent {
    if (this.net && this.localNetId) {
      return this.agents.find((a) => a.netId === this.localNetId) ?? this.agents[0];
    }
    return this.agents[0];
  }

  enter() {
    // Touch pads only on real touch devices — keyboard on desktop.
    this.game.input.setTouchUi(true);
    this.syncTouchHandlers();
    if (this.dayNight.pvpActive) void this.pvpMusic.play();
    else void this.prePvpMusic.play();
  }

  exit() {
    this.prePvpMusic.stop(400);
    this.pvpMusic.stop(400);
    this.game.input.setTouchUi(false);
    this.game.input.setTouchPads([]);
  }

  /** Fade out the peaceful theme and start the PvP track. */
  private startPvpMusic() {
    if (this.pvpThemeStarted) return;
    this.pvpThemeStarted = true;
    this.prePvpMusic.stop();
    void this.pvpMusic.play();
  }

  /** Local co-op is always two columns (P1 left, P2 right). */
  private agentViewport(agentId: number): { ox: number; oy: number; vw: number; vh: number } {
    const w = this.game.width;
    const h = this.game.height;
    if (!this.splitScreen) return { ox: 0, oy: 0, vw: w, vh: h };
    const hw = w / 2;
    return { ox: agentId * hw, oy: 0, vw: hw, vh: h };
  }

  /**
   * How much world the viewport should show, and the scale to draw it.
   * Narrow / touch screens use a tight target (~100wu). Desktop ~780wu.
   * Uses viewport width (not only touchPreferred) so phones always get the zoom.
   */
  private worldView(viewW: number, viewH: number) {
    const narrow = viewW < 1100 || this.game.input.touchPreferred;
    const targetW = narrow ? 100 : 780;
    let z = viewW / targetW;
    // Never ask the camera for more than the map (portrait phones).
    if (viewH / z > CONFIG.world.height) z = viewH / CONFIG.world.height;
    if (viewW / z > CONFIG.world.width) z = viewW / CONFIG.world.width;
    return {
      zoom: z,
      worldW: viewW / z,
      worldH: viewH / z,
    };
  }

  private minimapWidth(vw: number) {
    if (vw < 700) return Math.min(80, Math.round(vw * 0.2));
    return Math.min(CONFIG.minimap.width, vw - 24);
  }

  /** Inventory icon scale — compact on phones so it doesn't cover the pad. */
  private inventoryScale(vw: number) {
    if (this.game.input.touchPreferred || vw < 700) {
      return this.splitScreen ? 0.4 : 0.45;
    }
    return this.splitScreen ? 0.85 : 1;
  }

  private syncCameras() {
    for (const a of this.agents) {
      const vp = this.agentViewport(a.id);
      const { worldW, worldH } = this.worldView(vp.vw, vp.vh);
      a.camera.resize(worldW, worldH);
    }
  }

  private syncTouchHandlers() {
    this.game.input.setTouchUi(true);
    if (!this.game.input.showTouchUi) {
      this.touchLayouts = [];
      this.game.input.setTouchPads([]);
      return;
    }
    const dual = this.splitScreen && this.agents.length >= 2;
    const padCount = dual ? 2 : 1;
    const layouts: TouchLayout[] = [];
    const pads: TouchPadHandler[] = [];

    for (let i = 0; i < padCount; i++) {
      const slot = Math.min(i, 1) as PlayerSlot;
      const vp = dual ? this.agentViewport(i) : { ox: 0, oy: 0, vw: this.game.width, vh: this.game.height };
      const agent = this.agents[i];
      const confirm =
        !!agent &&
        this.menuOwner === agent &&
        (agent.building || agent.recruiting || agent.trading);
      const layout = touchLayout(vp.vw, this.game.height, {
        originX: vp.ox,
        originY: vp.oy,
        viewH: vp.vh,
        canvasW: this.game.width,
        slot,
        confirm,
        showPause: i === 0,
      });
      layouts.push(layout);
      const stick = layout.stick;
      pads.push({
        slot,
        stick: {
          contains: (x, y) => pointInStickHit(stick, x, y),
          setAxis: (p) => {
            if (!p) {
              this.stickOrigins[slot] = null;
              this.game.input.setStickAxis(slot, null);
              return;
            }
            if (!this.stickOrigins[slot]) {
              const margin = stick.radius + 6;
              this.stickOrigins[slot] = {
                x: Math.max(stick.hitX + margin, Math.min(stick.hitX + stick.hitW - margin, p.x)),
                y: Math.max(stick.hitY + margin, Math.min(stick.hitY + stick.hitH - margin, p.y)),
              };
            }
            const o = this.stickOrigins[slot]!;
            let dx = p.x - o.x;
            let dy = p.y - o.y;
            const len = Math.hypot(dx, dy) || 1;
            const max = stick.radius;
            if (len > max) {
              dx = (dx / len) * max;
              dy = (dy / len) * max;
            }
            this.game.input.setStickAxis(slot, { x: dx / max, y: dy / max });
          },
        },
        buttons: layout.buttons.map((b) => ({
          action: b.id,
          contains: (x, y) => Math.hypot(x - b.x, y - b.y) <= b.r + 14,
        })),
      });
    }

    this.touchLayouts = layouts;
    this.game.input.setTouchPads(pads);
  }

  private placeBuilding(agent: Agent) {
    const def = BUILD_MENU[agent.selectedBuilding];
    if (!def) return;
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
      this.tryMergeMansion(agent.id, spot.x + def.w / 2, spot.y + def.h / 2);
    }
  }

  /** Four adjacent residential houses owned by the same player become a mansion. */
  private tryMergeMansion(ownerId: number, nearX: number, nearY: number) {
    const footprints = this.houses.map((h) => ({
      x: h.x,
      y: h.y,
      w: h.w,
      h: h.h,
      building: h.def.id,
      ownerId: h.ownerId,
    }));
    const indices = findMansionCluster(footprints, ownerId, { x: nearX, y: nearY });
    if (!indices) return;

    const cluster = indices.map((i) => footprints[i]);
    const spot = mansionPlacement(cluster);
    const mansion = BUILDING_BY_ID.mansion;
    const remove = new Set(indices);
    this.houses = this.houses.filter((_, i) => !remove.has(i));
    this.houses.push(new House(spot.x, spot.y, mansion, ownerId));
    this.banner = { text: 'Mansion formed — elite troops unlocked!', time: BANNER_TIME + 1 };
    this.popups.add('Mansion!', mansion.roof, spot.x + mansion.w / 2, spot.y);
  }

  update(dt: number) {
    this.syncCameras();
    this.syncTouchHandlers();

    if (this.tutorial) {
      this.game.input.setTouchPads([]);
      if (this.tutorial.update(this.game.input, this.game.width, this.game.height)) {
        saveTutorialDone();
        this.tutorial = null;
      }
      return;
    }

    for (const agent of this.agents) {
      if (agent.picker) {
        const choice = agent.picker.update(this.game.input, this.game.width, this.game.height);
        if (choice) {
          const livesBefore = agent.player.maxLives;
          choice.apply({ player: agent.player, mods: agent.mods });
          agent.upgradesTaken.push(choice);
          agent.picker = null;
          if (agent.player.maxLives !== livesBefore) this.syncLivesToServer(agent);
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
          a.trading = false;
        }
        this.menuOwner = null;
      }
    }
    if (this.paused) {
      const tap = this.game.input.consumeTap();
      if (this.game.input.wasPressed('KeyC') && !this.net) {
        this.game.scenes.switch(new MainMenuScene(this.game));
      } else if (tap && !this.net) {
        const { width: w, height: h } = this.game;
        if (pointIn(tap, w / 2 - 120, h / 2 + 24, 240, 36)) {
          this.game.scenes.switch(new MainMenuScene(this.game));
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
      this.tryEat(agent);
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
      if (pvpUnlocked) {
        this.startPvpMusic();
        if (this.canFight()) {
          this.banner = { text: 'PvP unlocked — fight!', time: BANNER_TIME + 1 };
        }
      }
    }

    if (this.dayNight.pvpActive) {
      this.startPvpMusic();
      if (!this.pvpMusic.isPlaying) void this.pvpMusic.play();
    } else if (!this.prePvpMusic.isPlaying) {
      // Retry if the browser blocked autoplay until a gesture.
      void this.prePvpMusic.play();
    }


    const blocked = (r: Rect) => this.obstructs(r);
    for (const v of this.villages) v.update(dt);
    for (const agent of this.agents) {
      if (agent.player.lives <= 0) continue;
      if (!agent.remote) agent.player.update(dt);
      agent.camera.follow(agent.player, dt);
      this.trackIsland(agent, dt);
    }

    this.updateTroopOrders(dt, blocked);

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
      if (agent.building || agent.recruiting || agent.trading) continue;
      if (
        agent.controls.interactPressed() &&
        !this.nearestBuilding(agent) &&
        !this.nearestVillage(agent) &&
        !this.nearestChest(agent)
      ) {
        this.tryAttack(agent);
      }
      this.tickFireball(agent);
      this.tickShieldBash(agent);
    }

    this.updateBolts();
    this.updateTroopAttacks();

    for (const s of this.swings) s.age += CONFIG.fixedStep;
    this.swings = this.swings.filter((s) => s.age < s.life);

    this.checkCombatEnd();
  }

  private tryAttack(agent: Agent) {
    const p = agent.player;
    const c = p.combat;
    if (p.attackCd > 0 || p.stun > 0) return;
    p.attackCd = c.cooldown;
    p.swingT = ATTACK_POSE;
    if (c.lunge) p.lunge(c.lunge);

    const px = p.x + p.w / 2;
    const py = p.y + p.h / 2;
    const angle = Math.atan2(p.facing.y, p.facing.x);
    const isBolt = c.style === 'bolt';
    this.swings.push({
      x: px,
      y: py,
      angle,
      range: isBolt ? 42 : c.range,
      cone: isBolt ? 0.4 : c.cone,
      color: p.character.accent,
      age: 0,
      life: ATTACK_POSE,
      kind: isBolt ? 'cast' : 'slash',
    });

    if (isBolt) {
      this.spawnBolts(agent, angle);
      return;
    }

    this.slashHit(agent, px, py, c.range, c.cone, c.knockback, c.stun);
  }

  private tickFireball(agent: Agent) {
    const p = agent.player;
    if (p.fireballEvery <= 0 || p.lives <= 0) return;
    p.fireballTimer += CONFIG.fixedStep;
    if (p.fireballTimer < p.fireballEvery) return;
    const foe = this.nearestFoe(agent, p.combat.range + 40);
    if (!foe) return;
    p.fireballTimer = 0;
    const px = p.x + p.w / 2;
    const py = p.y + p.h / 2;
    const angle = Math.atan2(
      foe.player.y + foe.player.h / 2 - py,
      foe.player.x + foe.player.w / 2 - px,
    );
    this.spawnBolts(agent, angle);
    this.swings.push({
      x: px,
      y: py,
      angle,
      range: 44,
      cone: 0.4,
      color: p.character.accent,
      age: 0,
      life: ATTACK_POSE * 0.85,
      kind: 'cast',
    });
  }

  private tickShieldBash(agent: Agent) {
    const p = agent.player;
    if (!p.shieldBash || !p.isInvulnerable || p.lives <= 0 || p.shieldBashCd > 0) return;
    for (const foe of this.agents) {
      if (foe === agent || foe.player.lives <= 0) continue;
      if (!overlaps(p, foe.player)) continue;
      p.shieldBashCd = SHIELD_BASH_CD;
      this.dealHit(agent, foe, {
        knockback: p.combat.knockback + 22,
        stun: p.combat.stun + 0.12,
        label: 'Bash!',
      });
      return;
    }
  }

  private spawnBolts(agent: Agent, angle: number) {
    const p = agent.player;
    const n = 1 + p.boltExtra;
    const spread = n > 1 ? 0.22 : 0;
    const life = Math.max(0.45, p.combat.range / BOLT_SPEED);
    const px = p.x + p.w / 2;
    const py = p.y + p.h / 2;
    for (let i = 0; i < n; i++) {
      const a = angle + (i - (n - 1) / 2) * spread;
      this.bolts.push(new Bolt(px, py, Math.cos(a) * BOLT_SPEED, Math.sin(a) * BOLT_SPEED, agent.id, p.character.accent, life));
    }
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
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    this.popups.add('Clash!', '#ffd54f', mx, my);
    this.swings.push({
      x: mx,
      y: my,
      angle: Math.atan2(by - ay, bx - ax),
      range: 28,
      cone: Math.PI,
      color: '#ffd54f',
      age: 0,
      life: 0.2,
      kind: 'clash',
    });
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
        const c = owner.player.combat;
        this.dealHit(owner, foe, { knockback: c.knockback, stun: c.stun, label: 'Bolt!' });
        bolt.alive = false;
        break;
      }
    }
    this.bolts = this.bolts.filter((b) => b.alive);
  }

  /** Followers stay with you; garrisoned troops hold a battle line at the Barracks. */
  private updateTroopOrders(dt: number, blocked: (r: Rect) => boolean) {
    for (const owner of this.agents) {
      const mine = this.troops.filter((t) => t.ownerId === owner.id);
      const followers = mine.filter((t) => t.order === 'follow');
      const garrisoned = mine.filter((t) => t.order === 'garrison');

      for (const t of followers) t.follow(dt, owner.player, blocked);

      if (garrisoned.length === 0) continue;
      const barracks = this.findBuilding(owner, (h) => !!h.def.garrison, Infinity);
      if (!barracks) {
        for (const t of garrisoned) t.follow(dt, owner.player, blocked);
        continue;
      }

      const foe = this.dayNight.pvpActive && this.canFight() ? this.nearestFoe(owner, Infinity) : null;
      const bx = barracks.x + barracks.w / 2;
      const by = barracks.y + barracks.h / 2;
      let facing = Math.PI / 2;
      if (foe) {
        facing = Math.atan2(
          foe.player.y + foe.player.h / 2 - by,
          foe.player.x + foe.player.w / 2 - bx,
        );
      }
      const px = Math.cos(facing + Math.PI / 2);
      const py = Math.sin(facing + Math.PI / 2);
      const fx = Math.cos(facing);
      const fy = Math.sin(facing);
      const n = garrisoned.length;
      garrisoned.forEach((t, i) => {
        const slot = i - (n - 1) / 2;
        const tx = bx + fx * FORM_FORWARD + px * slot * FORM_SPACING;
        const ty = by + fy * FORM_FORWARD + py * slot * FORM_SPACING;
        t.formAt(dt, tx, ty, blocked);
        if (foe) t.lookAt(foe.player.x + foe.player.w / 2, foe.player.y + foe.player.h / 2);
        else t.lookAt(t.x + t.w / 2 + fx, t.y + t.h / 2 + fy);
      });
    }
  }

  private updateTroopAttacks() {
    if (!this.dayNight.pvpActive || !this.canFight()) return;

    for (const t of this.troops) {
      const owner = this.agents.find((a) => a.id === t.ownerId);
      if (!owner || owner.player.lives <= 0 || t.attackCd > 0) continue;

      // Barracks troops always fight from the line; followers only when foes press you.
      let foe: Agent | null = null;
      if (t.order === 'garrison') {
        foe = this.nearestFoe(owner, t.def.attackRange + 12);
      } else if (t.order === 'follow') {
        const threat = this.nearestFoe(owner, TROOP_PROTECT_RANGE);
        if (!threat) continue;
        const dx = threat.player.x + threat.player.w / 2 - (t.x + t.w / 2);
        const dy = threat.player.y + threat.player.h / 2 - (t.y + t.h / 2);
        if (Math.hypot(dx, dy) > t.def.attackRange + 8) continue;
        foe = threat;
      } else {
        continue;
      }

      if (!foe) continue;
      const dx = foe.player.x + foe.player.w / 2 - (t.x + t.w / 2);
      const dy = foe.player.y + foe.player.h / 2 - (t.y + t.h / 2);
      if (Math.hypot(dx, dy) > t.def.attackRange) continue;

      t.lookAt(foe.player.x + foe.player.w / 2, foe.player.y + foe.player.h / 2);
      t.attackCd = t.def.attackEvery * owner.player.troopAtkMul;
      this.swings.push({
        x: t.x + t.w / 2,
        y: t.y + t.h / 2,
        angle: Math.atan2(dy, dx),
        range: t.def.attackRange,
        cone: 0.8,
        color: t.def.accent,
        age: 0,
        life: 0.18,
        kind: 'slash',
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
    if (!wasPvp && this.dayNight.pvpActive) {
      this.startPvpMusic();
      if (this.canFight()) {
        this.banner = { text: 'PvP unlocked — fight!', time: BANNER_TIME + 1 };
      }
    }

    const present = new Set(state.players.map((p) => p.id));
    this.agents = this.agents.filter((a) => !a.netId || present.has(a.netId));

    for (const snap of state.players) {
      let agent = this.agents.find((a) => a.netId === snap.id);
      if (!agent) {
        const character = CHARACTERS[snap.character] ?? CHARACTERS[0];
        const controls = this.game.input.slot(0);
        const player = new Player(snap.x, snap.y, controls, this.map, character, this.agents.length);
        player.blocked = (r) => this.obstructs(r);
        const viewW = this.game.width;
        const camera = new Camera(viewW, this.game.height, this.map.width, this.map.height);
        camera.follow(player, Infinity);
        const isLocal = snap.id === this.localNetId;
        const nextId = this.agents.reduce((m, a) => Math.max(m, a.id), -1) + 1;
        agent = {
          id: nextId,
          netId: snap.id,
          player,
          camera,
          controls,
          inventory: { ...snap.inventory },
          score: snap.score,
          building: false,
          recruiting: false,
          trading: false,
          selectedBuilding: 0,
          selectedTroop: 0,
          selectedTrade: 0,
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

      if (agent.remote) {
        const prevLives = agent.player.lives;
        agent.player.lives = snap.alive ? snap.lives : 0;
        if (prevLives > agent.player.lives) agent.player.flashHurt();
        const moved = Math.hypot(snap.x - agent.player.x, snap.y - agent.player.y) > 0.5;
        agent.player.x = snap.x;
        agent.player.y = snap.y;
        agent.player.facing = { x: snap.facingX, y: snap.facingY };
        agent.player.walkTime = moved ? agent.player.walkTime + 1 / 20 : 0;
      } else {
        // Local: accept damage from server; keep upgrade life bonuses above server baseline.
        const serverLives = snap.alive ? snap.lives : 0;
        if (!snap.alive) {
          if (agent.player.lives > 0) agent.player.flashHurt();
          agent.player.lives = 0;
        } else if (serverLives < agent.player.lives) {
          agent.player.lives = serverLives;
          agent.player.flashHurt();
        }
        if (this.eatExpect && agent === this.primaryLocal()) {
          if (agent.inventory[this.eatExpect.id] > this.eatExpect.count) {
            agent.player.hunger = Math.max(0, agent.player.hunger - this.eatExpect.restore);
          }
          this.eatExpect = null;
        }
      }
    }
    this.checkCombatEnd();

    const coinMap = new Map(state.coins.map((c) => [c.id, c]));
    this.coins = this.coins.filter((c) => {
      const id = (c as Coin & { netId?: number }).netId;
      return id != null && coinMap.has(id);
    });
    for (const c of state.coins) {
      let coin = this.coins.find((x) => (x as Coin & { netId?: number }).netId === c.id);
      if (!coin) {
        coin = new Coin(c.x, c.y);
        (coin as Coin & { netId?: number }).netId = c.id;
        this.coins.push(coin);
      } else {
        coin.x = c.x;
        coin.y = c.y;
      }
    }

    const resMap = new Map(state.resources.map((r) => [r.id, r]));
    this.resources = this.resources.filter((r) => {
      const id = (r as Resource & { netId?: number }).netId;
      return id != null && resMap.has(id);
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

    // Reuse houses by netId so produce timers / visuals survive snapshots.
    const nextHouses: House[] = [];
    for (const h of state.houses) {
      const def = BUILDINGS.find((b) => b.id === h.building);
      if (!def) continue;
      const owner = this.agents.find((a) => a.netId === h.ownerId);
      let house = this.houses.find((x) => x.netId === h.id);
      if (!house || house.def.id !== def.id) {
        house = new House(h.x, h.y, def, owner?.id ?? 0);
        house.netId = h.id;
      } else {
        house.x = h.x;
        house.y = h.y;
      }
      if (h.produceProgress != null) house.syncProduceProgress(h.produceProgress);
      nextHouses.push(house);
    }
    this.houses = nextHouses;

    // Troops: server is source of truth for existence/orders; clients simulate movement.
    const nextTroops: Troop[] = [];
    for (const t of state.troops) {
      const def = TROOP_BY_ID[t.troop];
      if (!def) continue;
      const owner = this.agents.find((a) => a.netId === t.ownerId);
      let troop = this.troops.find((x) => x.netId === t.id);
      if (!troop) {
        troop = new Troop(t.x, t.y, def, this.map, nextTroops.length, owner?.id ?? 0);
        troop.netId = t.id;
      }
      troop.order = t.order;
      nextTroops.push(troop);
    }
    this.troops = nextTroops;

    const nextChests: Chest[] = [];
    for (const c of state.chests ?? []) {
      let chest = this.chests.find((x) => x.netId === c.id);
      if (!chest) {
        chest = new Chest(c.x, c.y);
        chest.netId = c.id;
      } else {
        chest.x = c.x;
        chest.y = c.y;
      }
      chest.opened = c.opened;
      nextChests.push(chest);
    }
    if (state.chests) this.chests = nextChests;
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
        this.menuOwner.trading = false;
      }
      agent.building = !agent.building;
      if (agent.building) {
        agent.recruiting = false;
        agent.trading = false;
        this.menuOwner = agent;
      } else if (this.menuOwner === agent) {
        this.menuOwner = null;
      }
    }
    if (!agent.building || this.menuOwner !== agent) return;

    const input = this.game.input;
    const n = BUILD_MENU.length;
    if (agent.selectedBuilding >= n) agent.selectedBuilding = 0;
    const vp = this.agentViewport(agent.id);
    const pad = this.game.input.showTouchUi ? touchBottomPad(vp.vh) : 0;
    const menuLayout = { originX: vp.ox, viewW: vp.vw, viewH: vp.vh - pad };
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
    // Online: server owns production + inventory; progress comes from snapshots.
    if (this.net) {
      this.pullToBuildings(dt);
      return;
    }
    for (const h of this.houses) {
      const produced = h.update(dt);
      if (!produced) continue;
      const amount = h.def.produces?.amount ?? 1;
      const owner = this.agents.find((a) => a.id === h.ownerId) ?? this.agents[0];
      owner.inventory[produced] += amount;
      const def = RESOURCE_BY_ID[produced];
      this.popups.add(`+${amount} ${def.name}`, def.color, h.x + h.w / 2, h.y - 4);
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

  private nearestChest(agent: Agent) {
    const px = agent.player.x + agent.player.w / 2;
    const py = agent.player.y + agent.player.h / 2;
    let best: Chest | null = null;
    let bestDist = INTERACT_RANGE;
    for (const c of this.chests) {
      if (c.opened) continue;
      const d = Math.hypot(px - (c.x + c.w / 2), py - (c.y + c.h / 2));
      if (d < bestDist) {
        best = c;
        bestDist = d;
      }
    }
    return best;
  }

  /** Three treasure chests on the farthest islands from spawn. */
  private spawnChests() {
    const size = CHEST_SIZE;
    const home = this.map.islands[0];
    const farIslands = this.map.islands
      .map((isle, i) => ({ i, dist: Math.hypot(isle.x - home.x, isle.y - home.y) }))
      .filter((e) => e.i !== 0)
      .sort((a, b) => b.dist - a.dist);

    const placed: { x: number; y: number }[] = [];
    const tryPlace = (island: number, minSpread: number) =>
      this.map.randomWalkablePoint(size, (x, y) => {
        if (this.map.islandAt(x + size / 2, y + size / 2) !== island) return false;
        if (!this.isFree(x, y, size)) return false;
        for (const p of placed) {
          if (Math.hypot(x - p.x, y - p.y) < minSpread) return false;
        }
        return true;
      });

    for (const { i: island } of farIslands) {
      if (placed.length >= CHEST_COUNT) break;
      const found = tryPlace(island, CHEST_MIN_SPREAD) ?? tryPlace(island, CHEST_MIN_SPREAD * 0.4);
      if (!found) continue;
      placed.push(found);
      this.chests.push(new Chest(found.x, found.y));
    }

    // Guarantee three chests even if island filters fail.
    while (placed.length < CHEST_COUNT) {
      const found = this.map.randomWalkablePoint(size, (x, y) => {
        if (this.map.islandAt(x + size / 2, y + size / 2) === 0) return false;
        if (!this.isFree(x, y, size)) return false;
        for (const p of placed) {
          if (Math.hypot(x - p.x, y - p.y) < 400) return false;
        }
        return true;
      });
      if (!found) break;
      placed.push(found);
      this.chests.push(new Chest(found.x, found.y));
    }
  }

  private openChest(chest: Chest) {
    if (chest.opened) return;
    if (this.net && chest.netId != null) {
      this.net.send({ type: 'action', action: { kind: 'openChest', chestId: chest.netId } });
      this.popups.add('Treasure!', '#e8c36a', chest.x + chest.w / 2, chest.y - 8);
      return;
    }
    chest.opened = true;
    const cx = chest.x + chest.w / 2;
    const cy = chest.y + chest.h / 2;
    const resSize = CONFIG.resource.size;
    const coinSize = CONFIG.coin.size;

    CHEST_LOOT.forEach((type, i) => {
      const ang = (i / CHEST_LOOT.length) * Math.PI * 2 + 0.4;
      const dist = 34 + (i % 4) * 12;
      let x = cx + Math.cos(ang) * dist - resSize / 2;
      let y = cy + Math.sin(ang) * dist - resSize / 2;
      if (!this.map.isAreaWalkable({ x, y, w: resSize, h: resSize })) {
        x = cx - resSize / 2;
        y = cy - resSize / 2;
      }
      this.resources.push(new Resource(x, y, type));
    });

    for (let i = 0; i < CHEST_COINS; i++) {
      const ang = (i / CHEST_COINS) * Math.PI * 2;
      const dist = 22 + (i % 3) * 10;
      let x = cx + Math.cos(ang) * dist - coinSize / 2;
      let y = cy + Math.sin(ang) * dist - coinSize / 2;
      if (!this.map.isAreaWalkable({ x, y, w: coinSize, h: coinSize })) {
        x = cx - coinSize / 2;
        y = cy - coinSize / 2;
      }
      this.coins.push(new Coin(x, y));
    }

    this.popups.add('Treasure!', '#e8c36a', cx, cy - 8);
  }

  private obstructs(r: Rect) {
    return this.houses.some((h) => overlaps(r, h)) || this.villages.some((v) => v.blocks(r));
  }

  private nearestVillage(agent: Agent) {
    const px = agent.player.x + agent.player.w / 2;
    const py = agent.player.y + agent.player.h / 2;
    let best: Village | null = null;
    let bestDist = VILLAGE_TRADE_RANGE;
    for (const v of this.villages) {
      const d = Math.hypot(px - v.stallX, py - v.stallY);
      if (d < bestDist) {
        best = v;
        bestDist = d;
      }
    }
    return best;
  }

  private openTrade(agent: Agent, village: Village) {
    if (this.menuOwner && this.menuOwner !== agent) {
      this.menuOwner.building = false;
      this.menuOwner.recruiting = false;
      this.menuOwner.trading = false;
    }
    agent.trading = true;
    agent.building = false;
    agent.recruiting = false;
    agent.selectedTrade = Math.min(agent.selectedTrade, village.offers.length - 1);
    this.menuOwner = agent;
  }

  private updateTrade(agent: Agent) {
    if (!agent.trading || this.menuOwner !== agent) return;
    const village = this.nearestVillage(agent);
    if (!village) {
      agent.trading = false;
      if (this.menuOwner === agent) this.menuOwner = null;
      return;
    }
    const n = village.offers.length;
    const buy = () => {
      const offer = village.offers[agent.selectedTrade];
      const px = agent.player.x + agent.player.w / 2;
      const py = agent.player.y;
      if (!canAffordOffer(agent.inventory, offer)) {
        this.popups.add(offer.stock <= 0 ? 'Sold out' : 'Not enough', '#ef5350', px, py);
        return;
      }
      if (this.net) {
        this.net.send({
          type: 'action',
          action: { kind: 'trade', give: { [offer.giveId]: offer.giveN }, get: { [offer.getId]: offer.getN } },
        });
        offer.stock -= 1;
      } else {
        applyOffer(agent.inventory, offer);
      }
      const got = RESOURCE_BY_ID[offer.getId];
      this.popups.add(`+${offer.getN} ${got.name}`, got.color, village.stallX, village.y);
      this.completeQuests(agent, agent.quests.report({ type: 'trade' }));
    };

    const input = this.game.input;
    const vp = this.agentViewport(agent.id);
    const pad = this.game.input.showTouchUi ? touchBottomPad(vp.vh) : 0;
    const menuLayout = { originX: vp.ox, viewW: vp.vw, viewH: vp.vh - pad };
    const tap = input.peekTap();
    if (tap) {
      const hit = tradeMenuCards(n, menuLayout).find((c) => pointIn(tap, c.x, c.y, c.w, c.h));
      if (hit) {
        input.consumeTap();
        agent.selectedTrade = hit.index;
        buy();
        return;
      }
    }
    if (input.wasPressed('KeyQ')) agent.selectedTrade = (agent.selectedTrade + n - 1) % n;
    if (input.wasPressed('KeyE')) agent.selectedTrade = (agent.selectedTrade + 1) % n;
    for (let i = 0; i < n; i++) {
      if (input.wasPressed(`Digit${i + 1}`)) agent.selectedTrade = i;
    }
    if (input.wasPressed('Enter')) buy();
  }

  private interactKeyLabel(agent: Agent) {
    return agent.id === 0 || this.net ? 'F' : 'M';
  }

  private buildKeyLabel(agent: Agent) {
    return agent.id === 0 || this.net ? 'B' : 'K';
  }

  private eatKeyLabel(agent: Agent) {
    return agent.id === 0 || this.net ? 'R' : 'N';
  }

  private tryEat(agent: Agent) {
    if (!agent.controls.eatPressed()) return;
    const px = agent.player.x + agent.player.w / 2;
    const py = agent.player.y;
    if (agent.player.hunger >= 0.995) {
      this.popups.add('Not hungry', '#81c784', px, py);
      return;
    }
    const food = takeFood(agent.inventory);
    if (!food) {
      this.popups.add('No food — pick berries or trade for bread', '#ef5350', px, py);
      return;
    }
    agent.player.feed(food.restore);
    const def = RESOURCE_BY_ID[food.id];
    this.popups.add(`Ate ${def.name}`, def.color, px, py);
    if (this.net) {
      this.eatExpect = { id: food.id, count: agent.inventory[food.id], restore: food.restore };
      this.net.send({ type: 'action', action: { kind: 'eat', id: food.id } });
    }
  }

  private interactHint(agent: Agent, house: House) {
    const key = this.interactKeyLabel(agent);
    const { def } = house;
    if (def.recruits?.length) {
      if (agent.recruiting) return `${key} — Close shop`;
      if (def.id === 'mansion') return `${key} — Hire elite troops`;
      return def.recruits.includes('archer') && def.recruits.length === 1
        ? `${key} — Hire archers`
        : `${key} — Recruit troops`;
    }
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

    if (def.recruits?.length) {
      if (this.menuOwner && this.menuOwner !== agent) {
        this.menuOwner.building = false;
        this.menuOwner.recruiting = false;
      }
      agent.recruiting = true;
      agent.building = false;
      agent.trading = false;
      agent.selectedTroop = Math.min(agent.selectedTroop, def.recruits.length - 1);
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
      const amount = def.produces.amount ?? 1;
      this.popups.add(
        `${def.name}: +${amount} ${res.name} · ${left}s left`,
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

  private chestHintRect(vw: number, vh: number) {
    const lift = inventoryHeight(this.inventoryScale(vw), vw) + 28;
    return { x: vw / 2 - 70, y: vh - lift - 16, w: 140, h: 28 };
  }

  private updateInteract(agent: Agent) {
    // Tap the on-screen F / Open chest button
    if (!agent.building && !agent.recruiting && !agent.trading) {
      const nearChest = this.nearestChest(agent);
      if (nearChest) {
        const tap = this.game.input.peekTap();
        if (tap) {
          const vp = this.agentViewport(agent.id);
          const pad = this.game.input.showTouchUi ? touchBottomPad(vp.vh) : 0;
          const hudH = vp.vh - pad;
          const r = this.chestHintRect(vp.vw, hudH);
          if (pointIn(tap, vp.ox + r.x, vp.oy + r.y, r.w, r.h)) {
            this.game.input.consumeTap();
            this.openChest(nearChest);
            return;
          }
        }
      }
    }

    if (!agent.controls.interactPressed()) {
      // still allow menu nav if recruiting
    } else if (!agent.building) {
      if (agent.recruiting) {
        agent.recruiting = false;
        if (this.menuOwner === agent) this.menuOwner = null;
      } else if (agent.trading) {
        agent.trading = false;
        if (this.menuOwner === agent) this.menuOwner = null;
      } else if (
        this.dayNight.pvpActive &&
        this.canFight() &&
        !this.nearestBuilding(agent) &&
        !this.nearestVillage(agent) &&
        !this.nearestChest(agent)
      ) {
        // Combat uses F / interact; buildings / chests still win if you're standing on one.
      } else {
        const chest = this.nearestChest(agent);
        if (chest) this.openChest(chest);
        else {
          const nearby = this.nearestBuilding(agent);
          if (nearby) this.interactWith(agent, nearby);
          else {
            const village = this.nearestVillage(agent);
            if (village) this.openTrade(agent, village);
          }
        }
      }
    }

    const recruitHut =
      agent.recruiting && this.menuOwner === agent
        ? this.findBuilding(agent, (h) => !!h.def.recruits?.length, INTERACT_RANGE)
        : null;
    if (agent.recruiting && !recruitHut) {
      agent.recruiting = false;
      if (this.menuOwner === agent) this.menuOwner = null;
    }
    this.updateTrade(agent);

    if (!agent.recruiting || !recruitHut || this.menuOwner !== agent) return;

    const pool = troopsFor(recruitHut.def.recruits ?? []);
    if (pool.length === 0) return;
    if (agent.selectedTroop >= pool.length) agent.selectedTroop = 0;

    const input = this.game.input;
    const n = pool.length;
    const hire = () => {
      const def = pool[agent.selectedTroop];
      if (!canAffordTroop(agent.inventory, def)) return;
      if (this.net) {
        if (recruitHut.netId == null) return;
        this.net.send({
          type: 'action',
          action: { kind: 'hire', troop: def.id, hutId: recruitHut.netId },
        });
        this.popups.add(`Hiring ${def.name}…`, def.accent, recruitHut.x + recruitHut.w / 2, recruitHut.y);
        return;
      }
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

    const vp = this.agentViewport(agent.id);
    const pad = this.game.input.showTouchUi ? touchBottomPad(vp.vh) : 0;
    const menuLayout = { originX: vp.ox, viewW: vp.vw, viewH: vp.vh - pad };
    const tap = input.peekTap();
    if (tap) {
      const cards = troopMenuCards(pool, menuLayout);
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
    if (this.obstructs(spot)) return false;
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
    return !this.obstructs({ x, y, w: size, h: size });
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
    const grab = agent.player.collectRect();
    for (const coin of this.coins) {
      if (!overlaps(grab, coin)) continue;
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
    const grab = agent.player.collectRect();
    for (const r of this.resources) {
      if (!overlaps(grab, r)) continue;
      r.alive = false;
      const netId = (r as Resource & { netId?: number }).netId;
      if (this.net && netId != null) {
        this.net.send({ type: 'action', action: { kind: 'collectResource', id: netId } });
      } else {
        let n = 1;
        if (Math.random() < agent.player.resourceLuck) n++;
        agent.inventory[r.type] += n;
        const def = RESOURCE_BY_ID[r.type];
        this.popups.add(`+${n} ${def.name}`, def.color, r.x + r.w / 2, r.y - 4);
        this.completeQuests(agent, agent.quests.report({ type: 'collect', resource: r.type, amount: n }));
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
      for (const agent of this.agents) {
        const vp = this.agentViewport(agent.id);
        this.renderViewport(ctx, agent, vp.ox, vp.oy, vp.vw, vp.vh);
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, h);
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

    if (this.tutorial) {
      this.tutorial.render(ctx, w, h);
      return;
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
            ? 'Tap here for main menu'
            : 'C for main menu',
        w / 2,
        h / 2 + 40,
        16,
        'center',
      );
      ctx.globalAlpha = 1;
    }

    // Draw each player's pad clipped to their screen half.
    if (this.game.input.showTouchUi && !this.paused && !this.tutorial) {
      for (const layout of this.touchLayouts) {
        const slot = layout.slot;
        const axis = this.game.input.getStickAxis(slot);
        const origin = this.stickOrigins[slot];
        const stickActive = origin != null || axis.x !== 0 || axis.y !== 0;
        ctx.save();
        ctx.beginPath();
        ctx.rect(layout.originX, layout.originY, layout.viewW, layout.viewH);
        ctx.clip();
        drawTouchControls(ctx, layout, stickActive ? axis : null, origin);
        ctx.restore();
      }
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
    const { zoom: z, worldW, worldH } = this.worldView(vw, vh);

    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, oy, vw, vh);
    ctx.clip();
    ctx.translate(ox, oy);

    ctx.save();
    ctx.scale(z, z);
    this.map.draw(ctx, cx, cy, worldW, worldH);

    ctx.save();
    ctx.translate(-cx, -cy);
    this.resources.forEach((r) => r.render(ctx));
    this.coins.forEach((c) => c.render(ctx));
    const depth = (s: { y: number; h: number }) => (s instanceof Village ? s.stallY + 16 : s.y + s.h);
    const sprites = [
      ...this.chests,
      ...this.houses,
      ...this.villages,
      ...this.troops,
      ...this.agents.map((a) => a.player),
    ].sort((a, b) => depth(a) - depth(b));
    sprites.forEach((s) => s.render(ctx));
    this.bolts.forEach((b) => b.render(ctx));
    this.renderSwings(ctx);
    if (agent.building && this.menuOwner === agent) this.renderPreview(ctx, agent);
    this.popups.render(ctx);
    ctx.restore();
    ctx.restore();

    this.dayNight.render(ctx, vw, vh);

    const players = this.agents.map((a) => ({
      rect: a.player,
      color: a.player.character.color,
    }));
    drawMinimap(ctx, this.map, agent.camera, agent.player, this.coins, this.houses, {
      originX: 0,
      viewW: vw,
      width: this.minimapWidth(vw),
      players,
      villages: this.villages,
      chests: this.chests.filter((c) => !c.opened),
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
      drawBuildMenu(ctx, agent.inventory, BUILD_MENU[agent.selectedBuilding], menuLayout);
    } else if (agent.recruiting && this.menuOwner === agent) {
      const shop = this.findBuilding(agent, (h) => !!h.def.recruits?.length, INTERACT_RANGE);
      const pool = troopsFor(shop?.def.recruits ?? []);
      if (pool.length) {
        const sel = pool[Math.min(agent.selectedTroop, pool.length - 1)];
        drawTroopMenu(ctx, agent.inventory, pool, sel, menuLayout);
      }
    } else if (agent.trading && this.menuOwner === agent) {
      const village = this.nearestVillage(agent);
      if (village) {
        drawTradeMenu(
          ctx,
          agent.inventory,
          village.offers,
          agent.selectedTrade,
          village.name,
          menuLayout,
        );
      }
    } else {
      drawInventory(ctx, agent.inventory, {
        originX: 0,
        viewW: vw,
        viewH: hudH,
        scale: this.inventoryScale(vw),
      });
      this.renderInteractHint(ctx, agent, vw, hudH);
    }

    drawText(ctx, this.splitScreen ? (agent.id === 0 ? 'P1' : 'P2') : '', 12, vh - 8, 12);

    ctx.restore();
  }

  private renderSwings(ctx: CanvasRenderingContext2D) {
    for (const s of this.swings) drawSwingFx(ctx, s);
  }

  private renderPreview(ctx: CanvasRenderingContext2D, agent: Agent) {
    const def = BUILD_MENU[agent.selectedBuilding];
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
    const minimapW = this.minimapWidth(vw);
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
    const lift = inventoryHeight(this.inventoryScale(vw), vw) + 28;
    const chest = this.nearestChest(agent);
    if (chest) {
      const r = this.chestHintRect(vw, vh);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 8);
      ctx.fill();
      ctx.strokeStyle = '#ffd54f';
      ctx.lineWidth = 2;
      ctx.stroke();
      drawText(ctx, 'F — Open chest', vw / 2, vh - lift, 13, 'center');
      return;
    }
    const nearby = this.nearestBuilding(agent);
    if (nearby) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.beginPath();
      ctx.roundRect(vw / 2 - 110, vh - lift - 16, 220, 28, 8);
      ctx.fill();
      drawText(ctx, this.interactHint(agent, nearby), vw / 2, vh - lift, 13, 'center');
      return;
    }
    const village = this.nearestVillage(agent);
    if (village) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.beginPath();
      ctx.roundRect(vw / 2 - 150, vh - lift - 16, 300, 28, 8);
      ctx.fill();
      drawText(
        ctx,
        `${this.interactKeyLabel(agent)} — Trade at ${village.name}  ·  bread`,
        vw / 2,
        vh - lift,
        13,
        'center',
      );
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
      `H:${this.houses.length} ${troopLabel} · ${this.buildKeyLabel(agent)}/${this.interactKeyLabel(agent)} · ${this.eatKeyLabel(agent)} eat`,
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

    const hunger = agent.player.hunger;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(12, 78, barW, 7);
    ctx.fillStyle = hungerColor(hunger);
    ctx.fillRect(12, 78, barW * hunger, 7);

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
      const c = agent.player.combat;
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
