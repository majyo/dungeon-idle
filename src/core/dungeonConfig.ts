import type { WaveDef, DungeonClearRecord } from './types.ts';

/** 副本难度 */
export type DungeonDifficulty = 'easy' | 'normal' | 'hard' | 'nightmare';

/** 副本奖励配置 */
export interface DungeonRewards {
  baseGold: number;
  baseXp: number;
  goldPerLevel: number;
  xpPerLevel: number;
  hpLossMin: number;  // 最小HP损失比例
  hpLossMax: number;  // 最大HP损失比例
}

/** 副本解锁条件 */
export interface DungeonUnlockCondition {
  guildHallLevel: number;
  requiredClears?: { dungeonId: string; count: number }[];
}

/** 副本定义 */
export interface DungeonDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  difficulty: DungeonDifficulty;
  minPartyLevel: number;  // 推荐最低队伍平均等级
  duration: number;       // 副本时长（毫秒）- 无 waves 时使用
  rewards: DungeonRewards;
  unlockCondition: DungeonUnlockCondition;
  waves?: WaveDef[];      // 战斗轮次配置
  clearBonus?: { gold: number; xp: number };  // 通关奖励
}

/** 所有副本定义 */
export const DUNGEON_DEFS: DungeonDef[] = [
  {
    id: 'goblin-cave',
    name: '哥布林洞穴',
    description: '一群哥布林占据的洞穴，适合新手队伍挑战',
    icon: '🦎',
    difficulty: 'normal',
    minPartyLevel: 1,
    duration: 15000,
    rewards: {
      baseGold: 15,
      baseXp: 40,
      goldPerLevel: 3,
      xpPerLevel: 8,
      hpLossMin: 0.2,
      hpLossMax: 0.35,
    },
    unlockCondition: { guildHallLevel: 1 },
    waves: [
      { monsterIds: ['goblin-grunt', 'goblin-grunt', 'goblin-grunt', 'goblin-archer'], bonusGold: 5, bonusXp: 10 },
      { monsterIds: ['goblin-grunt', 'goblin-archer', 'goblin-archer', 'goblin-shaman'], bonusGold: 8, bonusXp: 15 },
      { monsterIds: ['goblin-archer', 'goblin-shaman', 'goblin-shaman', 'goblin-chief'], bonusGold: 15, bonusXp: 25 },
    ],
    clearBonus: { gold: 30, xp: 50 },
  },
  {
    id: 'undead-crypt',
    name: '亡灵地穴',
    description: '阴暗的地下墓穴，亡灵在此游荡，需要一定实力才能生还',
    icon: '💀',
    difficulty: 'normal',
    minPartyLevel: 3,
    duration: 18000,
    rewards: {
      baseGold: 25,
      baseXp: 60,
      goldPerLevel: 5,
      xpPerLevel: 12,
      hpLossMin: 0.25,
      hpLossMax: 0.4,
    },
    unlockCondition: {
      guildHallLevel: 1,
      requiredClears: [{ dungeonId: 'goblin-cave', count: 3 }],
    },
    waves: [
      { monsterIds: ['skeleton-soldier', 'skeleton-soldier', 'skeleton-soldier', 'skeleton-archer'], bonusGold: 8, bonusXp: 15 },
      { monsterIds: ['skeleton-soldier', 'skeleton-archer', 'skeleton-archer', 'wraith'], bonusGold: 12, bonusXp: 20 },
      { monsterIds: ['skeleton-archer', 'wraith', 'wraith', 'death-knight'], bonusGold: 20, bonusXp: 35 },
    ],
    clearBonus: { gold: 50, xp: 80 },
  },
  {
    id: 'beast-lair',
    name: '野兽巢穴',
    description: '凶猛野兽盘踞的巢穴，只有经验丰富的队伍才敢踏入',
    icon: '🐺',
    difficulty: 'hard',
    minPartyLevel: 5,
    duration: 20000,
    rewards: {
      baseGold: 40,
      baseXp: 90,
      goldPerLevel: 7,
      xpPerLevel: 16,
      hpLossMin: 0.3,
      hpLossMax: 0.5,
    },
    unlockCondition: {
      guildHallLevel: 2,
      requiredClears: [{ dungeonId: 'undead-crypt', count: 3 }],
    },
    waves: [
      { monsterIds: ['dire-wolf', 'dire-wolf', 'dire-wolf', 'giant-spider'], bonusGold: 12, bonusXp: 20 },
      { monsterIds: ['dire-wolf', 'giant-spider', 'giant-spider', 'cave-bear'], bonusGold: 18, bonusXp: 30 },
      { monsterIds: ['giant-spider', 'cave-bear', 'cave-bear', 'alpha-wolf'], bonusGold: 28, bonusXp: 45 },
    ],
    clearBonus: { gold: 80, xp: 120 },
  },
  {
    id: 'elemental-temple',
    name: '元素圣殿',
    description: '元素之力失控的古老圣殿，强大的元素生物守护着深处的秘密',
    icon: '🔥',
    difficulty: 'hard',
    minPartyLevel: 8,
    duration: 25000,
    rewards: {
      baseGold: 60,
      baseXp: 130,
      goldPerLevel: 10,
      xpPerLevel: 22,
      hpLossMin: 0.35,
      hpLossMax: 0.55,
    },
    unlockCondition: {
      guildHallLevel: 2,
      requiredClears: [{ dungeonId: 'beast-lair', count: 3 }],
    },
    waves: [
      { monsterIds: ['fire-elemental', 'fire-elemental', 'ice-elemental', 'ice-elemental'], bonusGold: 16, bonusXp: 28 },
      { monsterIds: ['fire-elemental', 'ice-elemental', 'storm-elemental', 'storm-elemental'], bonusGold: 22, bonusXp: 38 },
      { monsterIds: ['storm-elemental', 'fire-elemental', 'ice-elemental', 'earth-golem'], bonusGold: 30, bonusXp: 50 },
      { monsterIds: ['earth-golem', 'storm-elemental', 'fire-elemental', 'ice-elemental'], bonusGold: 40, bonusXp: 60 },
    ],
    clearBonus: { gold: 120, xp: 180 },
  },
  {
    id: 'demon-abyss',
    name: '恶魔深渊',
    description: '通往深渊的裂隙，恶魔的力量在此汇聚，只有最强的队伍才能生还',
    icon: '😈',
    difficulty: 'nightmare',
    minPartyLevel: 11,
    duration: 30000,
    rewards: {
      baseGold: 90,
      baseXp: 200,
      goldPerLevel: 14,
      xpPerLevel: 30,
      hpLossMin: 0.4,
      hpLossMax: 0.6,
    },
    unlockCondition: {
      guildHallLevel: 3,
      requiredClears: [{ dungeonId: 'elemental-temple', count: 3 }],
    },
    waves: [
      { monsterIds: ['imp', 'imp', 'imp', 'succubus'], bonusGold: 22, bonusXp: 38 },
      { monsterIds: ['imp', 'succubus', 'succubus', 'demon-guard'], bonusGold: 30, bonusXp: 50 },
      { monsterIds: ['succubus', 'demon-guard', 'demon-guard', 'imp'], bonusGold: 38, bonusXp: 60 },
      { monsterIds: ['demon-guard', 'succubus', 'imp', 'demon-lord'], bonusGold: 50, bonusXp: 80 },
    ],
    clearBonus: { gold: 180, xp: 280 },
  },
  {
    id: 'dragon-palace',
    name: '龙王殿堂',
    description: '传说中龙族的王座所在，无数勇者在此陨落，唯有最强者才能觐见龙王',
    icon: '🐉',
    difficulty: 'nightmare',
    minPartyLevel: 15,
    duration: 35000,
    rewards: {
      baseGold: 140,
      baseXp: 300,
      goldPerLevel: 20,
      xpPerLevel: 40,
      hpLossMin: 0.45,
      hpLossMax: 0.65,
    },
    unlockCondition: {
      guildHallLevel: 3,
      requiredClears: [{ dungeonId: 'demon-abyss', count: 5 }],
    },
    waves: [
      { monsterIds: ['drake', 'drake', 'drake', 'wyvern'], bonusGold: 30, bonusXp: 50 },
      { monsterIds: ['drake', 'wyvern', 'wyvern', 'dragon-guard'], bonusGold: 40, bonusXp: 65 },
      { monsterIds: ['wyvern', 'dragon-guard', 'drake', 'wyvern'], bonusGold: 50, bonusXp: 80 },
      { monsterIds: ['dragon-guard', 'dragon-guard', 'wyvern', 'drake'], bonusGold: 60, bonusXp: 95 },
      { monsterIds: ['dragon-guard', 'wyvern', 'drake', 'dragon-king'], bonusGold: 80, bonusXp: 120 },
    ],
    clearBonus: { gold: 300, xp: 450 },
  },
];

/**
 * 根据 ID 获取副本定义
 */
export function getDungeonDef(id: string): DungeonDef | undefined {
  return DUNGEON_DEFS.find((d) => d.id === id);
}

/**
 * 获取已解锁的副本列表
 */
export function getUnlockedDungeons(guildHallLevel: number, dungeonRecords: DungeonClearRecord[]): DungeonDef[] {
  return DUNGEON_DEFS.filter((d) => {
    if (guildHallLevel < d.unlockCondition.guildHallLevel) {
      return false;
    }
    if (d.unlockCondition.requiredClears) {
      for (const req of d.unlockCondition.requiredClears) {
        const record = dungeonRecords.find((r) => r.dungeonId === req.dungeonId);
        if (!record || record.clearCount < req.count) {
          return false;
        }
      }
    }
    return true;
  });
}

/**
 * 根据队伍平均等级选择合适的副本
 * 返回已解锁且推荐等级最接近队伍等级的副本
 */
export function selectDungeonForParty(avgLevel: number, guildHallLevel: number, dungeonRecords: DungeonClearRecord[]): DungeonDef | null {
  const unlocked = getUnlockedDungeons(guildHallLevel, dungeonRecords);
  if (unlocked.length === 0) {
    return null;
  }

  // 选择推荐等级最接近队伍等级的副本
  let best = unlocked[0];
  let bestDiff = Math.abs(avgLevel - best.minPartyLevel);

  for (const dungeon of unlocked) {
    const diff = Math.abs(avgLevel - dungeon.minPartyLevel);
    if (diff < bestDiff) {
      best = dungeon;
      bestDiff = diff;
    }
  }

  return best;
}
