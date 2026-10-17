import { questProgressLabel, rewardList, type QuestDef } from '@/quests';
import { drawResource } from './drawResource';
import { drawText } from './text';

const PAD = 10;
const ICON = 14;

/** Compact active-quest card for the HUD. */
export function drawQuestPanel(
  ctx: CanvasRenderingContext2D,
  quest: QuestDef | null,
  progress: number,
  x: number,
  y: number,
) {
  if (!quest) {
    const w = 200;
    const h = 44;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    drawText(ctx, 'Quests complete!', x + PAD, y + 18, 13);
    ctx.globalAlpha = 0.7;
    drawText(ctx, 'All rewards claimed', x + PAD, y + 34, 11);
    ctx.globalAlpha = 1;
    return;
  }

  const rewards = rewardList(quest.reward);
  const w = 220;
  const h = 58 + (rewards.length > 0 ? 18 : 0);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();

  drawText(ctx, 'Quest', x + PAD, y + 14, 11);
  ctx.globalAlpha = 0.75;
  drawText(ctx, questProgressLabel(quest, progress), x + w - PAD, y + 14, 11, 'right');
  ctx.globalAlpha = 1;
  drawText(ctx, quest.title, x + PAD, y + 32, 14);
  ctx.globalAlpha = 0.8;
  drawText(ctx, quest.description, x + PAD, y + 48, 12);
  ctx.globalAlpha = 1;

  if (rewards.length === 0) return;
  let rx = x + PAD;
  const ry = y + 66;
  ctx.globalAlpha = 0.7;
  drawText(ctx, 'Reward', rx, ry, 11);
  ctx.globalAlpha = 1;
  rx += 48;
  for (const [id, n] of rewards) {
    drawResource(ctx, id, rx + ICON / 2, ry, ICON);
    drawText(ctx, String(n), rx + ICON + 3, ry + 1, 12);
    rx += 36;
  }
}
