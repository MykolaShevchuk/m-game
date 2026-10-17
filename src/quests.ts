import type { BuildingId } from '@/buildings';
import type { Inventory, ResourceId } from '@/resources';
import type { TroopId } from '@/troops';

export type QuestGoal =
  | { kind: 'collect'; resource: ResourceId; count: number }
  | { kind: 'score'; count: number }
  | { kind: 'build'; building?: BuildingId; count: number }
  | { kind: 'hire'; troop?: TroopId; count: number }
  | { kind: 'islands'; count: number }
  | { kind: 'nights'; count: number };

export interface QuestDef {
  id: string;
  title: string;
  description: string;
  goal: QuestGoal;
  reward: Partial<Record<ResourceId, number>>;
}

export const QUESTS: QuestDef[] = [
  {
    id: 'gather-wood',
    title: 'First Timber',
    description: 'Collect 8 wood',
    goal: { kind: 'collect', resource: 'wood', count: 8 },
    reward: { stone: 4, berries: 3 },
  },
  {
    id: 'build-hut',
    title: 'Raise a Hut',
    description: 'Build a Hut',
    goal: { kind: 'build', building: 'hut', count: 1 },
    reward: { wood: 6, stone: 3 },
  },
  {
    id: 'hire-scout',
    title: 'Find Company',
    description: 'Hire a Scout',
    goal: { kind: 'hire', troop: 'scout', count: 1 },
    reward: { wood: 5, berries: 4 },
  },
  {
    id: 'score-30',
    title: 'Coin Purse',
    description: 'Reach 30 score',
    goal: { kind: 'score', count: 30 },
    reward: { stone: 5, wood: 5 },
  },
  {
    id: 'explore-3',
    title: 'Island Hopper',
    description: 'Discover 3 islands',
    goal: { kind: 'islands', count: 3 },
    reward: { crystal: 2, shell: 3 },
  },
  {
    id: 'build-cottage',
    title: 'Homestead',
    description: 'Build a Cottage',
    goal: { kind: 'build', building: 'cottage', count: 1 },
    reward: { wood: 8, stone: 4 },
  },
  {
    id: 'survive-night',
    title: 'Through the Dark',
    description: 'Survive 1 nightfall',
    goal: { kind: 'nights', count: 1 },
    reward: { wood: 6, stone: 6, berries: 4 },
  },
  {
    id: 'hire-two',
    title: 'Small Band',
    description: 'Hire 2 troops',
    goal: { kind: 'hire', count: 2 },
    reward: { stone: 6, wood: 4 },
  },
  {
    id: 'explore-6',
    title: 'Cartographer',
    description: 'Discover 6 islands',
    goal: { kind: 'islands', count: 6 },
    reward: { crystal: 3, obsidian: 2 },
  },
  {
    id: 'score-80',
    title: 'Treasure Run',
    description: 'Reach 80 score',
    goal: { kind: 'score', count: 80 },
    reward: { crystal: 3, obsidian: 3, wood: 8 },
  },
];

export const rewardList = (reward: QuestDef['reward']) =>
  (Object.entries(reward) as [ResourceId, number][]).filter(([, n]) => n > 0);

export function grantReward(inventory: Inventory, reward: QuestDef['reward']) {
  for (const [id, n] of rewardList(reward)) inventory[id] += n;
}

export function goalTarget(goal: QuestGoal) {
  return goal.count;
}

export function questProgressLabel(def: QuestDef, progress: number) {
  const target = goalTarget(def.goal);
  return `${Math.min(progress, target)}/${target}`;
}

export type QuestEvent =
  | { type: 'collect'; resource: ResourceId; amount?: number }
  | { type: 'score'; total: number }
  | { type: 'build'; building: BuildingId }
  | { type: 'hire'; troop: TroopId }
  | { type: 'islands'; total: number }
  | { type: 'night' };

/** Advances through QUESTS one at a time; returns completed quests when a goal is met. */
export class QuestTracker {
  private index = 0;
  private progress = 0;
  private done = false;

  get active(): QuestDef | null {
    if (this.done || this.index >= QUESTS.length) return null;
    return QUESTS[this.index];
  }

  get currentProgress() {
    return this.progress;
  }

  get completedCount() {
    return this.done ? QUESTS.length : this.index;
  }

  report(event: QuestEvent): QuestDef[] {
    const completed: QuestDef[] = [];
    while (true) {
      const quest = this.active;
      if (!quest) break;
      this.apply(quest, event);
      if (this.progress < goalTarget(quest.goal)) break;
      completed.push(quest);
      this.index++;
      this.progress = 0;
      if (this.index >= QUESTS.length) this.done = true;
      // Score/island totals can complete the next quest immediately.
      if (event.type !== 'score' && event.type !== 'islands') break;
    }
    return completed;
  }

  private apply(quest: QuestDef, event: QuestEvent) {
    const { goal } = quest;
    switch (goal.kind) {
      case 'collect':
        if (event.type === 'collect' && event.resource === goal.resource) {
          this.progress += event.amount ?? 1;
        }
        break;
      case 'score':
        if (event.type === 'score') this.progress = event.total;
        break;
      case 'build':
        if (event.type === 'build' && (!goal.building || event.building === goal.building)) {
          this.progress++;
        }
        break;
      case 'hire':
        if (event.type === 'hire' && (!goal.troop || event.troop === goal.troop)) {
          this.progress++;
        }
        break;
      case 'islands':
        if (event.type === 'islands') this.progress = event.total;
        break;
      case 'nights':
        if (event.type === 'night') this.progress++;
        break;
    }
  }
}
