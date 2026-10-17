export interface Scene {
  enter?(): void;
  exit?(): void;
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
}

export class SceneManager {
  private current: Scene | null = null;

  switch(next: Scene) {
    this.current?.exit?.();
    this.current = next;
    next.enter?.();
  }

  update(dt: number) {
    this.current?.update(dt);
  }

  render(ctx: CanvasRenderingContext2D) {
    this.current?.render(ctx);
  }
}
