import { CONFIG } from '@/config';

const PHASE = CONFIG.dayNightPhase;
const FULL_DAY = PHASE * 2;
/** Soft dusk / dawn window at each phase boundary. */
const FADE = 45;

export class DayNight {
  private elapsed = 0;
  private wasNight = false;
  private wasPvp = false;

  /** Advances the clock. Returns phase flip and/or PvP unlock. */
  update(dt: number): { phase: 'Day' | 'Night' | null; pvpUnlocked: boolean } {
    this.elapsed += dt;
    let phase: 'Day' | 'Night' | null = null;
    const night = this.isNight;
    if (night !== this.wasNight) {
      this.wasNight = night;
      phase = night ? 'Night' : 'Day';
    }
    const pvpUnlocked = this.pvpActive && !this.wasPvp;
    if (this.pvpActive) this.wasPvp = true;
    return { phase, pvpUnlocked };
  }

  /** Sync from the multiplayer server clock. */
  setElapsed(seconds: number) {
    this.elapsed = Math.max(0, seconds);
    this.wasNight = this.isNight;
    if (this.pvpActive) this.wasPvp = true;
  }

  get isNight() {
    return Math.floor(this.elapsed / PHASE) % 2 === 1;
  }

  get label() {
    return this.isNight ? 'Night' : 'Day';
  }

  /** Completed day+night cycles (0, 1, 2…). */
  get fullDays() {
    return Math.floor(this.elapsed / FULL_DAY);
  }

  get pvpActive() {
    return this.fullDays >= CONFIG.pvpAfterFullDays;
  }

  /** Seconds until PvP unlocks (0 when active). */
  get untilPvp() {
    if (this.pvpActive) return 0;
    return CONFIG.pvpAfterFullDays * FULL_DAY - this.elapsed;
  }

  /** Seconds left in the current day or night phase. */
  get remaining() {
    return PHASE - (this.elapsed % PHASE);
  }

  /** 0 = full day light, 1 = full night. */
  get darkness() {
    const cycle = FULL_DAY;
    const t = this.elapsed % cycle;
    if (t < PHASE - FADE) return 0;
    if (t < PHASE) return (t - (PHASE - FADE)) / FADE;
    if (t < cycle - FADE) return 1;
    return 1 - (t - (cycle - FADE)) / FADE;
  }

  /** Screen tint over the world (drawn before HUD). */
  render(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const d = this.darkness;
    if (d <= 0) return;

    // Warm dusk into cool night — softer than a flat blue wash.
    if (d < 0.5) {
      ctx.fillStyle = `rgba(48, 28, 18, ${d * 0.35})`;
    } else {
      ctx.fillStyle = `rgba(12, 18, 32, ${(d - 0.15) * 0.52})`;
    }
    ctx.fillRect(0, 0, w, h);

    if (d > 0.45) {
      ctx.save();
      ctx.globalAlpha = (d - 0.45) * 0.45;
      ctx.fillStyle = '#d8e0ea';
      for (let i = 0; i < 18; i++) {
        const x = (((i * 97 + 41) % 1000) / 1000) * w;
        const y = (((i * 53 + 17) % 1000) / 1000) * h * 0.5;
        const r = 0.45 + (i % 3) * 0.25;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}

export function formatClock(seconds: number) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}
