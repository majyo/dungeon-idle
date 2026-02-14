import type { AdventurerClass, StatusEffectId } from '../types.ts';

/** 技能目标类型 */
export type SkillTarget = 'single-enemy' | 'all-enemies' | 'single-ally' | 'all-allies' | 'self';

/** 技能类型 */
export type SkillType = 'physical' | 'magical' | 'heal' | 'buff';

/** 技能定义 */
export interface SkillDef {
  id: string;
  name: string;
  description: string;
  class: AdventurerClass;
  type: SkillType;
  cooldown: number;
  target: SkillTarget;
  multiplier: number;
  bonusCritRate?: number;
  statusEffect?: { id: StatusEffectId; duration: number; chance: number; value?: number };
}

// ========== 战士技能 ==========
const warriorSkills: SkillDef[] = [
  {
    id: 'heavy-strike',
    name: '重击',
    description: '全力挥击，造成物理伤害',
    class: 'warrior',
    type: 'physical',
    cooldown: 0,
    target: 'single-enemy',
    multiplier: 1.0,
  },
  {
    id: 'taunt',
    name: '嘲讽',
    description: '嘲讽敌人，吸引攻击并提升防御',
    class: 'warrior',
    type: 'buff',
    cooldown: 4,
    target: 'self',
    multiplier: 0,
    statusEffect: { id: 'taunt', duration: 3, chance: 1.0 },
  },
  {
    id: 'shield-bash',
    name: '盾击',
    description: '用盾牌猛击敌人，造成伤害并眩晕',
    class: 'warrior',
    type: 'physical',
    cooldown: 3,
    target: 'single-enemy',
    multiplier: 0.8,
    statusEffect: { id: 'stun', duration: 1, chance: 1.0 },
  },
];

// ========== 弓箭手技能 ==========
const archerSkills: SkillDef[] = [
  {
    id: 'precise-shot',
    name: '精准射击',
    description: '精确瞄准射击，提高暴击率',
    class: 'archer',
    type: 'physical',
    cooldown: 0,
    target: 'single-enemy',
    multiplier: 1.0,
    bonusCritRate: 0.15,
  },
  {
    id: 'multi-shot',
    name: '多重射击',
    description: '向所有敌人射出箭矢',
    class: 'archer',
    type: 'physical',
    cooldown: 3,
    target: 'all-enemies',
    multiplier: 0.6,
  },
  {
    id: 'lethal-strike',
    name: '致命一击',
    description: '全力一击，造成巨大伤害',
    class: 'archer',
    type: 'physical',
    cooldown: 4,
    target: 'single-enemy',
    multiplier: 2.0,
  },
];

// ========== 元素法师技能 ==========
const elementalMageSkills: SkillDef[] = [
  {
    id: 'magic-bolt',
    name: '魔弹',
    description: '发射魔力弹，造成魔法伤害',
    class: 'elemental-mage',
    type: 'magical',
    cooldown: 0,
    target: 'single-enemy',
    multiplier: 1.0,
  },
  {
    id: 'fireball',
    name: '火球术',
    description: '释放火球攻击所有敌人，附带灼烧',
    class: 'elemental-mage',
    type: 'magical',
    cooldown: 3,
    target: 'all-enemies',
    multiplier: 0.7,
    statusEffect: { id: 'burn', duration: 2, chance: 1.0 },
  },
  {
    id: 'ice-lance',
    name: '冰枪',
    description: '凝聚冰枪刺穿敌人，可能冻结目标',
    class: 'elemental-mage',
    type: 'magical',
    cooldown: 4,
    target: 'single-enemy',
    multiplier: 2.2,
    statusEffect: { id: 'freeze', duration: 1, chance: 0.25 },
  },
];

// ========== 生命法师技能 ==========
const lifeMageSkills: SkillDef[] = [
  {
    id: 'life-spark',
    name: '生命火花',
    description: '释放生命能量攻击敌人',
    class: 'life-mage',
    type: 'magical',
    cooldown: 0,
    target: 'single-enemy',
    multiplier: 0.5,
  },
  {
    id: 'heal',
    name: '治愈术',
    description: '治愈一名队友，恢复生命值',
    class: 'life-mage',
    type: 'heal',
    cooldown: 2,
    target: 'single-ally',
    multiplier: 1.5,
  },
  {
    id: 'blessing',
    name: '祝福',
    description: '为全队施加护盾，吸收伤害',
    class: 'life-mage',
    type: 'buff',
    cooldown: 5,
    target: 'all-allies',
    multiplier: 0.8,
    statusEffect: { id: 'shield', duration: 3, chance: 1.0 },
  },
];

/** 所有技能 */
export const ALL_SKILLS: SkillDef[] = [
  ...warriorSkills,
  ...archerSkills,
  ...elementalMageSkills,
  ...lifeMageSkills,
];

/** 按职业获取技能列表 */
export function getSkillsForClass(advClass: AdventurerClass): SkillDef[] {
  return ALL_SKILLS.filter((s) => s.class === advClass);
}

/** 按ID获取技能 */
export function getSkillDef(id: string): SkillDef | undefined {
  return ALL_SKILLS.find((s) => s.id === id);
}
