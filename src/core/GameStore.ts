import type { GameState } from './types.ts';
import { EventEmitter } from './EventEmitter.ts';
import { createInitialState } from './initialState.ts';
import { WorldSystem } from './WorldSystem.ts';

export class GameStore {
  private static _instance: GameStore | null = null;

  private _state: GameState;
  private _snapshot: GameState;
  private _emitter = new EventEmitter();
  private _decisionTimer: ReturnType<typeof setInterval> | null = null;
  private _worldSystem = new WorldSystem();

  private constructor() {
    this._state = createInitialState();
    this._snapshot = this._state;
    this.startAdventurerAI();
  }

  static get Instance(): GameStore {
    if (!GameStore._instance) {
      GameStore._instance = new GameStore();
    }
    return GameStore._instance;
  }

  get State(): GameState {
    return this._snapshot;
  }

  subscribe(listener: () => void): () => void {
    return this._emitter.subscribe(listener);
  }

  private _notify(): void {
    this._snapshot = { ...this._state };
    this._emitter.emit();
  }

  attackEnemy(): void {
    const combat = this._state.combat;
    // 玩家攻击敌人
    combat.enemyHp = Math.max(0, combat.enemyHp - combat.playerAttack);

    if (combat.enemyHp <= 0) {
      // 敌人被击败
      combat.enemiesDefeated += 1;
      this._state.gold += combat.enemyGoldReward;
      // 重置敌人
      combat.enemyHp = combat.enemyMaxHp;
    } else {
      // 敌人反击
      combat.playerHp = Math.max(0, combat.playerHp - combat.enemyAttack);
      if (combat.playerHp <= 0) {
        // 玩家死亡，重置双方HP
        combat.playerHp = combat.playerMaxHp;
        combat.enemyHp = combat.enemyMaxHp;
      }
    }

    this._state.combat = { ...combat };
    this._notify();
  }

  buyItem(itemId: string): void {
    const shopItem = this._state.shop.find((item) => item.id === itemId);
    if (!shopItem || this._state.gold < shopItem.price) {
      return;
    }

    this._state.gold -= shopItem.price;

    const existing = this._state.inventory.find((item) => item.id === shopItem.id);
    if (existing) {
      existing.quantity += 1;
      this._state.inventory = this._state.inventory.map((item) =>
        item.id === shopItem.id ? { ...existing } : item
      );
    } else {
      this._state.inventory = [
        ...this._state.inventory,
        {
          id: shopItem.id,
          name: shopItem.name,
          description: shopItem.description,
          quantity: 1,
          type: 'consumable' as const,
        },
      ];
    }

    this._notify();
  }

  mineOre(nodeId: string): void {
    const node = this._state.miningNodes.find((n) => n.id === nodeId);
    if (!node) {
      return;
    }

    const skill = this._state.skills.find((s) => s.id === 'mining');
    if (!skill || skill.level < node.levelRequired) {
      return;
    }

    // 增加采矿经验
    skill.xp += node.xpPerMine;
    if (skill.xp >= skill.xpToNext) {
      skill.xp -= skill.xpToNext;
      skill.level += 1;
      skill.xpToNext = Math.floor(skill.xpToNext * 1.5);
    }
    this._state.skills = this._state.skills.map((s) =>
      s.id === 'mining' ? { ...skill } : s
    );

    // 将矿石加入背包
    const existing = this._state.inventory.find((item) => item.id === node.item.id);
    if (existing) {
      existing.quantity += 1;
      this._state.inventory = this._state.inventory.map((item) =>
        item.id === node.item.id ? { ...existing } : item
      );
    } else {
      this._state.inventory = [
        ...this._state.inventory,
        {
          id: node.item.id,
          name: node.item.name,
          description: node.item.description,
          quantity: 1,
          type: 'material' as const,
        },
      ];
    }

    this._notify();
  }

  chopWood(nodeId: string): void {
    const node = this._state.woodcuttingNodes.find((n) => n.id === nodeId);
    if (!node) {
      return;
    }

    const skill = this._state.skills.find((s) => s.id === 'woodcutting');
    if (!skill || skill.level < node.levelRequired) {
      return;
    }

    // 增加伐木经验
    skill.xp += node.xpPerChop;
    if (skill.xp >= skill.xpToNext) {
      skill.xp -= skill.xpToNext;
      skill.level += 1;
      skill.xpToNext = Math.floor(skill.xpToNext * 1.5);
    }
    this._state.skills = this._state.skills.map((s) =>
      s.id === 'woodcutting' ? { ...skill } : s
    );

    // 将木材加入背包
    const existing = this._state.inventory.find((item) => item.id === node.item.id);
    if (existing) {
      existing.quantity += 1;
      this._state.inventory = this._state.inventory.map((item) =>
        item.id === node.item.id ? { ...existing } : item
      );
    } else {
      this._state.inventory = [
        ...this._state.inventory,
        {
          id: node.item.id,
          name: node.item.name,
          description: node.item.description,
          quantity: 1,
          type: 'material' as const,
        },
      ];
    }

    this._notify();
  }

  startBuilding(buildingId: string): void {
    // 已有建造中的建筑
    if (this._state.buildingConstruction) {
      return;
    }

    const building = this._state.buildings.find((b) => b.id === buildingId);
    if (!building || building.level >= building.maxLevel) {
      return;
    }

    const levelConfig = building.levels[building.level];
    // 金币不足
    if (this._state.gold < levelConfig.gold) {
      return;
    }

    // 材料不足
    for (const mat of levelConfig.materials) {
      const item = this._state.inventory.find((i) => i.id === mat.itemId);
      if (!item || item.quantity < mat.amount) {
        return;
      }
    }

    // 扣除金币
    this._state.gold -= levelConfig.gold;

    // 扣除材料
    for (const mat of levelConfig.materials) {
      const existing = this._state.inventory.find((i) => i.id === mat.itemId);
      if (existing) {
        existing.quantity -= mat.amount;
        this._state.inventory = this._state.inventory.map((i) =>
          i.id === mat.itemId ? { ...existing } : i
        );
      }
    }

    const now = Date.now();
    this._state.buildingConstruction = {
      buildingId,
      startTime: now,
      endTime: now + levelConfig.time,
    };

    this._notify();
  }

  completeBuildingUpgrade(): void {
    if (!this._state.buildingConstruction) {
      return;
    }

    const buildingId = this._state.buildingConstruction.buildingId;
    this._state.buildings = this._state.buildings.map((b) =>
      b.id === buildingId ? { ...b, level: b.level + 1 } : b
    );
    this._state.buildingConstruction = null;

    this._notify();
  }

  cancelBuilding(): void {
    if (!this._state.buildingConstruction) {
      return;
    }

    this._state.buildingConstruction = null;
    this._notify();
  }

  stockTavernFood(foodId: string, quantity: number): void {
    const existing = this._state.tavernFood.find((f) => f.foodId === foodId);
    if (existing) {
      existing.quantity += quantity;
      this._state.tavernFood = this._state.tavernFood.map((f) =>
        f.foodId === foodId ? { ...existing } : f
      );
    } else {
      this._state.tavernFood = [
        ...this._state.tavernFood,
        { foodId, quantity },
      ];
    }
    this._notify();
  }

  startAdventurerAI(): void {
    if (this._decisionTimer) {
      return;
    }
    this._decisionTimer = setInterval(() => {
      this._tickAdventurers();
    }, 1000);
  }

  stopAdventurerAI(): void {
    if (this._decisionTimer) {
      clearInterval(this._decisionTimer);
      this._decisionTimer = null;
    }
  }

  debugAddGold(amount: number): void {
    this._state.gold += amount;
    this._notify();
  }

  debugAddMaterial(itemId: string, name: string, description: string, quantity: number): void {
    const existing = this._state.inventory.find((item) => item.id === itemId);
    if (existing) {
      existing.quantity += quantity;
      this._state.inventory = this._state.inventory.map((item) =>
        item.id === itemId ? { ...existing } : item
      );
    } else {
      this._state.inventory = [
        ...this._state.inventory,
        { id: itemId, name, description, quantity, type: 'material' as const },
      ];
    }
    this._notify();
  }

  debugSetBuildingLevel(buildingId: string, level: number): void {
    this._state.buildings = this._state.buildings.map((b) =>
      b.id === buildingId ? { ...b, level: Math.min(level, b.maxLevel) } : b
    );
    this._notify();
  }

  debugSetSkillLevel(skillId: string, level: number): void {
    this._state.skills = this._state.skills.map((s) => {
      if (s.id !== skillId) {
        return s;
      }
      const xpToNext = Math.floor(100 * Math.pow(1.5, level - 1));
      return { ...s, level, xp: 0, xpToNext };
    });
    this._notify();
  }

  private _tickAdventurers(): void {
    const changed = this._worldSystem.tick(this._state);
    if (changed) {
      this._notify();
    }
  }
}
