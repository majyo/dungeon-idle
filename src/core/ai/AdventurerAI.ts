import type { Adventurer, GameState } from '../types.ts';
import type { ActionContext, ActionDefinition, ActionEffect } from './types.ts';
import { ALL_ACTIONS } from './actions.ts';

export class AdventurerAI {
  static pickAction(adventurer: Adventurer, state: GameState): ActionDefinition | null {
    const ctx: ActionContext = { adventurer, state };

    // 过滤可用行动并评分
    const scored: { action: ActionDefinition; score: number }[] = [];
    for (const action of ALL_ACTIONS) {
      // 检查建筑需求
      if (action.requiredBuildingId) {
        const building = state.buildings.find((b) => b.id === action.requiredBuildingId);
        if (!building || building.level < (action.minBuildingLevel ?? 1)) {
          continue;
        }
      }
      const s = action.score(ctx);
      if (s > 0) {
        scored.push({ action, score: s });
      }
    }

    if (scored.length === 0) {
      return null;
    }

    // 取 top3，按 score² 加权随机
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 3);
    const weights = top.map((t) => t.score * t.score);
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    let roll = Math.random() * totalWeight;
    for (let i = 0; i < top.length; i++) {
      roll -= weights[i];
      if (roll <= 0) {
        return top[i].action;
      }
    }
    return top[0].action;
  }
  static startAction(adventurer: Adventurer, action: ActionDefinition, state: GameState): Adventurer {
    const ctx: ActionContext = { adventurer, state };
    const now = Date.now();
    const dur = action.duration(ctx);

    // 守卫行动：分配到一个已建造的建筑
    let buildingId: string | null = null;
    if (action.id === 'guard') {
      const built = state.buildings.filter((b) => b.level >= 1);
      if (built.length > 0) {
        buildingId = built[Math.floor(Math.random() * built.length)].id;
      }
    } else if (action.requiredBuildingId) {
      buildingId = action.requiredBuildingId;
    }

    return {
      ...adventurer,
      status: action.status,
      currentActionId: action.id,
      actionStartTime: now,
      actionEndTime: now + dur,
      actionLabel: action.describe(ctx),
      currentBuildingId: buildingId,
    };
  }

  static completeAction(adventurer: Adventurer, state: GameState): { adventurer: Adventurer; goldDelta: number } {
    const action = ALL_ACTIONS.find((a) => a.id === adventurer.currentActionId);
    if (!action) {
      return {
        adventurer: { ...adventurer, status: 'idle', currentActionId: null, actionStartTime: null, actionEndTime: null, actionLabel: null, currentBuildingId: null },
        goldDelta: 0,
      };
    }

    const ctx: ActionContext = { adventurer, state };
    const eff: ActionEffect = action.effect(ctx);

    let newHp = adventurer.hp + (eff.hpDelta ?? 0);
    newHp = Math.max(1, Math.min(newHp, adventurer.maxHp));

    let newXp = adventurer.xp + (eff.xpDelta ?? 0);
    let newLevel = adventurer.level;
    let newXpToNext = adventurer.xpToNext;
    let newMaxHp = adventurer.maxHp;
    let newAttack = adventurer.attack;
    let newDefense = adventurer.defense;

    // 升级检查
    while (newXp >= newXpToNext) {
      newXp -= newXpToNext;
      newLevel += 1;
      newXpToNext = Math.floor(newXpToNext * 1.5);
      newMaxHp += 5 + Math.floor(Math.random() * 6);
      newAttack += 1 + Math.floor(Math.random() * 3);
      newDefense += 1 + Math.floor(Math.random() * 2);
      newHp = newMaxHp; // 升级满血
    }

    return {
      adventurer: {
        ...adventurer,
        hp: newHp,
        xp: newXp,
        level: newLevel,
        xpToNext: newXpToNext,
        maxHp: newMaxHp,
        attack: newAttack,
        defense: newDefense,
        status: 'idle',
        currentActionId: null,
        actionStartTime: null,
        actionEndTime: null,
        actionLabel: null,
        currentBuildingId: null,
      },
      goldDelta: eff.goldDelta ?? 0,
    };
  }
}
