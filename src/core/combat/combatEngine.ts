import type { Adventurer, GameState, Party, MonsterInstance, StatusEffect, WaveState, CombatLogEntry, MonsterSkillDef } from '../types.ts';
import { getEffectiveStats } from '../WorldSystem.ts';
import type { EffectiveStats } from '../WorldSystem.ts';
import { getMonsterDef } from '../monsterConfig.ts';
import { selectSkill, selectEnemyTarget, selectLowestHpEnemy, selectHealTarget, selectMonsterTarget } from './combatAI.ts';

/** 战斗回合结果 */
export type CombatTickResult = 'continue' | 'wave-clear' | 'all-dead';

interface CombatUnit {
  id: string;
  type: 'adventurer' | 'monster';
  speed: number;
  index?: number; // 怪物在数组中的索引
}

/** 添加战斗日志 */
function addLog(waveState: WaveState, text: string, type: CombatLogEntry['type']): void {
  waveState.combatLog.push({ timestamp: Date.now(), text, type });
  if (waveState.combatLog.length > 20) {
    waveState.combatLog = waveState.combatLog.slice(-20);
  }
}

/** 计算物理伤害 */
function calcPhysicalDamage(attack: number, defense: number, multiplier: number, critRate: number, critDamage: number): { damage: number; isCrit: boolean } {
  const baseDmg = Math.max(1, attack * multiplier - defense * 0.5);
  const randomFactor = 0.85 + Math.random() * 0.3;
  let damage = Math.floor(baseDmg * randomFactor);
  const isCrit = Math.random() < critRate;
  if (isCrit) {
    damage = Math.floor(damage * critDamage);
  }
  return { damage, isCrit };
}

/** 计算魔法伤害 */
function calcMagicDamage(magicPower: number, magicResist: number, multiplier: number, critRate: number, critDamage: number): { damage: number; isCrit: boolean } {
  const baseDmg = Math.max(1, magicPower * multiplier - magicResist * 0.4);
  const randomFactor = 0.85 + Math.random() * 0.3;
  let damage = Math.floor(baseDmg * randomFactor);
  const isCrit = Math.random() < critRate;
  if (isCrit) {
    damage = Math.floor(damage * critDamage);
  }
  return { damage, isCrit };
}

/** 对目标施加伤害（考虑护盾） */
function applyDamageToAdventurer(waveState: WaveState, targetId: string, damage: number): number {
  const effects = waveState.adventurerStatusEffects[targetId] ?? [];
  const shieldIdx = effects.findIndex((e) => e.id === 'shield');

  if (shieldIdx >= 0) {
    const shield = effects[shieldIdx];
    if (shield.value && shield.value > 0) {
      if (damage <= shield.value) {
        shield.value -= damage;
        return 0;
      } else {
        damage -= shield.value;
        shield.value = 0;
        effects.splice(shieldIdx, 1);
        waveState.adventurerStatusEffects[targetId] = effects;
      }
    }
  }

  waveState.adventurerHp[targetId] = Math.max(0, (waveState.adventurerHp[targetId] ?? 0) - damage);
  return damage;
}

/** 对怪物施加伤害 */
function applyDamageToMonster(monster: MonsterInstance, damage: number): number {
  const actual = Math.min(monster.hp, damage);
  monster.hp = Math.max(0, monster.hp - damage);
  return actual;
}

/** 减少所有CD */
function tickCooldowns(waveState: WaveState): void {
  for (const unitId of Object.keys(waveState.cooldowns)) {
    const cds = waveState.cooldowns[unitId];
    for (const skillId of Object.keys(cds)) {
      if (cds[skillId] > 0) {
        cds[skillId] -= 1;
      }
    }
  }
}

/** 设置技能CD */
function setCooldown(waveState: WaveState, unitId: string, skillId: string, cd: number): void {
  if (!waveState.cooldowns[unitId]) {
    waveState.cooldowns[unitId] = {};
  }
  waveState.cooldowns[unitId][skillId] = cd;
}

/** 处理状态效果tick（回合开始时） */
function tickStatusEffects(waveState: WaveState, advNames: Record<string, string>): void {
  // 冒险者状态效果
  for (const [id, effects] of Object.entries(waveState.adventurerStatusEffects)) {
    if (waveState.adventurerHp[id] <= 0) { continue; }
    for (const effect of effects) {
      if (effect.id === 'burn' && effect.value) {
        const dmg = effect.value;
        applyDamageToAdventurer(waveState, id, dmg);
        addLog(waveState, `${advNames[id] ?? '???'} 受到灼烧伤害 ${dmg}`, 'damage');
      }
    }
    // 减少持续时间，移除过期效果
    waveState.adventurerStatusEffects[id] = effects
      .map((e) => ({ ...e, remainingTurns: e.remainingTurns - 1 }))
      .filter((e) => e.remainingTurns > 0);
  }

  // 怪物状态效果
  for (const [idxStr, effects] of Object.entries(waveState.monsterStatusEffects)) {
    const idx = Number(idxStr);
    const monster = waveState.monsters[idx];
    if (!monster || monster.hp <= 0) { continue; }
    const monDef = getMonsterDef(monster.defId);
    const monName = monDef?.name ?? '怪物';
    for (const effect of effects) {
      if (effect.id === 'burn' && effect.value) {
        const dmg = effect.value;
        applyDamageToMonster(monster, dmg);
        addLog(waveState, `${monName} 受到灼烧伤害 ${dmg}`, 'damage');
      }
    }
    waveState.monsterStatusEffects[idx] = effects
      .map((e) => ({ ...e, remainingTurns: e.remainingTurns - 1 }))
      .filter((e) => e.remainingTurns > 0);
  }
}

/** 检查单位是否被眩晕/冻结 */
function isStunned(unitId: string, effects: Record<string, StatusEffect[]>): boolean {
  return (effects[unitId] ?? []).some((e) => e.id === 'stun' || e.id === 'freeze');
}

function isMonsterStunned(monsterIdx: number, waveState: WaveState): boolean {
  return (waveState.monsterStatusEffects[monsterIdx] ?? []).some((e) => e.id === 'stun' || e.id === 'freeze');
}

/** 施加状态效果到怪物 */
function applyStatusToMonster(waveState: WaveState, monsterIdx: number, effect: StatusEffect): void {
  if (!waveState.monsterStatusEffects[monsterIdx]) {
    waveState.monsterStatusEffects[monsterIdx] = [];
  }
  // 同类效果不叠加，刷新持续时间
  const existing = waveState.monsterStatusEffects[monsterIdx].findIndex((e) => e.id === effect.id);
  if (existing >= 0) {
    waveState.monsterStatusEffects[monsterIdx][existing] = effect;
  } else {
    waveState.monsterStatusEffects[monsterIdx].push(effect);
  }
}

/** 施加状态效果到冒险者 */
function applyStatusToAdventurer(waveState: WaveState, advId: string, effect: StatusEffect): void {
  if (!waveState.adventurerStatusEffects[advId]) {
    waveState.adventurerStatusEffects[advId] = [];
  }
  const existing = waveState.adventurerStatusEffects[advId].findIndex((e) => e.id === effect.id);
  if (existing >= 0) {
    waveState.adventurerStatusEffects[advId][existing] = effect;
  } else {
    waveState.adventurerStatusEffects[advId].push(effect);
  }
}

/** 执行冒险者行动 */
function executeAdventurerAction(
  adv: Adventurer,
  stats: EffectiveStats,
  waveState: WaveState,
  allyMaxHps: Record<string, number>,
  advNames: Record<string, string>,
): void {
  if (waveState.adventurerHp[adv.id] <= 0) { return; }
  if (isStunned(adv.id, waveState.adventurerStatusEffects)) {
    addLog(waveState, `${adv.name} 被控制，无法行动！`, 'status');
    return;
  }

  const skill = selectSkill(adv, stats, waveState, allyMaxHps);
  const critRate = stats.critRate + (skill.bonusCritRate ?? 0);

  // 设置CD
  if (skill.cooldown > 0) {
    setCooldown(waveState, adv.id, skill.id, skill.cooldown);
  }

  // 根据技能类型执行
  switch (skill.type) {
    case 'physical': {
      if (skill.target === 'all-enemies') {
        // AOE物理
        const aliveMonsters = waveState.monsters.filter((m) => m.hp > 0);
        let totalDmg = 0;
        let anyCrit = false;
        for (const monster of aliveMonsters) {
          const monDef = getMonsterDef(monster.defId);
          const { damage, isCrit } = calcPhysicalDamage(stats.attack, monDef?.defense ?? 0, skill.multiplier, critRate, stats.critDamage);
          applyDamageToMonster(monster, damage);
          totalDmg += damage;
          if (isCrit) { anyCrit = true; }
          // 状态效果
          if (skill.statusEffect && Math.random() < skill.statusEffect.chance) {
            const idx = waveState.monsters.indexOf(monster);
            applyStatusToMonster(waveState, idx, {
              id: skill.statusEffect.id,
              sourceId: adv.id,
              remainingTurns: skill.statusEffect.duration,
              value: skill.statusEffect.value,
            });
          }
        }
        addLog(waveState, `${adv.name} 使用 ${skill.name} → 全体敌人 ${totalDmg} 伤害${anyCrit ? ' (暴击!)' : ''}`, 'skill');
      } else {
        // 单体物理
        const targetIdx = skill.id === 'lethal-strike' ? selectLowestHpEnemy(waveState) : selectEnemyTarget(waveState);
        if (targetIdx < 0) { return; }
        const monster = waveState.monsters[targetIdx];
        const monDef = getMonsterDef(monster.defId);
        const { damage, isCrit } = calcPhysicalDamage(stats.attack, monDef?.defense ?? 0, skill.multiplier, critRate, stats.critDamage);
        applyDamageToMonster(monster, damage);
        const monName = monDef?.name ?? '怪物';
        addLog(waveState, `${adv.name} ${skill.name} → ${monName} ${damage} 伤害${isCrit ? ' (暴击!)' : ''}`, 'skill');
        // 状态效果
        if (skill.statusEffect && Math.random() < skill.statusEffect.chance) {
          applyStatusToMonster(waveState, targetIdx, {
            id: skill.statusEffect.id,
            sourceId: adv.id,
            remainingTurns: skill.statusEffect.duration,
            value: skill.statusEffect.value,
          });
          const statusNames: Record<string, string> = { stun: '眩晕', freeze: '冻结', burn: '灼烧' };
          addLog(waveState, `${monName} 被${statusNames[skill.statusEffect.id] ?? skill.statusEffect.id}了！`, 'status');
        }
        if (monster.hp <= 0) {
          addLog(waveState, `${monName} 被击败！`, 'death');
        }
      }
      break;
    }
    case 'magical': {
      if (skill.target === 'all-enemies') {
        // AOE魔法
        const aliveMonsters = waveState.monsters.filter((m) => m.hp > 0);
        let totalDmg = 0;
        let anyCrit = false;
        for (const monster of aliveMonsters) {
          const monDef = getMonsterDef(monster.defId);
          const { damage, isCrit } = calcMagicDamage(stats.magicPower, monDef?.magicResist ?? 0, skill.multiplier, critRate, stats.critDamage);
          applyDamageToMonster(monster, damage);
          totalDmg += damage;
          if (isCrit) { anyCrit = true; }
          if (skill.statusEffect && Math.random() < skill.statusEffect.chance) {
            const idx = waveState.monsters.indexOf(monster);
            const burnValue = skill.statusEffect.id === 'burn' ? Math.floor(stats.magicPower * 0.2) : skill.statusEffect.value;
            applyStatusToMonster(waveState, idx, {
              id: skill.statusEffect.id,
              sourceId: adv.id,
              remainingTurns: skill.statusEffect.duration,
              value: burnValue,
            });
          }
        }
        addLog(waveState, `${adv.name} 使用 ${skill.name} → 全体敌人 ${totalDmg} 伤害${anyCrit ? ' (暴击!)' : ''}`, 'skill');
      } else {
        // 单体魔法
        const targetIdx = selectEnemyTarget(waveState);
        if (targetIdx < 0) { return; }
        const monster = waveState.monsters[targetIdx];
        const monDef = getMonsterDef(monster.defId);
        const { damage, isCrit } = calcMagicDamage(stats.magicPower, monDef?.magicResist ?? 0, skill.multiplier, critRate, stats.critDamage);
        applyDamageToMonster(monster, damage);
        const monName = monDef?.name ?? '怪物';
        addLog(waveState, `${adv.name} ${skill.name} → ${monName} ${damage} 伤害${isCrit ? ' (暴击!)' : ''}`, 'skill');
        if (skill.statusEffect && Math.random() < skill.statusEffect.chance) {
          const burnValue = skill.statusEffect.id === 'burn' ? Math.floor(stats.magicPower * 0.2) : skill.statusEffect.value;
          applyStatusToMonster(waveState, targetIdx, {
            id: skill.statusEffect.id,
            sourceId: adv.id,
            remainingTurns: skill.statusEffect.duration,
            value: burnValue,
          });
          const statusNames: Record<string, string> = { stun: '眩晕', freeze: '冻结', burn: '灼烧' };
          addLog(waveState, `${monName} 被${statusNames[skill.statusEffect.id] ?? skill.statusEffect.id}了！`, 'status');
        }
        if (monster.hp <= 0) {
          addLog(waveState, `${monName} 被击败！`, 'death');
        }
      }
      break;
    }
    case 'heal': {
      const targetId = selectHealTarget(waveState, allyMaxHps);
      if (!targetId) { return; }
      const healAmount = Math.floor(stats.magicPower * skill.multiplier);
      const maxHp = allyMaxHps[targetId] ?? 999;
      const currentHp = waveState.adventurerHp[targetId] ?? 0;
      const actualHeal = Math.min(healAmount, maxHp - currentHp);
      waveState.adventurerHp[targetId] = Math.min(maxHp, currentHp + healAmount);
      const targetName = advNames[targetId] ?? '队友';
      addLog(waveState, `${adv.name} ${skill.name} → ${targetName} 恢复 ${actualHeal} HP`, 'heal');
      break;
    }
    case 'buff': {
      if (skill.id === 'taunt') {
        // 嘲讽：自身获得嘲讽状态 + 防御提升
        applyStatusToAdventurer(waveState, adv.id, {
          id: 'taunt',
          sourceId: adv.id,
          remainingTurns: skill.statusEffect!.duration,
        });
        applyStatusToAdventurer(waveState, adv.id, {
          id: 'defense-up',
          sourceId: adv.id,
          remainingTurns: skill.statusEffect!.duration,
          value: Math.floor(stats.defense * 0.2),
        });
        addLog(waveState, `${adv.name} 使用了 ${skill.name}！吸引敌人攻击`, 'skill');
      } else if (skill.id === 'blessing') {
        // 祝福：全队护盾
        const shieldValue = Math.floor(stats.magicPower * skill.multiplier);
        for (const [id, hp] of Object.entries(waveState.adventurerHp)) {
          if (hp > 0) {
            applyStatusToAdventurer(waveState, id, {
              id: 'shield',
              sourceId: adv.id,
              remainingTurns: skill.statusEffect!.duration,
              value: shieldValue,
            });
          }
        }
        addLog(waveState, `${adv.name} 使用了 ${skill.name}！全队获得 ${shieldValue} 护盾`, 'skill');
      }
      break;
    }
  }
}

/** 执行怪物行动 */
function executeMonsterAction(
  monsterIdx: number,
  waveState: WaveState,
  advNames: Record<string, string>,
  advStatsMap: Record<string, EffectiveStats>,
): void {
  const monster = waveState.monsters[monsterIdx];
  if (!monster || monster.hp <= 0) { return; }
  if (isMonsterStunned(monsterIdx, waveState)) {
    const monDef = getMonsterDef(monster.defId);
    addLog(waveState, `${monDef?.name ?? '怪物'} 被控制，无法行动！`, 'status');
    return;
  }

  const monDef = getMonsterDef(monster.defId);
  if (!monDef) { return; }
  const monName = monDef.name;
  const monsterId = `monster-${monsterIdx}`;

  // 检查是否有可用技能
  let chosenSkill: MonsterSkillDef | null = null;
  if (monDef.skills) {
    for (const skill of monDef.skills) {
      const cd = waveState.cooldowns[monsterId]?.[skill.id];
      if (cd === undefined || cd <= 0) {
        chosenSkill = skill;
        break;
      }
    }
  }

  if (chosenSkill) {
    // 使用技能
    if (chosenSkill.cooldown > 0) {
      setCooldown(waveState, monsterId, chosenSkill.id, chosenSkill.cooldown);
    }

    if (chosenSkill.target === 'all') {
      // AOE
      let totalDmg = 0;
      for (const [id, hp] of Object.entries(waveState.adventurerHp)) {
        if (hp <= 0) { continue; }
        const targetStats = advStatsMap[id];
        let damage: number;
        if (chosenSkill.type === 'magical') {
          damage = calcMagicDamage(monDef.magicPower, targetStats?.magicResist ?? 0, chosenSkill.multiplier, 0, 1.5).damage;
        } else {
          damage = calcPhysicalDamage(monDef.attack, targetStats?.defense ?? 0, chosenSkill.multiplier, 0, 1.5).damage;
        }
        applyDamageToAdventurer(waveState, id, damage);
        totalDmg += damage;
        // 状态效果
        if (chosenSkill.statusEffect && Math.random() < chosenSkill.statusEffect.chance) {
          applyStatusToAdventurer(waveState, id, {
            id: chosenSkill.statusEffect.id,
            sourceId: monsterId,
            remainingTurns: chosenSkill.statusEffect.duration,
            value: chosenSkill.statusEffect.value,
          });
        }
      }
      addLog(waveState, `${monName} 使用 ${chosenSkill.name}！全体 ${totalDmg} 伤害`, 'skill');
    } else {
      // 单体
      const targetId = chosenSkill.target === 'lowest-hp'
        ? findLowestHpAdventurer(waveState)
        : selectMonsterTarget(waveState);
      if (!targetId) { return; }
      const targetStats = advStatsMap[targetId];
      let damage: number;
      if (chosenSkill.type === 'magical') {
        damage = calcMagicDamage(monDef.magicPower, targetStats?.magicResist ?? 0, chosenSkill.multiplier, 0, 1.5).damage;
      } else {
        damage = calcPhysicalDamage(monDef.attack, targetStats?.defense ?? 0, chosenSkill.multiplier, 0, 1.5).damage;
      }
      applyDamageToAdventurer(waveState, targetId, damage);
      const targetName = advNames[targetId] ?? '冒险者';
      addLog(waveState, `${monName} ${chosenSkill.name} → ${targetName} ${damage} 伤害`, 'skill');
      if (chosenSkill.statusEffect && Math.random() < chosenSkill.statusEffect.chance) {
        applyStatusToAdventurer(waveState, targetId, {
          id: chosenSkill.statusEffect.id,
          sourceId: monsterId,
          remainingTurns: chosenSkill.statusEffect.duration,
          value: chosenSkill.statusEffect.value,
        });
        const statusNames: Record<string, string> = { stun: '眩晕', freeze: '冻结', burn: '灼烧', 'defense-up': '减防' };
        addLog(waveState, `${targetName} 被${statusNames[chosenSkill.statusEffect.id] ?? chosenSkill.statusEffect.id}了！`, 'status');
      }
      if ((waveState.adventurerHp[targetId] ?? 0) <= 0) {
        addLog(waveState, `${targetName} 倒下了！`, 'death');
      }
    }
  } else {
    // 普攻
    const targetId = selectMonsterTarget(waveState);
    if (!targetId) { return; }
    const targetStats = advStatsMap[targetId];
    const { damage, isCrit } = calcPhysicalDamage(monDef.attack, targetStats?.defense ?? 0, 1.0, 0.03, 1.5);
    applyDamageToAdventurer(waveState, targetId, damage);
    const targetName = advNames[targetId] ?? '冒险者';
    addLog(waveState, `${monName} → ${targetName} ${damage} 伤害${isCrit ? ' (暴击!)' : ''}`, 'damage');
    if ((waveState.adventurerHp[targetId] ?? 0) <= 0) {
      addLog(waveState, `${targetName} 倒下了！`, 'death');
    }
  }
}

/** 找HP百分比最低的冒险者 */
function findLowestHpAdventurer(waveState: WaveState): string | null {
  let lowestRatio = Infinity;
  let targetId: string | null = null;
  for (const [id, hp] of Object.entries(waveState.adventurerHp)) {
    if (hp <= 0) { continue; }
    if (hp < lowestRatio) {
      lowestRatio = hp;
      targetId = id;
    }
  }
  return targetId;
}

/**
 * 执行一个战斗回合
 * 返回: 'continue' | 'wave-clear' | 'all-dead'
 */
export function executeCombatTick(party: Party, state: GameState): CombatTickResult {
  const waveState = party.waveState;
  if (!waveState) { return 'continue'; }

  // 构建辅助数据
  const advNames: Record<string, string> = {};
  const allyMaxHps: Record<string, number> = {};
  const advMap: Record<string, Adventurer> = {};
  const advStats: Record<string, EffectiveStats> = {};

  for (const memberId of party.memberIds) {
    const adv = state.adventurers.find((a) => a.id === memberId);
    if (adv) {
      advNames[adv.id] = adv.name;
      const stats = getEffectiveStats(adv);
      allyMaxHps[adv.id] = stats.maxHp;
      advMap[adv.id] = adv;
      advStats[adv.id] = stats;
    }
  }

  // 1. 状态效果tick
  tickStatusEffects(waveState, advNames);

  // 2. 减少所有CD
  tickCooldowns(waveState);

  // 3. 构建行动顺序（按speed降序）
  const units: CombatUnit[] = [];

  for (const memberId of party.memberIds) {
    if ((waveState.adventurerHp[memberId] ?? 0) > 0) {
      const stats = advStats[memberId];
      units.push({
        id: memberId,
        type: 'adventurer',
        speed: stats?.speed ?? 5,
      });
    }
  }

  for (let i = 0; i < waveState.monsters.length; i++) {
    const m = waveState.monsters[i];
    if (m.hp > 0) {
      const monDef = getMonsterDef(m.defId);
      units.push({
        id: `monster-${i}`,
        type: 'monster',
        speed: monDef?.speed ?? 5,
        index: i,
      });
    }
  }

  // 按speed降序排列，同速随机
  units.sort((a, b) => {
    if (b.speed !== a.speed) { return b.speed - a.speed; }
    return Math.random() - 0.5;
  });

  // 4. 依次执行行动
  for (const unit of units) {
    // 每次行动前检查战斗是否已结束
    const aliveAdvs = Object.entries(waveState.adventurerHp).filter(([_id, hp]) => hp > 0);
    const aliveMons = waveState.monsters.filter((m) => m.hp > 0);
    if (aliveAdvs.length === 0) { return 'all-dead'; }
    if (aliveMons.length === 0) { return 'wave-clear'; }

    if (unit.type === 'adventurer') {
      const adv = advMap[unit.id];
      const stats = advStats[unit.id];
      if (adv && stats && (waveState.adventurerHp[unit.id] ?? 0) > 0) {
        executeAdventurerAction(adv, stats, waveState, allyMaxHps, advNames);
      }
    } else {
      const idx = unit.index!;
      if (waveState.monsters[idx].hp > 0) {
        executeMonsterAction(idx, waveState, advNames, advStats);
      }
    }
  }

  // 5. 最终检查
  const finalAliveAdvs = Object.entries(waveState.adventurerHp).filter(([_id, hp]) => hp > 0);
  const finalAliveMons = waveState.monsters.filter((m) => m.hp > 0);

  if (finalAliveAdvs.length === 0) { return 'all-dead'; }
  if (finalAliveMons.length === 0) { return 'wave-clear'; }

  return 'continue';
}
