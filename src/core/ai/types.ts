import type { Adventurer, AdventurerStatus, GameState } from '../types.ts';

export interface ActionContext {
  readonly adventurer: Adventurer;
  readonly state: GameState;
}

export interface ActionEffect {
  hpDelta?: number;
  xpDelta?: number;
  goldDelta?: number;
  statusAfter: 'idle';
}

export interface ActionDefinition {
  id: string;
  label: string;
  status: AdventurerStatus;
  requiredBuildingId?: string;
  minBuildingLevel?: number;
  duration: (ctx: ActionContext) => number;
  score: (ctx: ActionContext) => number;
  effect: (ctx: ActionContext) => ActionEffect;
  describe: (ctx: ActionContext) => string;
}
