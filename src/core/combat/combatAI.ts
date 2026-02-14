import type { Adventurer, StatusEffect, WaveState } from '../types.ts';
import type { SkillDef } from './skills.ts';
import { getSkillsForClass } from './skills.ts';
import type { EffectiveStats } from '../WorldSystem.ts';

/** 检查技能是否可用（CD就绪） */
function isSkillReady(skillId: string, unitId: string, waveState: WaveState): boolean {
  const cd = waveState.cooldowns[unitId]?.[skillId];
  return cd === undefined || cd <= 0;
}

/** 检查单位是否有指定状态效果 */
function hasStatus(unitId: string, statusId: string, effects: Record<string, StatusEffect[]>): boolean {
  return (effects[unitId] ?? []).some((e) => e.id === statusId);
}

/** 战士技能选择 */
function selectWarriorSkill(
  adv: Adventurer,
  _stats: EffectiveStats,
  skills: SkillDef[],
  waveState: WaveState,
): SkillDef {
  const taunt = skills.find((s) => s.id === 'taunt')!;
  const shieldBash = skills.find((s) => s.id === 'shield-bash')!;
  const heavyStrike = skills.find((s) => s.id === 'heavy-strike')!;

  // 嘲讽未激活且CD好 → 嘲讽
  const hasTaunt = hasStatus(adv.id, 'taunt', waveState.adventurerStatusEffects);
  if (!hasTaunt && isSkillReady('taunt', adv.id, waveState)) {
    return taunt;
  }

  // 盾击CD好 → 盾击
  if (isSkillReady('shield-bash', adv.id, waveState)) {
    return shieldBash;
  }

  return heavyStrike;
}

/** 弓箭手技能选择 */
function selectArcherSkill(
  adv: Adventurer,
  _stats: EffectiveStats,
  skills: SkillDef[],
  waveState: WaveState,
): SkillDef {
  const preciseShot = skills.find((s) => s.id === 'precise-shot')!;
  const multiShot = skills.find((s) => s.id === 'multi-shot')!;
  const lethalStrike = skills.find((s) => s.id === 'lethal-strike')!;

  const aliveMonsters = waveState.monsters.filter((m) => m.hp > 0);

  // 有可击杀目标（HP<30%）且致命一击CD好 → 致命一击
  const lowHpMonster = aliveMonsters.find((m) => m.hp / m.maxHp < 0.3);
  if (lowHpMonster && isSkillReady('lethal-strike', adv.id, waveState)) {
    return lethalStrike;
  }

  // 敌人>=3 且多重射击CD好 → 多重射击
  if (aliveMonsters.length >= 3 && isSkillReady('multi-shot', adv.id, waveState)) {
    return multiShot;
  }

  return preciseShot;
}

/** 元素法师技能选择 */
function selectElementalMageSkill(
  adv: Adventurer,
  _stats: EffectiveStats,
  skills: SkillDef[],
  waveState: WaveState,
): SkillDef {
  const magicBolt = skills.find((s) => s.id === 'magic-bolt')!;
  const fireball = skills.find((s) => s.id === 'fireball')!;
  const iceLance = skills.find((s) => s.id === 'ice-lance')!;

  const aliveMonsters = waveState.monsters.filter((m) => m.hp > 0);

  // 敌人>=3 且火球术CD好 → 火球术
  if (aliveMonsters.length >= 3 && isSkillReady('fireball', adv.id, waveState)) {
    return fireball;
  }

  // 冰枪CD好 → 冰枪
  if (isSkillReady('ice-lance', adv.id, waveState)) {
    return iceLance;
  }

  return magicBolt;
}

/** 生命法师技能选择 */
function selectLifeMageSkill(
  adv: Adventurer,
  _stats: EffectiveStats,
  skills: SkillDef[],
  waveState: WaveState,
  allyMaxHps: Record<string, number>,
): SkillDef {
  const lifeSpark = skills.find((s) => s.id === 'life-spark')!;
  const heal = skills.find((s) => s.id === 'heal')!;
  const blessing = skills.find((s) => s.id === 'blessing')!;

  // 检查队友HP状况
  let lowestHpRatio = 1;
  for (const [id, hp] of Object.entries(waveState.adventurerHp)) {
    if (hp <= 0) { continue; }
    const maxHp = allyMaxHps[id] ?? hp;
    const ratio = hp / maxHp;
    if (ratio < lowestHpRatio) {
      lowestHpRatio = ratio;
    }
  }

  // 有队友HP<40% 且治愈术CD好 → 治愈术
  if (lowestHpRatio < 0.4 && isSkillReady('heal', adv.id, waveState)) {
    return heal;
  }

  // 有队友HP<70% 且祝福CD好 → 祝福
  if (lowestHpRatio < 0.7 && isSkillReady('blessing', adv.id, waveState)) {
    return blessing;
  }

  // 治愈术CD好且有人不满血 → 治愈术
  if (lowestHpRatio < 0.85 && isSkillReady('heal', adv.id, waveState)) {
    return heal;
  }

  return lifeSpark;
}

/** 为冒险者选择技能 */
export function selectSkill(
  adv: Adventurer,
  stats: EffectiveStats,
  waveState: WaveState,
  allyMaxHps: Record<string, number>,
): SkillDef {
  const skills = getSkillsForClass(adv.class);

  switch (adv.class) {
    case 'warrior':
      return selectWarriorSkill(adv, stats, skills, waveState);
    case 'archer':
      return selectArcherSkill(adv, stats, skills, waveState);
    case 'elemental-mage':
      return selectElementalMageSkill(adv, stats, skills, waveState);
    case 'life-mage':
      return selectLifeMageSkill(adv, stats, skills, waveState, allyMaxHps);
    default:
      return skills[0];
  }
}

/** 冒险者选择攻击目标：集火HP最低的怪物 */
export function selectEnemyTarget(waveState: WaveState): number {
  let lowestHp = Infinity;
  let targetIdx = -1;

  for (let i = 0; i < waveState.monsters.length; i++) {
    const m = waveState.monsters[i];
    if (m.hp > 0 && m.hp < lowestHp) {
      lowestHp = m.hp;
      targetIdx = i;
    }
  }

  return targetIdx;
}

/** 弓箭手致命一击目标：HP百分比最低的怪物 */
export function selectLowestHpEnemy(waveState: WaveState): number {
  let lowestRatio = Infinity;
  let targetIdx = -1;

  for (let i = 0; i < waveState.monsters.length; i++) {
    const m = waveState.monsters[i];
    if (m.hp > 0) {
      const ratio = m.hp / m.maxHp;
      if (ratio < lowestRatio) {
        lowestRatio = ratio;
        targetIdx = i;
      }
    }
  }

  return targetIdx;
}

/** 生命法师选择治疗目标：HP百分比最低的队友 */
export function selectHealTarget(waveState: WaveState, allyMaxHps: Record<string, number>): string | null {
  let lowestRatio = Infinity;
  let targetId: string | null = null;

  for (const [id, hp] of Object.entries(waveState.adventurerHp)) {
    if (hp <= 0) { continue; }
    const maxHp = allyMaxHps[id] ?? hp;
    const ratio = hp / maxHp;
    if (ratio < lowestRatio) {
      lowestRatio = ratio;
      targetId = id;
    }
  }

  return targetId;
}

/** 怪物选择攻击目标：有嘲讽时70%概率攻击嘲讽者，否则随机 */
export function selectMonsterTarget(waveState: WaveState): string | null {
  const aliveIds = Object.entries(waveState.adventurerHp)
    .filter(([_id, hp]) => hp > 0)
    .map(([id]) => id);

  if (aliveIds.length === 0) { return null; }

  // 检查是否有嘲讽者
  const taunterId = aliveIds.find((id) =>
    (waveState.adventurerStatusEffects[id] ?? []).some((e) => e.id === 'taunt')
  );

  if (taunterId && Math.random() < 0.7) {
    return taunterId;
  }

  return aliveIds[Math.floor(Math.random() * aliveIds.length)];
}
