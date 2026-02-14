import type { Adventurer, AdventurerClass, AdventurerRarity, AdventurerRole } from './types.ts';

/** 预设冒险者（不含 id，生成时分配） */
export const PRESET_ADVENTURERS: Omit<Adventurer, 'id'>[] = [
  {
    name: '艾拉',
    class: 'warrior',
    rarity: 'common',
    level: 1,
    xp: 0,
    xpToNext: 100,
    hp: 120,
    maxHp: 120,
    attack: 15,
    defense: 10,
    gold: 0,
    status: 'idle',
    currentBuildingId: null,
    currentActionId: null,
    actionStartTime: null,
    actionEndTime: null,
    actionLabel: null,
    equipment: { weapon: null, armor: null },
  },
  {
    name: '梅林',
    class: 'elemental-mage',
    rarity: 'uncommon',
    level: 2,
    xp: 30,
    xpToNext: 150,
    hp: 70,
    maxHp: 80,
    attack: 20,
    defense: 5,
    gold: 0,
    status: 'idle',
    currentBuildingId: null,
    currentActionId: null,
    actionStartTime: null,
    actionEndTime: null,
    actionLabel: null,
    equipment: { weapon: null, armor: null },
  },
  {
    name: '罗宾',
    class: 'archer',
    rarity: 'rare',
    level: 3,
    xp: 50,
    xpToNext: 225,
    hp: 90,
    maxHp: 90,
    attack: 18,
    defense: 7,
    gold: 0,
    status: 'idle',
    currentBuildingId: null,
    currentActionId: null,
    actionStartTime: null,
    actionEndTime: null,
    actionLabel: null,
    equipment: { weapon: null, armor: null },
  },
  {
    name: '莉莉安',
    class: 'life-mage',
    rarity: 'uncommon',
    level: 2,
    xp: 20,
    xpToNext: 150,
    hp: 75,
    maxHp: 75,
    attack: 8,
    defense: 12,
    gold: 0,
    status: 'idle',
    currentBuildingId: null,
    currentActionId: null,
    actionStartTime: null,
    actionEndTime: null,
    actionLabel: null,
    equipment: { weapon: null, armor: null },
  },
];

/** 按职业分类的名字池 */
const ADVENTURER_NAMES: Record<AdventurerClass, string[]> = {
  warrior: ['加雷斯', '布伦达', '索尔', '海格', '维克多', '阿斯特丽德', '巴尔德', '希尔达'],
  archer: ['阿尔忒弥斯', '莱拉', '芬恩', '塞琳娜', '达里安', '艾薇', '猎风', '银箭'],
  'elemental-mage': ['塞拉斯', '薇薇安', '奥利弗', '伊莎贝拉', '费利克斯', '莫甘娜', '阿尔伯特', '塞西莉亚'],
  'life-mage': ['塞拉菲娜', '奥罗拉', '艾尔文', '克莱尔', '卢米娅', '本尼迪克', '索菲亚', '赛勒斯', '贝妮黛特', '塞巴斯蒂安', '格蕾丝', '马修', '安吉拉', '多米尼克', '艾琳', '尤利安'],
};

/** 各职业基础属性范围 */
const CLASS_BASE_STATS: Record<AdventurerClass, { hp: [number, number]; attack: [number, number]; defense: [number, number] }> = {
  warrior: { hp: [100, 140], attack: [12, 18], defense: [8, 14] },
  archer: { hp: [75, 100], attack: [14, 20], defense: [5, 9] },
  'elemental-mage': { hp: [60, 85], attack: [16, 24], defense: [3, 7] },
  'life-mage': { hp: [70, 90], attack: [6, 12], defense: [7, 12] },
};

/** 稀有度权重 */
const RARITY_WEIGHTS: { rarity: AdventurerRarity; weight: number }[] = [
  { rarity: 'common', weight: 50 },
  { rarity: 'uncommon', weight: 30 },
  { rarity: 'rare', weight: 15 },
  { rarity: 'epic', weight: 5 },
];

/** 稀有度属性加成系数 */
const RARITY_STAT_MULTIPLIER: Record<AdventurerRarity, number> = {
  common: 1.0,
  uncommon: 1.15,
  rare: 1.3,
  epic: 1.5,
};

/** 冒险者上限 = 工会大厅等级 * 4 */
export function getAdventurerCap(guildHallLevel: number): number {
  return guildHallLevel * 4;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickWeightedRarity(): AdventurerRarity {
  const totalWeight = RARITY_WEIGHTS.reduce((sum, r) => sum + r.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of RARITY_WEIGHTS) {
    roll -= entry.weight;
    if (roll <= 0) {
      return entry.rarity;
    }
  }
  return 'common';
}

/** 理想职能比例 tank:dps:healer = 1:2:1 */
const ROLE_IDEAL_RATIO: Record<AdventurerRole, number> = { tank: 1, dps: 2, healer: 1 };

/** 每个职能对应的职业列表 */
const ROLE_CLASSES: Record<AdventurerRole, AdventurerClass[]> = {
  tank: ['warrior'],
  dps: ['archer', 'elemental-mage'],
  healer: ['life-mage'],
};

/**
 * 根据现有冒险者的职能分布动态选择职业。
 * 偏离理想比例越多的职能，权重越高。
 */
function pickRandomClass(existing?: readonly Adventurer[]): AdventurerClass {
  if (!existing || existing.length === 0) {
    const classes: AdventurerClass[] = ['warrior', 'archer', 'elemental-mage', 'life-mage'];
    return classes[Math.floor(Math.random() * classes.length)];
  }

  // 统计现有职能数量
  const roleCounts: Record<AdventurerRole, number> = { tank: 0, dps: 0, healer: 0 };
  for (const adv of existing) {
    roleCounts[getRole(adv.class)] += 1;
  }

  const total = existing.length;
  const idealTotal = ROLE_IDEAL_RATIO.tank + ROLE_IDEAL_RATIO.dps + ROLE_IDEAL_RATIO.healer; // 4

  // 计算每个职能的权重：理想占比 - 实际占比 的差值越大，权重越高
  const roles: AdventurerRole[] = ['tank', 'dps', 'healer'];
  const weights: number[] = roles.map((role) => {
    const idealFraction = ROLE_IDEAL_RATIO[role] / idealTotal;
    const actualFraction = total > 0 ? roleCounts[role] / total : 0;
    const deficit = idealFraction - actualFraction;
    // 基础权重 1，deficit 为正时额外加权（乘以缩放因子使偏差效果明显）
    return Math.max(0.1, 1 + deficit * 4);
  });

  // 加权随机选择职能
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  let roll = Math.random() * totalWeight;
  let chosenRole: AdventurerRole = 'dps';
  for (let i = 0; i < roles.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      chosenRole = roles[i];
      break;
    }
  }

  // 从该职能的职业列表中随机选一个
  const candidates = ROLE_CLASSES[chosenRole];
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/** 职业→职能映射 */
export const CLASS_ROLE_MAP: Record<AdventurerClass, AdventurerRole> = {
  warrior: 'tank',
  archer: 'dps',
  'elemental-mage': 'dps',
  'life-mage': 'healer',
};

export function getRole(advClass: AdventurerClass): AdventurerRole {
  return CLASS_ROLE_MAP[advClass];
}

/** 随机生成一个冒险者（不含 id，由调用方分配） */
export function generateRandomAdventurer(id: string, existingAdventurers?: readonly Adventurer[]): Adventurer {
  const advClass = pickRandomClass(existingAdventurers);
  const rarity = pickWeightedRarity();
  const multiplier = RARITY_STAT_MULTIPLIER[rarity];
  const base = CLASS_BASE_STATS[advClass];

  const maxHp = Math.round(randInt(base.hp[0], base.hp[1]) * multiplier);
  const attack = Math.round(randInt(base.attack[0], base.attack[1]) * multiplier);
  const defense = Math.round(randInt(base.defense[0], base.defense[1]) * multiplier);

  // 从名字池中随机选一个
  const names = ADVENTURER_NAMES[advClass];
  const name = names[Math.floor(Math.random() * names.length)];

  return {
    id,
    name,
    class: advClass,
    rarity,
    level: 1,
    xp: 0,
    xpToNext: 100,
    hp: maxHp,
    maxHp,
    attack,
    defense,
    gold: 0,
    status: 'idle',
    currentBuildingId: null,
    currentActionId: null,
    actionStartTime: null,
    actionEndTime: null,
    actionLabel: null,
    equipment: { weapon: null, armor: null },
  };
}
