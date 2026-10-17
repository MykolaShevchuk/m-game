export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();

  constructor(target: Window) {
    target.addEventListener('keydown', (e) => {
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    target.addEventListener('keyup', (e) => this.down.delete(e.code));
    target.addEventListener('blur', () => this.down.clear());
  }

  isDown(...codes: string[]) {
    return codes.some((c) => this.down.has(c));
  }

  wasPressed(...codes: string[]) {
    return codes.some((c) => this.pressed.has(c));
  }

  /** Returns a normalized movement vector from WASD / arrow keys. */
  axis() {
    let x = 0;
    let y = 0;
    if (this.isDown('ArrowLeft', 'KeyA')) x -= 1;
    if (this.isDown('ArrowRight', 'KeyD')) x += 1;
    if (this.isDown('ArrowUp', 'KeyW')) y -= 1;
    if (this.isDown('ArrowDown', 'KeyS')) y += 1;
    const len = Math.hypot(x, y) || 1;
    return { x: x / len, y: y / len };
  }

  endFrame() {
    this.pressed.clear();
  }
}
