import { loadMusicEnabled } from '@/core/storage';

/** Lightweight looping BGM helper. */
export class Music {
  private audio: HTMLAudioElement | null = null;
  private playing = false;

  constructor(
    private readonly src: string,
    private readonly volume = 0.45,
  ) {}

  /** Start looping. Safe to call more than once. Honors the settings mute. */
  async play() {
    if (this.playing) return;
    if (!loadMusicEnabled()) return;
    if (!this.audio) {
      this.audio = new Audio(this.src);
      this.audio.loop = true;
      this.audio.volume = this.volume;
      this.audio.preload = 'auto';
    }
    try {
      await this.audio.play();
      this.playing = true;
    } catch {
      // Autoplay may be blocked until the next user gesture.
    }
  }

  /** Fade out briefly, then stop. */
  stop(fadeMs = 900) {
    if (!this.audio || !this.playing) {
      this.playing = false;
      return;
    }
    const el = this.audio;
    this.playing = false;
    const start = el.volume;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / fadeMs);
      el.volume = start * (1 - t);
      if (t < 1) {
        requestAnimationFrame(tick);
        return;
      }
      el.pause();
      el.currentTime = 0;
      el.volume = start;
    };
    requestAnimationFrame(tick);
  }

  get isPlaying() {
    return this.playing;
  }
}
