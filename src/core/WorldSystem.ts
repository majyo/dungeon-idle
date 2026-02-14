import type { Adventurer, GameState, ActivityLog, Party, MonsterInstance } from './types.ts';
import type { ActionContext, ActionDefinition, ActionEffect } from './ai/types.ts';
import { AdventurerAI } from './ai/AdventurerAI.ts';
import { ALL_ACTIONS } from './ai/actions.ts';
import { getFoodConfig } from './foodConfig.ts';
import { getEquipmentDef, findBestAffordable } from './equipmentConfig.ts';
import { getDungeonDef, selectDungeonForParty } from './dungeonConfig.ts';
import { getMonsterDef } from './monsterConfig.ts';
import { PRESET_ADVENTURERS, getAdventurerCap, generateRandomAdventurer, getRole } from './adventurerConfig.ts';
import { executeCombatTick } from './combat/combatEngine.ts';

const COMBAT_TICK_INTERVAL = 2000; // 战斗回合间隔：2秒

export interface EffectiveStats {
  attack: number;
  defense: number;
  maxHp: number;
  magicPower: number;
  magicResist: number;
  speed: number;
  critRate: number;
  critDamage: number;
}

export function getEffectiveStats(adv: Adventurer): EffectiveStats {
  let attack = adv.attack;
  let defense = adv.defense;
  let maxHp = adv.maxHp;
  let magicPower = adv.magicPower;
  let magicResist = adv.magicResist;
  let speed = adv.speed;
  let critRate = adv.critRate;
  const critDamage = adv.critDamage;

  for (const equipId of [adv.equipment.weapon, adv.equipment.armor]) {
    if (!equipId) { continue; }
    const def = getEquipmentDef(equipId);
    if (!def) { continue; }
    attack += def.stats.attack ?? 0;
    defense += def.stats.defense ?? 0;
    maxHp += def.stats.maxHp ?? 0;
    magicPower += def.stats.magicPower ?? 0;
    magicResist += def.stats.magicResist ?? 0;
    speed += def.stats.speed ?? 0;
    critRate += def.stats.critRate ?? 0;
  }

  return { attack, defense, maxHp, magicPower, magicResist, speed, critRate, critDamage };
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

    // 先处理冒险者生成
    if (this._tickSpawn(state, now)) {
      changed = true;
    }

    // 处理工会大厅队伍计时
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
      const hpGain = 5 + Math.floor(Math.random() * 6);
      newMaxHp += hpGain;
      newHp += hpGain; // 只增加升级获得的HP
      newAttack += 1 + Math.floor(Math.random() * 3);
      newDefense += 1 + Math.floor(Math.random() * 2);
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

    // 构建库存可用装备ID集合
    const availableIds = new Set<string>();
    for (const stock of state.storeEquipment) {
      if (stock.quantity > 0) {
        availableIds.add(stock.equipmentId);
      }
    }

    // 库存为空则直接返回
    if (availableIds.size === 0) {
      return { adventurer: adv };
    }

    // 优先空槽位
    if (!adv.equipment.weapon) { slots.unshift('weapon'); }
    if (!adv.equipment.armor) { slots.unshift('armor'); }
    // 其次已有槽位（升级）
    if (adv.equipment.weapon) { slots.push('weapon'); }
    if (adv.equipment.armor) { slots.push('armor'); }

    for (const slot of slots) {
      const currentId = adv.equipment[slot];
      const best = findBestAffordable(slot, adv.gold, currentId, availableIds);
      if (!best) { continue; }

      // 扣冒险者金币，玩家获得金币
      adv = {
        ...adv,
        gold: adv.gold - best.price,
        equipment: { ...adv.equipment, [slot]: best.id },
      };
      state.gold += best.price;

      // 扣除库存
      state.storeEquipment = state.storeEquipment.map((s) =>
        s.equipmentId === best.id ? { ...s, quantity: s.quantity - 1 } : s
      );

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
  private _tickSpawn(state: GameState, now: number): boolean {
    const guildHall = state.buildings.find((b) => b.id === 'guild-hall');
    const cap = getAdventurerCap(guildHall?.level ?? 0);

    if (state.adventurers.length >= cap) {
      return false;
    }
    if (now - state.lastSpawnTime < 5000) {
      return false;
    }

    const index = state.nextAdventurerIndex;
    const id = `adventurer-${index + 1}`;
    let newAdventurer;

    if (index < PRESET_ADVENTURERS.length) {
      newAdventurer = { ...PRESET_ADVENTURERS[index], id };
    } else {
      newAdventurer = generateRandomAdventurer(id, state.adventurers);
    }

    state.adventurers = [...state.adventurers, newAdventurer];
    state.nextAdventurerIndex = index + 1;
    state.lastSpawnTime = now;

    // 活动日志
    const log: ActivityLog = {
      id: `log-${now}-spawn-${id}`,
      timestamp: now,
      adventurerName: newAdventurer.name,
      actionLabel: '加入了冒险者公会',
      effects: {},
    };
    state.activityLogs = [...state.activityLogs, log].slice(-100);

    return true;
  }

  private _tickGuildHall(state: GameState, now: number): boolean {
    let changed = false;

    // 检查组队中的队伍是否超时
    const expiredParties = state.guildHall.formingParties.filter((p) => now >= p.formingDeadline);
    for (const party of expiredParties) {
      this._disbandParty(party, state, '组队超时');
      changed = true;
    }
    state.guildHall.formingParties = state.guildHall.formingParties.filter((p) => now < p.formingDeadline);

    // 处理副本中的队伍
    const completedParties: Party[] = [];
    for (const party of state.guildHall.raidingParties) {
      const dungeon = party.dungeonId ? getDungeonDef(party.dungeonId) : null;

      // 有 waves 配置：使用战斗系统
      if (dungeon && dungeon.waves && dungeon.waves.length > 0) {
        const result = this._tickCombat(party, state, now);
        if (result === 'changed') {
          changed = true;
        } else if (result === 'completed' || result === 'failed') {
          completedParties.push(party);
          changed = true;
        }
      } else {
        // 无 waves：保持原有时间制逻辑
        if (party.raidEndTime !== null && now >= party.raidEndTime) {
          this._completeRaid(party, state);
          completedParties.push(party);
          changed = true;
        }
      }
    }

    // 移除已完成的队伍
    state.guildHall.raidingParties = state.guildHall.raidingParties.filter(
      (p) => !completedParties.includes(p)
    );

    return changed;
  }

  /**
   * 内部：冒险者加入或创建队伍
   */
  private _joinOrCreateParty(adventurer: Adventurer, state: GameState): Adventurer {
    const now = Date.now();
    const role = getRole(adventurer.class);

    // 查找有对应职能空位的队伍
    let party = state.guildHall.formingParties.find((p) => {
      if (!p.roleSlots) { return false; }
      if (role === 'tank') { return p.roleSlots.tank === null; }
      if (role === 'dps') { return p.roleSlots.dps1 === null || p.roleSlots.dps2 === null; }
      if (role === 'healer') { return p.roleSlots.healer === null; }
      return false;
    });

    if (!party) {
      // 创建新队伍
      party = {
        id: now + '-' + Math.random().toString(36).substring(2, 9),
        name: `${adventurer.name}的小队`,
        memberIds: [],
        status: 'forming',
        createdAt: now,
        formingDeadline: now + 60000,
        raidStartTime: null,
        raidEndTime: null,
        dungeonId: null,
        waveState: null,
        completedWaves: 0,
        totalWaves: 0,
        accumulatedRewards: { gold: 0, xp: 0 },
        roleSlots: { tank: null, dps1: null, dps2: null, healer: null },
      };
      state.guildHall.formingParties.push(party);
    }

    // 填入对应槽位
    if (role === 'tank') {
      party.roleSlots!.tank = adventurer.id;
    } else if (role === 'dps') {
      if (party.roleSlots!.dps1 === null) {
        party.roleSlots!.dps1 = adventurer.id;
      } else {
        party.roleSlots!.dps2 = adventurer.id;
      }
    } else if (role === 'healer') {
      party.roleSlots!.healer = adventurer.id;
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

    // 所有槽位非 null 时开始副本
    const slots = party.roleSlots!;
    if (slots.tank !== null && slots.dps1 !== null && slots.dps2 !== null && slots.healer !== null) {
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

    // 计算队伍平均等级
    const members = party.memberIds
      .map((id) => state.adventurers.find((a) => a.id === id))
      .filter((a): a is Adventurer => a !== undefined);
    const avgLevel = members.length > 0
      ? Math.floor(members.reduce((sum, m) => sum + m.level, 0) / members.length)
      : 1;

    // 获取工会大厅等级
    const guildHall = state.buildings.find((b) => b.id === 'guild-hall');
    const guildHallLevel = guildHall ? guildHall.level : 0;

    // 选择副本
    const dungeon = selectDungeonForParty(avgLevel, guildHallLevel, state.guildHall.dungeonRecords);
    const hasCombatWaves = dungeon && dungeon.waves && dungeon.waves.length > 0;

    // 从 formingParties 移到 raidingParties
    state.guildHall.formingParties = state.guildHall.formingParties.filter((p) => p.id !== party.id);
    party.status = 'raiding';
    party.raidStartTime = now;
    party.dungeonId = dungeon ? dungeon.id : null;

    // 初始化战斗相关字段
    if (hasCombatWaves) {
      party.raidEndTime = null; // 战斗制副本不使用固定结束时间
      party.totalWaves = dungeon!.waves!.length;
      party.completedWaves = 0;
      party.accumulatedRewards = { gold: 0, xp: 0 };
      // 初始化第一轮战斗
      this._initWave(party, 0, dungeon!, state);
    } else {
      // 时间制副本
      const dungeonDuration = dungeon ? dungeon.duration : 20000;
      party.raidEndTime = now + dungeonDuration;
      party.totalWaves = 0;
      party.completedWaves = 0;
      party.accumulatedRewards = { gold: 0, xp: 0 };
      party.waveState = null;
    }

    state.guildHall.raidingParties.push(party);

    // 更新所有成员状态为 raiding
    const memberNames: string[] = [];
    const dungeonName = dungeon ? dungeon.name : '未知副本';
    state.adventurers = state.adventurers.map((adv) => {
      if (party.memberIds.includes(adv.id)) {
        memberNames.push(adv.name);
        return {
          ...adv,
          status: 'raiding' as const,
          actionLabel: `正在攻略${dungeonName}`,
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
      actionLabel: `队伍满员，开始攻略${dungeonName}`,
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

    // 获取副本配置
    const dungeon = party.dungeonId ? getDungeonDef(party.dungeonId) : null;
    const dungeonName = dungeon ? dungeon.name : '未知副本';

    // 更新通关记录
    if (dungeon) {
      const existingRecord = state.guildHall.dungeonRecords.find((r) => r.dungeonId === dungeon.id);
      if (existingRecord) {
        existingRecord.clearCount += 1;
        existingRecord.lastClearTime = now;
      } else {
        state.guildHall.dungeonRecords.push({
          dungeonId: dungeon.id,
          clearCount: 1,
          lastClearTime: now,
        });
      }
    }

    state.adventurers = state.adventurers.map((adv) => {
      if (!party.memberIds.includes(adv.id)) {
        return adv;
      }

      // 根据副本配置计算HP损失
      let hpLossMin = 0.3;
      let hpLossMax = 0.5;
      let baseXp = 50;
      let xpPerLevel = 10;
      let baseGold = 20;
      let goldPerLevel = 5;

      if (dungeon) {
        hpLossMin = dungeon.rewards.hpLossMin;
        hpLossMax = dungeon.rewards.hpLossMax;
        baseXp = dungeon.rewards.baseXp;
        xpPerLevel = dungeon.rewards.xpPerLevel;
        baseGold = dungeon.rewards.baseGold;
        goldPerLevel = dungeon.rewards.goldPerLevel;
      }

      const hpLossPercent = hpLossMin + Math.random() * (hpLossMax - hpLossMin);
      const hpLoss = Math.floor(adv.maxHp * hpLossPercent);
      let newHp = Math.max(1, adv.hp - hpLoss);

      // 奖励经验和金币
      const xpGain = baseXp + adv.level * xpPerLevel + Math.floor(Math.random() * 20);
      const goldGain = baseGold + adv.level * goldPerLevel + Math.floor(Math.random() * 10);

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
        const hpGain = 5 + Math.floor(Math.random() * 6);
        newMaxHp += hpGain;
        newHp += hpGain; // 只增加升级获得的HP
        newAttack += 1 + Math.floor(Math.random() * 3);
        newDefense += 1 + Math.floor(Math.random() * 2);
        leveledUp = true;
      }

      // 生成日志
      const log: ActivityLog = {
        id: now + '-' + adv.id + '-' + Math.random().toString(36).substring(2, 9),
        timestamp: now,
        adventurerName: adv.name,
        actionLabel: `完成${dungeonName}攻略`,
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

  /**
   * 内部：计算伤害（仅用于非战斗场景的兼容）
   */
  private _calculateDamage(attack: number, defense: number): number {
    const baseDamage = Math.max(1, attack - defense * 0.5);
    const randomFactor = 0.85 + Math.random() * 0.3; // 0.85 ~ 1.15
    return Math.floor(baseDamage * randomFactor);
  }

  /**
   * 内部：初始化战斗轮次
   */
  private _initWave(party: Party, waveIndex: number, dungeon: ReturnType<typeof getDungeonDef>, state: GameState): void {
    if (!dungeon || !dungeon.waves || waveIndex >= dungeon.waves.length) {
      return;
    }

    const wave = dungeon.waves[waveIndex];
    const now = Date.now();

    // 创建怪物实例
    const monsters: MonsterInstance[] = wave.monsterIds.map((monsterId) => {
      const def = getMonsterDef(monsterId);
      return {
        defId: monsterId,
        hp: def ? def.maxHp : 30,
        maxHp: def ? def.maxHp : 30,
      };
    });

    // 记录冒险者当前 HP
    const adventurerHp: Record<string, number> = {};
    for (const memberId of party.memberIds) {
      const adv = state.adventurers.find((a) => a.id === memberId);
      if (adv) {
        adventurerHp[memberId] = adv.hp;
      }
    }

    party.waveState = {
      waveIndex,
      monsters,
      adventurerHp,
      monsterStatusEffects: {},
      adventurerStatusEffects: {},
      cooldowns: {},
      combatLog: [],
      lastTickTime: now,
    };

    // 生成日志
    const log: ActivityLog = {
      id: now + '-wave-' + waveIndex,
      timestamp: now,
      adventurerName: '队伍',
      actionLabel: `进入第 ${waveIndex + 1}/${party.totalWaves} 轮战斗`,
      effects: {},
      levelUp: false,
    };
    state.activityLogs = [...state.activityLogs, log].slice(-100);
  }

  /**
   * 内部：执行战斗回合
   * 返回: 'unchanged' | 'changed' | 'completed' | 'failed'
   */
  private _tickCombat(party: Party, state: GameState, now: number): 'unchanged' | 'changed' | 'completed' | 'failed' {
    if (!party.waveState) {
      return 'unchanged';
    }

    // 检查是否到达战斗回合时间
    if (now - party.waveState.lastTickTime < COMBAT_TICK_INTERVAL) {
      return 'unchanged';
    }

    party.waveState.lastTickTime = now;

    const dungeon = party.dungeonId ? getDungeonDef(party.dungeonId) : null;
    if (!dungeon || !dungeon.waves) {
      return 'unchanged';
    }

    // 使用新战斗引擎执行一个回合
    const result = executeCombatTick(party, state);

    // 同步冒险者 HP 到 state
    state.adventurers = state.adventurers.map((adv) => {
      if (party.memberIds.includes(adv.id) && party.waveState) {
        const newHp = party.waveState.adventurerHp[adv.id];
        if (newHp !== undefined && newHp !== adv.hp) {
          return { ...adv, hp: newHp };
        }
      }
      return adv;
    });

    if (result === 'all-dead') {
      this._failRaid(party, state);
      return 'failed';
    }

    if (result === 'wave-clear') {
      this._settleWaveRewards(party, dungeon);
      party.completedWaves += 1;

      if (party.completedWaves >= party.totalWaves) {
        this._completeRaidWithCombat(party, dungeon, state);
        return 'completed';
      }

      // 进入下一轮
      this._initWave(party, party.completedWaves, dungeon, state);
    }

    return 'changed';
  }

  /**
   * 内部：结算单轮奖励
   */
  private _settleWaveRewards(party: Party, dungeon: ReturnType<typeof getDungeonDef>): void {
    if (!dungeon || !dungeon.waves || !party.waveState) {
      return;
    }

    const wave = dungeon.waves[party.waveState.waveIndex];
    let totalGold = wave.bonusGold ?? 0;
    let totalXp = wave.bonusXp ?? 0;

    // 累加击杀奖励
    for (const monster of party.waveState.monsters) {
      const def = getMonsterDef(monster.defId);
      if (def) {
        totalGold += def.goldReward;
        totalXp += def.xpReward;
      }
    }

    party.accumulatedRewards.gold += totalGold;
    party.accumulatedRewards.xp += totalXp;
  }

  /**
   * 内部：副本失败处理
   */
  private _failRaid(party: Party, state: GameState): void {
    const now = Date.now();
    const dungeon = party.dungeonId ? getDungeonDef(party.dungeonId) : null;
    const dungeonName = dungeon ? dungeon.name : '未知副本';

    // 失败惩罚：获得已累计奖励的 50%
    const goldReward = Math.floor(party.accumulatedRewards.gold * 0.5);
    const xpReward = Math.floor(party.accumulatedRewards.xp * 0.5);
    const xpPerMember = Math.floor(xpReward / party.memberIds.length);

    state.adventurers = state.adventurers.map((adv) => {
      if (!party.memberIds.includes(adv.id)) {
        return adv;
      }

      let newXp = adv.xp + xpPerMember;
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
        leveledUp = true;
      }

      // 生成日志
      const log: ActivityLog = {
        id: now + '-' + adv.id + '-fail',
        timestamp: now,
        adventurerName: adv.name,
        actionLabel: `${dungeonName}攻略失败，队伍全灭`,
        effects: {
          goldDelta: Math.floor(goldReward / party.memberIds.length),
          xpDelta: xpPerMember,
        },
        levelUp: leveledUp,
      };
      state.activityLogs = [...state.activityLogs, log].slice(-100);

      return {
        ...adv,
        hp: 1, // 全灭后 HP 为 1
        xp: newXp,
        level: newLevel,
        xpToNext: newXpToNext,
        maxHp: newMaxHp,
        attack: newAttack,
        defense: newDefense,
        gold: adv.gold + Math.floor(goldReward / party.memberIds.length),
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
   * 内部：战斗制副本通关
   */
  private _completeRaidWithCombat(party: Party, dungeon: ReturnType<typeof getDungeonDef>, state: GameState): void {
    const now = Date.now();
    const dungeonName = dungeon ? dungeon.name : '未知副本';

    // 更新通关记录
    if (dungeon) {
      const existingRecord = state.guildHall.dungeonRecords.find((r) => r.dungeonId === dungeon.id);
      if (existingRecord) {
        existingRecord.clearCount += 1;
        existingRecord.lastClearTime = now;
      } else {
        state.guildHall.dungeonRecords.push({
          dungeonId: dungeon.id,
          clearCount: 1,
          lastClearTime: now,
        });
      }
    }

    // 计算总奖励（累计奖励 + 通关奖励）
    let totalGold = party.accumulatedRewards.gold;
    let totalXp = party.accumulatedRewards.xp;
    if (dungeon && dungeon.clearBonus) {
      totalGold += dungeon.clearBonus.gold;
      totalXp += dungeon.clearBonus.xp;
    }

    const goldPerMember = Math.floor(totalGold / party.memberIds.length);
    const xpPerMember = Math.floor(totalXp / party.memberIds.length);

    state.adventurers = state.adventurers.map((adv) => {
      if (!party.memberIds.includes(adv.id)) {
        return adv;
      }

      // 使用 waveState 中记录的 HP
      const currentHp = party.waveState ? (party.waveState.adventurerHp[adv.id] ?? adv.hp) : adv.hp;

      let newXp = adv.xp + xpPerMember;
      let newLevel = adv.level;
      let newXpToNext = adv.xpToNext;
      let newMaxHp = adv.maxHp;
      let newAttack = adv.attack;
      let newDefense = adv.defense;
      let newMagicPower = adv.magicPower;
      let newMagicResist = adv.magicResist;
      let newSpeed = adv.speed;
      let newHp = currentHp;
      let leveledUp = false;

      // 升级检查
      while (newXp >= newXpToNext) {
        newXp -= newXpToNext;
        newLevel += 1;
        newXpToNext = Math.floor(newXpToNext * 1.5);
        const hpGain = 5 + Math.floor(Math.random() * 6);
        newMaxHp += hpGain;
        newHp += hpGain; // 只增加升级获得的HP
        newAttack += 1 + Math.floor(Math.random() * 3);
        newDefense += 1 + Math.floor(Math.random() * 2);
        // 新属性成长（按职业倾向）
        if (adv.class === 'elemental-mage' || adv.class === 'life-mage') {
          newMagicPower += 2 + Math.floor(Math.random() * 3);
        } else {
          newMagicPower += Math.floor(Math.random() * 2);
        }
        newMagicResist += Math.floor(Math.random() * 2);
        if (adv.class === 'archer') {
          newSpeed += 1 + Math.floor(Math.random() * 2);
        } else {
          newSpeed += Math.floor(Math.random() * 2);
        }
        leveledUp = true;
      }

      // 生成日志
      const log: ActivityLog = {
        id: now + '-' + adv.id + '-clear',
        timestamp: now,
        adventurerName: adv.name,
        actionLabel: `完成${dungeonName}攻略`,
        effects: {
          goldDelta: goldPerMember,
          xpDelta: xpPerMember,
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
        magicPower: newMagicPower,
        magicResist: newMagicResist,
        speed: newSpeed,
        gold: adv.gold + goldPerMember,
        status: 'idle' as const,
        currentActionId: null,
        actionStartTime: null,
        actionEndTime: null,
        actionLabel: null,
        currentBuildingId: null,
      };
    });
  }
}
