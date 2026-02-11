import type { ActionContext, ActionDefinition } from './types.ts';

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

const exploreAction: ActionDefinition = {
  id: 'explore',
  label: '探索',
  status: 'exploring',
  duration: () => 5000,
  score: (ctx) => {
    const hp = hpPercent(ctx);
    if (hp < 0.2) { return 0; }
    let base = 0.5 * (0.5 + hp * 0.5);
    if (ctx.adventurer.class === 'archer') { base *= 1.2; }
    const guildLv = getBuildingLevel(ctx, 'guild-hall');
    base *= 1 + guildLv * 0.05;
    return base;
  },
  effect: (ctx) => {
    const guildLv = getBuildingLevel(ctx, 'guild-hall');
    const gold = 5 + ctx.adventurer.level * 3 + guildLv * 2;
    const xp = 10 + ctx.adventurer.level * 2;
    const hpLoss = -Math.floor(ctx.adventurer.maxHp * 0.05);
    return { goldDelta: gold, xpDelta: xp, hpDelta: hpLoss, statusAfter: 'idle' };
  },
  describe: () => '外出探索未知区域',
};

const fightAction: ActionDefinition = {
  id: 'fight',
  label: '战斗',
  status: 'fighting',
  duration: () => 6000,
  score: (ctx) => {
    const hp = hpPercent(ctx);
    if (hp < 0.35) { return 0; }
    let base = 0.4 * (hp * 0.8 + 0.2);
    if (ctx.adventurer.class === 'warrior') { base *= 1.4; }
    if (ctx.adventurer.class === 'mage') { base *= 1.25; }
    if (ctx.adventurer.class === 'priest') { base *= 0.5; }
    return base;
  },
  effect: (ctx) => {
    const gold = 10 + Math.floor(ctx.adventurer.attack * 0.5);
    const xp = 15 + ctx.adventurer.level * 3;
    const hpLoss = -Math.max(1, Math.floor(ctx.adventurer.maxHp * (0.15 - ctx.adventurer.defense * 0.003)));
    return { goldDelta: gold, xpDelta: xp, hpDelta: hpLoss, statusAfter: 'idle' };
  },
  describe: () => '与地牢怪物激烈战斗',
};
const guardAction: ActionDefinition = {
  id: 'guard',
  label: '守卫',
  status: 'guarding',
  duration: () => 4000,
  score: (ctx) => {
    const builtBuildings = ctx.state.buildings.filter((b) => b.level >= 1);
    if (builtBuildings.length === 0) { return 0; }
    let base = 0.3;
    if (ctx.adventurer.class === 'warrior') { base *= 1.3; }
    if (ctx.adventurer.class === 'priest') { base *= 1.2; }
    base += ctx.adventurer.defense * 0.005;
    return base;
  },
  effect: (ctx) => {
    const gold = 3 + ctx.adventurer.level;
    const xp = 5 + ctx.adventurer.level;
    return { goldDelta: gold, xpDelta: xp, statusAfter: 'idle' };
  },
  describe: (ctx) => {
    const built = ctx.state.buildings.filter((b) => b.level >= 1);
    const target = built.length > 0 ? built[Math.floor(Math.random() * built.length)] : null;
    return `守卫${target?.name ?? '营地'}的安全`;
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

const trainAction: ActionDefinition = {
  id: 'train',
  label: '训练',
  status: 'training',
  requiredBuildingId: 'guild-hall',
  minBuildingLevel: 1,
  duration: () => 5000,
  score: (ctx) => {
    const hp = hpPercent(ctx);
    let base = 0.45 * (0.6 + hp * 0.4);
    if (ctx.adventurer.class === 'mage') { base *= 1.3; }
    if (ctx.adventurer.class === 'priest') { base *= 1.2; }
    const guildLv = getBuildingLevel(ctx, 'guild-hall');
    base *= 1 + guildLv * 0.05;
    return base;
  },
  effect: (ctx) => {
    const guildLv = getBuildingLevel(ctx, 'guild-hall');
    const gold = 1;
    const xp = 20 + ctx.adventurer.level * 3 + guildLv * 5;
    return { goldDelta: gold, xpDelta: xp, statusAfter: 'idle' };
  },
  describe: (ctx) => {
    const guild = ctx.state.buildings.find((b) => b.id === 'guild-hall');
    return `在${guild?.name ?? '工会大厅'}刻苦训练`;
  },
};

export const ALL_ACTIONS: ActionDefinition[] = [
  restAction,
  exploreAction,
  fightAction,
  guardAction,
  gatherAction,
  trainAction,
];
