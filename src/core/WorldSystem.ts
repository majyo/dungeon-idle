import type { Adventurer, GameState, ActivityLog, Party } from './types.ts';
import type { ActionContext, ActionDefinition, ActionEffect } from './ai/types.ts';
import { AdventurerAI } from './ai/AdventurerAI.ts';
import { ALL_ACTIONS } from './ai/actions.ts';
import { getFoodConfig } from './foodConfig.ts';
import { getEquipmentDef, findBestAffordable } from './equipmentConfig.ts';

function getEffectiveStats(adv: Adventurer): { attack: number; defense: number; maxHp: number } {
  let attack = adv.attack;
  let defense = adv.defense;
  let maxHp = adv.maxHp;

  for (const equipId of [adv.equipment.weapon, adv.equipment.armor]) {
    if (!equipId) { continue; }
    const def = getEquipmentDef(equipId);
    if (!def) { continue; }
    attack += def.stats.attack ?? 0;
    defense += def.stats.defense ?? 0;
    maxHp += def.stats.maxHp ?? 0;
  }

  return { attack, defense, maxHp };
}

function buildContext(adventurer: Adventurer, state: GameState): ActionContext {
  const eff = getEffectiveStats(adventurer);
  return {
    adventurer,
    state,
    effectiveAttack: eff.attack,
    effectiveDefense: eff.defense,
    effectiveMaxHp: eff.maxHp,
  };
}

export class WorldSystem {
  /**
   * 每秒 tick，直接修改传入的 state，返回是否有变更
   */
  tick(state: GameState): boolean {
    const now = Date.now();
    let changed = false;

    // 先处理工会大厅队伍计时
    if (this._tickGuildHall(state, now)) {
      changed = true;
    }

    state.adventurers = state.adventurers.map((adv) => {
      // 跳过 queuing 和 raiding 状态的冒险者（由队伍系统管理）
      if (adv.status === 'queuing' || adv.status === 'raiding') {
        return adv;
      }

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
    // 组队行动：特殊处理
    if (action.id === 'queue-party') {
      return this._joinOrCreateParty(adventurer, state);
    }

    const ctx: ActionContext = buildContext(adventurer, state);
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

    const ctx: ActionContext = buildContext(adventurer, state);
    const eff: ActionEffect = action.effect(ctx);

    // 购买装备行动：特殊处理
    if (action.id === 'buy-equipment') {
      const buyResult = this._tryBuyEquipment(adventurer, state);
      return {
        adventurer: {
          ...buyResult.adventurer,
          status: 'idle',
          currentActionId: null,
          actionStartTime: null,
          actionEndTime: null,
          actionLabel: null,
          currentBuildingId: null,
        },
      };
    }

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

    // 生成行动完成日志
    const newLog: ActivityLog = {
      id: Date.now() + '-' + Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      adventurerName: adventurer.name,
      actionLabel: adventurer.actionLabel || '未知行动',
      effects: {
        goldDelta: eff.goldDelta ?? 0,
        xpDelta: eff.xpDelta ?? 0,
        hpDelta: eff.hpDelta ?? 0,
      },
      levelUp: newLevel > adventurer.level,
    };

    // 添加到日志列表并截断到最多 100 条
    state.activityLogs = [...state.activityLogs, newLog].slice(-100);

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

  /**
   * 内部：冒险者尝试购买装备
   * 优先购买空槽位，其次升级已有装备
   */
  private _tryBuyEquipment(adventurer: Adventurer, state: GameState): { adventurer: Adventurer } {
    let adv = { ...adventurer, equipment: { ...adventurer.equipment } };
    const slots: Array<'weapon' | 'armor'> = [];

    // 优先空槽位
    if (!adv.equipment.weapon) { slots.unshift('weapon'); }
    if (!adv.equipment.armor) { slots.unshift('armor'); }
    // 其次已有槽位（升级）
    if (adv.equipment.weapon) { slots.push('weapon'); }
    if (adv.equipment.armor) { slots.push('armor'); }

    for (const slot of slots) {
      const currentId = adv.equipment[slot];
      const best = findBestAffordable(slot, adv.gold, currentId);
      if (!best) { continue; }

      // 扣冒险者金币，玩家获得金币
      adv = {
        ...adv,
        gold: adv.gold - best.price,
        equipment: { ...adv.equipment, [slot]: best.id },
      };
      state.gold += best.price;

      // 生成购买日志
      const log: ActivityLog = {
        id: Date.now() + '-' + Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        adventurerName: adventurer.name,
        actionLabel: '前往杂货店选购装备',
        effects: {
          goldDelta: -best.price,
          lootName: best.name,
        },
        levelUp: false,
      };
      state.activityLogs = [...state.activityLogs, log].slice(-100);

      // 只买一件就结束
      break;
    }

    return { adventurer: adv };
  }

  /**
   * 内部：处理工会大厅队伍计时
   */
  private _tickGuildHall(state: GameState, now: number): boolean {
    let changed = false;

    // 检查组队中的队伍是否超时
    const expiredParties = state.guildHall.formingParties.filter((p) => now >= p.formingDeadline);
    for (const party of expiredParties) {
      this._disbandParty(party, state, '组队超时');
      changed = true;
    }
    state.guildHall.formingParties = state.guildHall.formingParties.filter((p) => now < p.formingDeadline);

    // 检查副本中的队伍是否完成
    const completedParties = state.guildHall.raidingParties.filter((p) => p.raidEndTime !== null && now >= p.raidEndTime);
    for (const party of completedParties) {
      this._completeRaid(party, state);
      changed = true;
    }
    state.guildHall.raidingParties = state.guildHall.raidingParties.filter((p) => p.raidEndTime === null || now < p.raidEndTime);

    return changed;
  }

  /**
   * 内部：冒险者加入或创建队伍
   */
  private _joinOrCreateParty(adventurer: Adventurer, state: GameState): Adventurer {
    const now = Date.now();

    // 查找有空位的队伍
    let party = state.guildHall.formingParties.find((p) => p.memberIds.length < 4);

    if (!party) {
      // 创建新队伍
      party = {
        id: now + '-' + Math.random().toString(36).substring(2, 9),
        memberIds: [],
        status: 'forming',
        createdAt: now,
        formingDeadline: now + 60000,
        raidStartTime: null,
        raidEndTime: null,
      };
      state.guildHall.formingParties.push(party);
    }

    // 加入队伍
    party.memberIds.push(adventurer.id);

    // 生成日志
    const log: ActivityLog = {
      id: now + '-' + Math.random().toString(36).substring(2, 9),
      timestamp: now,
      adventurerName: adventurer.name,
      actionLabel: `加入队伍 (${party.memberIds.length}/4)`,
      effects: {},
      levelUp: false,
    };
    state.activityLogs = [...state.activityLogs, log].slice(-100);

    // 满4人时开始副本
    if (party.memberIds.length >= 4) {
      this._startRaid(party, state);
    }

    return {
      ...adventurer,
      status: 'queuing',
      currentActionId: 'queue-party',
      actionStartTime: now,
      actionEndTime: party.formingDeadline,
      actionLabel: '在工会大厅等待队友',
      currentBuildingId: 'guild-hall',
    };
  }

  /**
   * 内部：队伍满员，开始副本
   */
  private _startRaid(party: Party, state: GameState): void {
    const now = Date.now();

    // 从 formingParties 移到 raidingParties
    state.guildHall.formingParties = state.guildHall.formingParties.filter((p) => p.id !== party.id);
    party.status = 'raiding';
    party.raidStartTime = now;
    party.raidEndTime = now + 20000;
    state.guildHall.raidingParties.push(party);

    // 更新所有成员状态为 raiding
    const memberNames: string[] = [];
    state.adventurers = state.adventurers.map((adv) => {
      if (party.memberIds.includes(adv.id)) {
        memberNames.push(adv.name);
        return {
          ...adv,
          status: 'raiding' as const,
          actionLabel: '正在攻略副本',
          actionEndTime: party.raidEndTime,
        };
      }
      return adv;
    });

    // 生成日志
    const log: ActivityLog = {
      id: now + '-' + Math.random().toString(36).substring(2, 9),
      timestamp: now,
      adventurerName: memberNames.join('、'),
      actionLabel: '队伍满员，开始攻略副本',
      effects: {},
      levelUp: false,
    };
    state.activityLogs = [...state.activityLogs, log].slice(-100);
  }

  /**
   * 内部：副本完成，结算奖励
   */
  private _completeRaid(party: Party, state: GameState): void {
    const now = Date.now();

    state.adventurers = state.adventurers.map((adv) => {
      if (!party.memberIds.includes(adv.id)) {
        return adv;
      }

      // 扣除30%-50%生命值
      const hpLossPercent = 0.3 + Math.random() * 0.2;
      const hpLoss = Math.floor(adv.maxHp * hpLossPercent);
      let newHp = Math.max(1, adv.hp - hpLoss);

      // 奖励经验和金币
      const xpGain = 50 + adv.level * 10 + Math.floor(Math.random() * 20);
      const goldGain = 20 + adv.level * 5 + Math.floor(Math.random() * 10);

      let newXp = adv.xp + xpGain;
      let newLevel = adv.level;
      let newXpToNext = adv.xpToNext;
      let newMaxHp = adv.maxHp;
      let newAttack = adv.attack;
      let newDefense = adv.defense;
      let leveledUp = false;

      // 升级检查
      while (newXp >= newXpToNext) {
        newXp -= newXpToNext;
        newLevel += 1;
        newXpToNext = Math.floor(newXpToNext * 1.5);
        newMaxHp += 5 + Math.floor(Math.random() * 6);
        newAttack += 1 + Math.floor(Math.random() * 3);
        newDefense += 1 + Math.floor(Math.random() * 2);
        newHp = newMaxHp;
        leveledUp = true;
      }

      // 生成日志
      const log: ActivityLog = {
        id: now + '-' + adv.id + '-' + Math.random().toString(36).substring(2, 9),
        timestamp: now,
        adventurerName: adv.name,
        actionLabel: '完成副本攻略',
        effects: {
          goldDelta: goldGain,
          xpDelta: xpGain,
          hpDelta: -hpLoss,
        },
        levelUp: leveledUp,
      };
      state.activityLogs = [...state.activityLogs, log].slice(-100);

      return {
        ...adv,
        hp: newHp,
        xp: newXp,
        level: newLevel,
        xpToNext: newXpToNext,
        maxHp: newMaxHp,
        attack: newAttack,
        defense: newDefense,
        gold: adv.gold + goldGain,
        status: 'idle' as const,
        currentActionId: null,
        actionStartTime: null,
        actionEndTime: null,
        actionLabel: null,
        currentBuildingId: null,
      };
    });
  }

  /**
   * 内部：解散队伍
   */
  private _disbandParty(party: Party, state: GameState, reason: string): void {
    const now = Date.now();
    const memberNames: string[] = [];

    // 所有成员回到 idle 状态
    state.adventurers = state.adventurers.map((adv) => {
      if (party.memberIds.includes(adv.id)) {
        memberNames.push(adv.name);
        return {
          ...adv,
          status: 'idle' as const,
          currentActionId: null,
          actionStartTime: null,
          actionEndTime: null,
          actionLabel: null,
          currentBuildingId: null,
        };
      }
      return adv;
    });

    // 生成日志
    if (memberNames.length > 0) {
      const log: ActivityLog = {
        id: now + '-' + Math.random().toString(36).substring(2, 9),
        timestamp: now,
        adventurerName: memberNames.join('、'),
        actionLabel: `组队失败：${reason}`,
        effects: {},
        levelUp: false,
      };
      state.activityLogs = [...state.activityLogs, log].slice(-100);
    }
  }
}
