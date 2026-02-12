import type { ActionContext, ActionDefinition } from './types.ts';
import { findBestAffordable } from '../equipmentConfig.ts';

function getBuildingLevel(ctx: ActionContext, buildingId: string): number {
  const building = ctx.state.buildings.find((b) => b.id === buildingId);
  return building ? building.level : 0;
}

function hpPercent(ctx: ActionContext): number {
  return ctx.adventurer.maxHp > 0 ? ctx.adventurer.hp / ctx.adventurer.maxHp : 1;
}

const restAction: ActionDefinition = {
  id: 'rest',
  label: '休息',
  status: 'resting',
  requiredBuildingId: 'tavern',
  minBuildingLevel: 1,
  duration: () => 4000,
  score: (ctx) => {
    const hp = hpPercent(ctx);
    let base = 1.0 - hp;
    if (hp < 0.3) {
      base = Math.max(base, 0.9);
    }
    if (ctx.adventurer.class === 'priest' || ctx.adventurer.class === 'healer') {
      base *= 0.8;
    }
    return base;
  },
  effect: () => {
    // 回血在 tick 中持续结算，完成时不再额外回复
    return { statusAfter: 'idle' };
  },
  describe: (ctx) => {
    const tavern = ctx.state.buildings.find((b) => b.id === 'tavern');
    return `在${tavern?.name ?? '酒馆'}休息恢复体力`;
  },
};

const gatherAction: ActionDefinition = {
  id: 'gather',
  label: '采集',
  status: 'gathering',
  requiredBuildingId: 'general-store',
  minBuildingLevel: 1,
  duration: () => 3500,
  score: (ctx) => {
    let base = 0.35;
    if (ctx.adventurer.class === 'archer') { base *= 1.3; }
    if (ctx.adventurer.class === 'healer') { base *= 1.2; }
    const storeLv = getBuildingLevel(ctx, 'general-store');
    base *= 1 + storeLv * 0.05;
    return base;
  },
  effect: (ctx) => {
    const gold = 2;
    const xp = 8 + ctx.adventurer.level * 2;
    return { goldDelta: gold, xpDelta: xp, statusAfter: 'idle' };
  },
  describe: () => '在野外采集资源',
};

const workAction: ActionDefinition = {
  id: 'work',
  label: '打工',
  status: 'working',
  requiredBuildingId: 'guild-hall',
  minBuildingLevel: 1,
  duration: () => 4000,
  score: (ctx) => {
    let base = 0.4;
    if (ctx.adventurer.class === 'priest') { base *= 1.2; }
    const guildLv = getBuildingLevel(ctx, 'guild-hall');
    base *= 1 + guildLv * 0.03;
    return base;
  },
  effect: (ctx) => {
    const guildLv = getBuildingLevel(ctx, 'guild-hall');
    const gold = 2 + ctx.adventurer.level + guildLv;
    const xp = 3 + ctx.adventurer.level;
    return { goldDelta: gold, xpDelta: xp, statusAfter: 'idle' };
  },
  describe: (ctx) => {
    const guild = ctx.state.buildings.find((b) => b.id === 'guild-hall');
    return `在${guild?.name ?? '工会大厅'}打工赚钱`;
  },
};

const buyEquipmentAction: ActionDefinition = {
  id: 'buy-equipment',
  label: '购买装备',
  status: 'gathering',
  requiredBuildingId: 'general-store',
  minBuildingLevel: 1,
  duration: () => 3000,
  score: (ctx) => {
    if (ctx.adventurer.gold < 15) { return 0; }
    const { equipment } = ctx.adventurer;
    const hasEmptySlot = !equipment.weapon || !equipment.armor;
    if (hasEmptySlot) {
      // 检查是否真的买得起空槽位的装备
      const emptySlot = !equipment.weapon ? 'weapon' : 'armor';
      const canBuy = findBestAffordable(emptySlot as 'weapon' | 'armor', ctx.adventurer.gold, null);
      return canBuy ? 0.7 : 0;
    }
    // 已满装，检查是否有更好的装备可买
    const betterWeapon = findBestAffordable('weapon', ctx.adventurer.gold, equipment.weapon);
    const betterArmor = findBestAffordable('armor', ctx.adventurer.gold, equipment.armor);
    return (betterWeapon || betterArmor) ? 0.3 : 0;
  },
  effect: () => {
    return { statusAfter: 'idle' };
  },
  describe: () => '前往杂货店选购装备',
};

const queuePartyAction: ActionDefinition = {
  id: 'queue-party',
  label: '组队',
  status: 'queuing',
  requiredBuildingId: 'guild-hall',
  minBuildingLevel: 2,
  duration: () => 60000,
  score: (ctx) => {
    const hp = hpPercent(ctx);
    if (hp < 0.5) { return 0; }  // 血量<50%不组队
    let base = 0.85;             // 高于explore(0.5)、fight(0.4)
    base *= (0.7 + hp * 0.3);
    if (ctx.adventurer.class === 'warrior') { base *= 1.2; }
    if (ctx.adventurer.class === 'mage') { base *= 1.15; }
    return base;
  },
  effect: () => ({ statusAfter: 'idle' }),
  describe: () => '前往工会大厅寻找队友',
};

export const ALL_ACTIONS: ActionDefinition[] = [
  restAction,
  gatherAction,
  workAction,
  buyEquipmentAction,
  queuePartyAction,
];
