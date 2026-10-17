export type PlayerSlot = 0 | 1;

/** Per-player controls used by Player and PlayScene menus. */
export interface PlayerControls {
  axis(): { x: number; y: number };
  interactPressed(): boolean;
  buildPressed(): boolean;
  blinkPressed(): boolean;
}

const P1_MOVE = { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS' } as const;
const P2_MOVE = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' } as const;

const ACTION_KEYS: Record<string, string> = {
  interact: 'KeyF',
  build: 'KeyB',
  blink: 'Space',
  pause: 'Escape',
  confirm: 'Enter',
};

export interface Point {
  x: number;
  y: number;
}

type StickHandler = {
  contains(x: number, y: number): boolean;
  setAxis(axis: Point | null): void;
};

type ButtonHandler = {
  contains(x: number, y: number): boolean;
  action: string;
};

/**
 * Keyboard + pointer input. Touch devices get a virtual stick/buttons via
 * {@link setTouchHandlers}; menus use {@link consumeTap} / {@link tapIn}.
 */
export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();
  private taps: Point[] = [];
  private stickAxis: Point = { x: 0, y: 0 };
  private stickPointerId: number | null = null;
  private buttonPointers = new Map<number, string>();
  private pendingTap: { id: number; x: number; y: number } | null = null;
  private stickHandler: StickHandler | null = null;
  private buttonHandlers: ButtonHandler[] = [];
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
      this.clearStick();
    });

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.style.touchAction = 'none';
  }

  /** Enable/disable on-screen stick & buttons (PlayScene). */
  setTouchUi(enabled: boolean) {
    this.touchUi = enabled && this.touchPreferred;
    if (!this.touchUi) {
      this.stickHandler = null;
      this.buttonHandlers = [];
      this.clearStick();
    }
  }

  get showTouchUi() {
    return this.touchUi;
  }

  setTouchHandlers(stick: StickHandler | null, buttons: ButtonHandler[]) {
    this.stickHandler = stick;
    this.buttonHandlers = buttons;
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
      for (const b of this.buttonHandlers) {
        if (b.contains(p.x, p.y)) {
          const code = ACTION_KEYS[b.action] ?? b.action;
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
      if (this.stickHandler?.contains(p.x, p.y)) {
        this.stickPointerId = e.pointerId;
        this.stickHandler.setAxis(p);
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
    if (e.pointerId === this.stickPointerId) {
      this.stickHandler?.setAxis(p);
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

    if (e.pointerId === this.stickPointerId) {
      this.clearStick();
      e.preventDefault();
      return;
    }

    if (this.pendingTap && this.pendingTap.id === e.pointerId) {
      this.taps.push({ x: this.pendingTap.x, y: this.pendingTap.y });
      this.pendingTap = null;
    }
  };

  private clearStick() {
    this.stickPointerId = null;
    this.stickAxis = { x: 0, y: 0 };
    this.stickHandler?.setAxis(null);
  }

  /** Used by TouchControls stick handler to push axis into Input. */
  setStickAxis(axis: Point | null) {
    this.stickAxis = axis ?? { x: 0, y: 0 };
  }

  getStickAxis(): Point {
    return this.stickAxis;
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

  /** Combined WASD + arrows + virtual stick (menus / solo). */
  axis() {
    if (this.stickPointerId != null || (this.stickAxis.x !== 0 || this.stickAxis.y !== 0)) {
      return { ...this.stickAxis };
    }
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
    };
  }

  /** Controls for local co-op slot 0 (WASD + touch) or 1 (arrows). */
  slot(slot: PlayerSlot): PlayerControls {
    if (slot === 0) {
      return {
        axis: () => {
          if (this.stickPointerId != null || this.stickAxis.x !== 0 || this.stickAxis.y !== 0) {
            return { ...this.stickAxis };
          }
          return this.axisFrom(P1_MOVE.left, P1_MOVE.right, P1_MOVE.up, P1_MOVE.down);
        },
        interactPressed: () => this.wasPressed('KeyF'),
        buildPressed: () => this.wasPressed('KeyB'),
        blinkPressed: () => this.wasPressed('Space'),
      };
    }
    return {
      axis: () => this.axisFrom(P2_MOVE.left, P2_MOVE.right, P2_MOVE.up, P2_MOVE.down),
      interactPressed: () => this.wasPressed('KeyM'),
      buildPressed: () => this.wasPressed('KeyK'),
      blinkPressed: () => this.wasPressed('ShiftRight'),
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
