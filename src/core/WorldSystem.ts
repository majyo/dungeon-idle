import type { Adventurer, GameState } from './types.ts';
import type { ActionContext, ActionDefinition, ActionEffect } from './ai/types.ts';
import { AdventurerAI } from './ai/AdventurerAI.ts';
import { ALL_ACTIONS } from './ai/actions.ts';
import { getFoodConfig } from './foodConfig.ts';

export class WorldSystem {
  /**
   * 每秒 tick，直接修改传入的 state，返回是否有变更
   */
  tick(state: GameState): boolean {
    const now = Date.now();
    let changed = false;

    state.adventurers = state.adventurers.map((adv) => {
      // 1. 被动效果（酒馆回血）
      const afterPassive = this._applyPassiveEffects(adv, state);
      if (afterPassive !== adv) {
        changed = true;
        adv = afterPassive;
      }

      // 2. 行动中 → 检查是否到时间
      if (adv.status !== 'idle' && adv.actionEndTime !== null) {
        if (now >= adv.actionEndTime) {
          const result = this._completeAction(adv, state);
          changed = true;
          return result.adventurer;
        }
        return adv;
      }

      // 3. 空闲 → 选择新行动
      if (adv.status === 'idle') {
        const action = AdventurerAI.pickAction(adv, state);
        if (action) {
          changed = true;
          return this.startAction(adv, action, state);
        }
      }

      return adv;
    });

    return changed;
  }

  /**
   * 即时交互：为冒险者启动行动
   */
  startAction(adventurer: Adventurer, action: ActionDefinition, state: GameState): Adventurer {
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

  /**
   * 即时交互：冒险者进入/离开建筑
   */
  enterBuilding(adventurer: Adventurer, buildingId: string | null): Adventurer {
    return { ...adventurer, currentBuildingId: buildingId };
  }

  /**
   * 内部：结算已完成的行动
   */
  private _completeAction(adventurer: Adventurer, state: GameState): { adventurer: Adventurer } {
    const action = ALL_ACTIONS.find((a) => a.id === adventurer.currentActionId);
    if (!action) {
      return {
        adventurer: { ...adventurer, status: 'idle', currentActionId: null, actionStartTime: null, actionEndTime: null, actionLabel: null, currentBuildingId: null },
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

    const goldEarned = eff.goldDelta ?? 0;

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
        gold: adventurer.gold + goldEarned,
        status: 'idle',
        currentActionId: null,
        actionStartTime: null,
        actionEndTime: null,
        actionLabel: null,
        currentBuildingId: null,
      },
    };
  }

  /**
   * 内部：被动效果（酒馆回血）
   * 优先尝试购买食物回血，兜底走被动回血（减半）
   */
  private _applyPassiveEffects(adventurer: Adventurer, state: GameState): Adventurer {
    if (adventurer.status === 'resting' && adventurer.currentBuildingId === 'tavern' && adventurer.hp < adventurer.maxHp) {
      // 优先尝试买食物
      const foodResult = this._tryBuyFood(adventurer, state);
      if (foodResult) {
        return foodResult;
      }

      // 兜底被动回血（减半）
      const tavern = state.buildings.find((b) => b.id === 'tavern');
      const tavernLv = tavern ? tavern.level : 0;
      const healPerTick = Math.max(1, Math.floor(adventurer.maxHp * (0.02 + tavernLv * 0.015)));
      const newHp = Math.min(adventurer.maxHp, adventurer.hp + healPerTick);
      if (newHp !== adventurer.hp) {
        return { ...adventurer, hp: newHp };
      }
    }
    return adventurer;
  }

  /**
   * 内部：冒险者尝试购买酒馆食物回血
   * 找到有库存且买得起的食物，扣库存、扣冒险者金币、加玩家金币、回血
   */
  private _tryBuyFood(adventurer: Adventurer, state: GameState): Adventurer | null {
    for (const stock of state.tavernFood) {
      if (stock.quantity <= 0) {
        continue;
      }
      const config = getFoodConfig(stock.foodId);
      if (!config) {
        continue;
      }
      if (adventurer.gold < config.price) {
        continue;
      }

      // 扣库存
      stock.quantity -= 1;
      // 玩家获得金币
      state.gold += config.price;
      // 冒险者回血
      const newHp = Math.min(adventurer.maxHp, adventurer.hp + config.healAmount);
      return {
        ...adventurer,
        gold: adventurer.gold - config.price,
        hp: newHp,
      };
    }
    return null;
  }
}
