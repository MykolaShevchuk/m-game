import type { Input } from '@/core/Input';
import { pointIn } from './hit';
import { drawText } from './text';

interface TutorialPage {
  kicker: string;
  title: string;
  lines: string[];
  binds?: { keys: string; label: string }[];
}

const PAGES: TutorialPage[] = [
  {
    kicker: 'Step 1 of 4',
    title: 'Gather resources to build a hut',
    lines: [
      'Walk the islands and pick up wood, stone, berries, and other finds.',
      'A Hut costs wood and stone — fill your inventory first.',
    ],
  },
  {
    kicker: 'Step 2 of 4',
    title: 'Hire troops to protect you',
    lines: [
      'Press B to open the build menu and place a Hut.',
      'Stand next to it and press F to hire troops. They follow and guard you.',
    ],
  },
  {
    kicker: 'Step 3 of 4',
    title: 'Wait until 2 days pass',
    lines: [
      'Each day and each night lasts 3 minutes.',
      'After two full days (day + night, twice), PvP unlocks.',
    ],
  },
  {
    kicker: 'Step 4 of 4',
    title: 'Fight',
    lines: [
      'When the banner says “PvP unlocked — fight!”, press F to attack.',
      'Last player standing wins.',
    ],
  },
  {
    kicker: 'Controls',
    title: 'Key binds',
    lines: ['Pause anytime with Esc. Player 2 uses the second key in each pair.'],
    binds: [
      { keys: 'WASD', label: 'Move · P1' },
      { keys: 'Arrows', label: 'Move · P2' },
      { keys: 'F / M', label: 'Interact / fight' },
      { keys: 'B / K', label: 'Build' },
      { keys: 'R / N', label: 'Eat food' },
      { keys: 'Space / Shift', label: 'Blink' },
      { keys: 'Q E · 1–5', label: 'Menu pick' },
      { keys: 'Enter', label: 'Confirm' },
      { keys: 'Esc', label: 'Pause' },
    ],
  },
];

/** First-play how-to. Returns true from update() when the player is finished. */
export class Tutorial {
  private page = 0;

  update(input: Input, w: number, h: number) {
    if (input.wasPressed('Escape')) return true;

    const L = this.layout(w, h);
    const tap = input.peekTap();
    if (tap) {
      if (pointIn(tap, L.skipX, L.skipY, L.skipW, L.skipH)) {
        input.consumeTap();
        return true;
      }
      input.consumeTap();
      return this.advance();
    }

    if (input.wasPressed('Enter', 'Space')) return this.advance();
    return false;
  }

  render(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const page = PAGES[this.page];
    if (!page) return;
    const L = this.layout(w, h);
    const touch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

    ctx.fillStyle = 'rgba(8, 10, 16, 0.72)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(22, 26, 34, 0.96)';
    ctx.strokeStyle = '#ffd54f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(L.x, L.y, L.w, L.h, 14);
    ctx.fill();
    ctx.stroke();

    drawText(ctx, 'HOW TO PLAY', w / 2, L.y + 28, 13, 'center');
    ctx.globalAlpha = 0.7;
    drawText(ctx, page.kicker, w / 2, L.y + 50, 12, 'center');
    ctx.globalAlpha = 1;
    drawText(ctx, page.title, w / 2, L.y + 82, L.narrow ? 20 : 24, 'center');

    let y = L.y + 118;
    ctx.globalAlpha = 0.88;
    for (const line of page.lines) {
      wrapText(ctx, line, w / 2, y, L.w - 48, L.narrow ? 14 : 15);
      y += lineHeight(ctx, line, L.w - 48, L.narrow ? 14 : 15) + 6;
    }
    ctx.globalAlpha = 1;

    if (page.binds) {
      y += 8;
      const colW = L.narrow ? L.w - 48 : (L.w - 64) / 2;
      const left = L.x + 24;
      const right = L.x + L.w / 2 + 4;
      page.binds.forEach((b, i) => {
        const col = L.narrow ? 0 : i % 2;
        const row = L.narrow ? i : Math.floor(i / 2);
        const bx = col === 0 ? left : right;
        const by = y + row * 28;
        ctx.fillStyle = 'rgba(255, 213, 79, 0.12)';
        ctx.beginPath();
        ctx.roundRect(bx, by - 11, colW, 24, 6);
        ctx.fill();
        ctx.fillStyle = '#ffd54f';
        ctx.font = '12px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.keys, bx + 10, by);
        drawText(ctx, b.label, bx + colW - 10, by, 12, 'right');
      });
    }

    const dotsY = L.y + L.h - 48;
    PAGES.forEach((_, i) => {
      ctx.beginPath();
      ctx.fillStyle = i === this.page ? '#ffd54f' : 'rgba(255, 255, 255, 0.22)';
      ctx.arc(w / 2 - ((PAGES.length - 1) * 10) / 2 + i * 10, dotsY, i === this.page ? 4 : 3, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.globalAlpha = 0.55;
    drawText(ctx, 'Skip', L.skipX + L.skipW / 2, L.skipY + L.skipH / 2, 12, 'center');
    ctx.globalAlpha = 0.9;
    drawText(
      ctx,
      this.page === PAGES.length - 1
        ? touch
          ? 'Tap to start'
          : 'Enter to start'
        : touch
          ? 'Tap to continue'
          : 'Enter to continue',
      w / 2,
      L.y + L.h - 22,
      13,
      'center',
    );
    ctx.globalAlpha = 1;
  }

  private advance() {
    this.page++;
    return this.page >= PAGES.length;
  }

  private layout(w: number, h: number) {
    const narrow = w < 640;
    const page = PAGES[this.page];
    const cardW = Math.min(page?.binds ? 580 : 480, w - 32);
    const bindRows = page?.binds ? (narrow ? page.binds.length : Math.ceil(page.binds.length / 2)) : 0;
    const cardH = Math.min(page?.binds ? 196 + bindRows * 30 + 72 : 250, h - 24);
    const x = (w - cardW) / 2;
    const y = (h - cardH) / 2;
    return {
      narrow,
      x,
      y,
      w: cardW,
      h: cardH,
      skipX: x + cardW - 72,
      skipY: y + 12,
      skipW: 56,
      skipH: 24,
    };
  }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  maxW: number,
  size: number,
) {
  const lines = breakLines(ctx, text, maxW, size);
  lines.forEach((line, i) => drawText(ctx, line, cx, y + i * (size + 4), size, 'center'));
}

function lineHeight(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number) {
  return breakLines(ctx, text, maxW, size).length * (size + 4);
}

function breakLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number) {
  ctx.font = `${size}px system-ui, sans-serif`;
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(next).width > maxW && cur) {
      lines.push(cur);
      cur = word;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
