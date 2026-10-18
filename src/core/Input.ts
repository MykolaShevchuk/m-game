export type PlayerSlot = 0 | 1;

/** Per-player controls used by Player and PlayScene menus. */
export interface PlayerControls {
  axis(): { x: number; y: number };
  interactPressed(): boolean;
  buildPressed(): boolean;
  blinkPressed(): boolean;
  eatPressed(): boolean;
}

const P1_MOVE = { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS' } as const;
const P2_MOVE = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' } as const;

/** Touch action → key code per local player slot. */
const SLOT_ACTIONS: Record<PlayerSlot, Record<string, string>> = {
  0: {
    interact: 'KeyF',
    build: 'KeyB',
    blink: 'Space',
    eat: 'KeyR',
    pause: 'Escape',
    confirm: 'Enter',
  },
  1: {
    interact: 'KeyM',
    build: 'KeyK',
    blink: 'ShiftRight',
    eat: 'KeyN',
    pause: 'Escape',
    confirm: 'Enter',
  },
};

export interface Point {
  x: number;
  y: number;
}

export type StickHandler = {
  contains(x: number, y: number): boolean;
  setAxis(axis: Point | null): void;
};

export type ButtonHandler = {
  contains(x: number, y: number): boolean;
  action: string;
};

export type TouchPadHandler = {
  slot: PlayerSlot;
  stick: StickHandler;
  buttons: ButtonHandler[];
};

/**
 * Keyboard + pointer input. Touch devices get virtual stick/buttons via
 * {@link setTouchPads}; menus use {@link consumeTap} / {@link tapIn}.
 */
export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();
  private taps: Point[] = [];
  private stickAxes: [Point, Point] = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ];
  /** pointerId → which player's stick is dragging. */
  private stickPointers = new Map<number, PlayerSlot>();
  private buttonPointers = new Map<number, string>();
  private pendingTap: { id: number; x: number; y: number } | null = null;
  private pads: TouchPadHandler[] = [];
  private touchUi = false;

  readonly touchPreferred: boolean;

  constructor(
    private canvas: HTMLCanvasElement,
    target: Window = window,
  ) {
    // Don't use `'ontouchstart' in window` — Chrome desktop defines that even
    // without a touch screen, which wrongly shows virtual stick/buttons.
    this.touchPreferred =
      (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
      window.matchMedia('(pointer: coarse)').matches;

    target.addEventListener('keydown', (e) => {
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    });
    target.addEventListener('keyup', (e) => this.down.delete(e.code));
    target.addEventListener('blur', () => {
      this.down.clear();
      this.clearAllSticks();
    });

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.style.touchAction = 'none';
  }

  /**
   * Enable/disable on-screen sticks & buttons (PlayScene).
   * Pass `force: true` so pads show even on desktop (needed for local split-screen).
   */
  setTouchUi(enabled: boolean, opts: { force?: boolean } = {}) {
    if (!enabled) {
      this.touchUi = false;
      this.pads = [];
      this.clearAllSticks();
      return;
    }
    this.touchUi = this.touchPreferred || !!opts.force;
    if (!this.touchUi) {
      this.pads = [];
      this.clearAllSticks();
    }
  }

  get showTouchUi() {
    return this.touchUi;
  }

  /** One pad per local player (solo = 1, split co-op = 2). */
  setTouchPads(pads: TouchPadHandler[]) {
    this.pads = pads;
  }

  /** @deprecated Prefer {@link setTouchPads}. */
  setTouchHandlers(stick: StickHandler | null, buttons: ButtonHandler[]) {
    this.pads = stick ? [{ slot: 0, stick, buttons }] : [];
  }

  private toCanvas(e: PointerEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    const sx = this.canvas.width / rect.width;
    const sy = this.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * sx,
      y: (e.clientY - rect.top) * sy,
    };
  }

  private onPointerDown = (e: PointerEvent) => {
    const p = this.toCanvas(e);
    if (this.touchUi) {
      for (const pad of this.pads) {
        for (const b of pad.buttons) {
          if (!b.contains(p.x, p.y)) continue;
          const code = SLOT_ACTIONS[pad.slot][b.action] ?? b.action;
          if (!this.down.has(code)) this.pressed.add(code);
          this.down.add(code);
          this.buttonPointers.set(e.pointerId, code);
          try {
            this.canvas.setPointerCapture(e.pointerId);
          } catch {
            /* synthetic / unsupported */
          }
          e.preventDefault();
          return;
        }
      }
      for (const pad of this.pads) {
        if (!pad.stick.contains(p.x, p.y)) continue;
        // One stick finger per player.
        for (const [, slot] of this.stickPointers) {
          if (slot === pad.slot) return;
        }
        this.stickPointers.set(e.pointerId, pad.slot);
        pad.stick.setAxis(p);
        try {
          this.canvas.setPointerCapture(e.pointerId);
        } catch {
          /* synthetic / unsupported */
        }
        e.preventDefault();
        return;
      }
    }

    this.pendingTap = { id: e.pointerId, x: p.x, y: p.y };
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic / unsupported */
    }
    e.preventDefault();
  };

  private onPointerMove = (e: PointerEvent) => {
    const p = this.toCanvas(e);
    const slot = this.stickPointers.get(e.pointerId);
    if (slot != null) {
      const pad = this.pads.find((t) => t.slot === slot);
      pad?.stick.setAxis(p);
      e.preventDefault();
      return;
    }
    if (this.pendingTap && this.pendingTap.id === e.pointerId) {
      const dx = p.x - this.pendingTap.x;
      const dy = p.y - this.pendingTap.y;
      if (dx * dx + dy * dy > 20 * 20) this.pendingTap = null;
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    const btn = this.buttonPointers.get(e.pointerId);
    if (btn) {
      this.down.delete(btn);
      this.buttonPointers.delete(e.pointerId);
    }

    const slot = this.stickPointers.get(e.pointerId);
    if (slot != null) {
      this.clearStick(slot, e.pointerId);
      e.preventDefault();
      return;
    }

    if (this.pendingTap && this.pendingTap.id === e.pointerId) {
      this.taps.push({ x: this.pendingTap.x, y: this.pendingTap.y });
      this.pendingTap = null;
    }
  };

  private clearStick(slot: PlayerSlot, pointerId?: number) {
    if (pointerId != null) this.stickPointers.delete(pointerId);
    else {
      for (const [id, s] of [...this.stickPointers]) {
        if (s === slot) this.stickPointers.delete(id);
      }
    }
    this.stickAxes[slot] = { x: 0, y: 0 };
    const pad = this.pads.find((t) => t.slot === slot);
    pad?.stick.setAxis(null);
  }

  private clearAllSticks() {
    this.stickPointers.clear();
    this.stickAxes = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ];
    for (const pad of this.pads) pad.stick.setAxis(null);
  }

  /** Push stick axis for a player pad. */
  setStickAxis(slot: PlayerSlot, axis: Point | null) {
    this.stickAxes[slot] = axis ?? { x: 0, y: 0 };
  }

  getStickAxis(slot: PlayerSlot = 0): Point {
    return this.stickAxes[slot];
  }

  isDown(...codes: string[]) {
    return codes.some((c) => this.down.has(c));
  }

  wasPressed(...codes: string[]) {
    return codes.some((c) => this.pressed.has(c));
  }

  /** Next tap in canvas coords, or null. */
  consumeTap(): Point | null {
    return this.taps.shift() ?? null;
  }

  /** True if a tap landed inside the rect this frame (consumes matching tap). */
  tapIn(x: number, y: number, w: number, h: number): boolean {
    const i = this.taps.findIndex((t) => t.x >= x && t.x <= x + w && t.y >= y && t.y <= y + h);
    if (i < 0) return false;
    this.taps.splice(i, 1);
    return true;
  }

  /** Peek without consuming — useful when several regions share a frame. */
  peekTap(): Point | null {
    return this.taps[0] ?? null;
  }

  private stickActive(slot: PlayerSlot) {
    const a = this.stickAxes[slot];
    if (a.x !== 0 || a.y !== 0) return true;
    for (const [, s] of this.stickPointers) if (s === slot) return true;
    return false;
  }

  /** Combined WASD + arrows + P1 stick (menus / solo). */
  axis() {
    if (this.stickActive(0)) return { ...this.stickAxes[0] };
    return this.axisFrom(
      P1_MOVE.left,
      P1_MOVE.right,
      P1_MOVE.up,
      P1_MOVE.down,
      P2_MOVE.left,
      P2_MOVE.right,
      P2_MOVE.up,
      P2_MOVE.down,
    );
  }

  /** Solo / online: WASD or arrows or stick, F interact, B build. */
  solo(): PlayerControls {
    return {
      axis: () => this.axis(),
      interactPressed: () => this.wasPressed('KeyF'),
      buildPressed: () => this.wasPressed('KeyB'),
      blinkPressed: () => this.wasPressed('Space'),
      eatPressed: () => this.wasPressed('KeyR'),
    };
  }

  /** Controls for local co-op slot 0 or 1 (keyboard + that player's touch pad). */
  slot(slot: PlayerSlot): PlayerControls {
    if (slot === 0) {
      return {
        axis: () => {
          if (this.stickActive(0)) return { ...this.stickAxes[0] };
          return this.axisFrom(P1_MOVE.left, P1_MOVE.right, P1_MOVE.up, P1_MOVE.down);
        },
        interactPressed: () => this.wasPressed('KeyF'),
        buildPressed: () => this.wasPressed('KeyB'),
        blinkPressed: () => this.wasPressed('Space'),
        eatPressed: () => this.wasPressed('KeyR'),
      };
    }
    return {
      axis: () => {
        if (this.stickActive(1)) return { ...this.stickAxes[1] };
        return this.axisFrom(P2_MOVE.left, P2_MOVE.right, P2_MOVE.up, P2_MOVE.down);
      },
      interactPressed: () => this.wasPressed('KeyM'),
      buildPressed: () => this.wasPressed('KeyK'),
      blinkPressed: () => this.wasPressed('ShiftRight'),
      eatPressed: () => this.wasPressed('KeyN'),
    };
  }

  private axisFrom(...codes: string[]) {
    let x = 0;
    let y = 0;
    for (let i = 0; i < codes.length; i += 4) {
      if (this.isDown(codes[i])) x -= 1;
      if (this.isDown(codes[i + 1])) x += 1;
      if (this.isDown(codes[i + 2])) y -= 1;
      if (this.isDown(codes[i + 3])) y += 1;
    }
    const len = Math.hypot(x, y) || 1;
    return { x: x / len, y: y / len };
  }

  endFrame() {
    this.pressed.clear();
    this.taps.length = 0;
  }
}
