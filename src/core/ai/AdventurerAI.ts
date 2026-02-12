import type { Adventurer, GameState } from '../types.ts';
import type { ActionContext, ActionDefinition } from './types.ts';
import { ALL_ACTIONS } from './actions.ts';
import { getEquipmentDef } from '../equipmentConfig.ts';

function buildContext(adventurer: Adventurer, state: GameState): ActionContext {
  let attack = adventurer.attack;
  let defense = adventurer.defense;
  let maxHp = adventurer.maxHp;
  for (const equipId of [adventurer.equipment.weapon, adventurer.equipment.armor]) {
    if (!equipId) { continue; }
    const def = getEquipmentDef(equipId);
    if (!def) { continue; }
    attack += def.stats.attack ?? 0;
    defense += def.stats.defense ?? 0;
    maxHp += def.stats.maxHp ?? 0;
  }
  return { adventurer, state, effectiveAttack: attack, effectiveDefense: defense, effectiveMaxHp: maxHp };
}

export class AdventurerAI {
  static pickAction(adventurer: Adventurer, state: GameState): ActionDefinition | null {
    const ctx: ActionContext = buildContext(adventurer, state);

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
}
