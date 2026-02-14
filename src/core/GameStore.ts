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
  private _gatheringTimer: ReturnType<typeof setInterval> | null = null;
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

    // 材料不足
    for (const mat of levelConfig.materials) {
      const item = this._state.inventory.find((i) => i.id === mat.itemId);
      if (!item || item.quantity < mat.amount) {
        return;
      }
    }

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

  stockEquipment(equipmentId: string, quantity: number): void {
    const existing = this._state.storeEquipment.find((e) => e.equipmentId === equipmentId);
    if (existing) {
      existing.quantity += quantity;
      this._state.storeEquipment = this._state.storeEquipment.map((e) =>
        e.equipmentId === equipmentId ? { ...existing } : e
      );
    } else {
      this._state.storeEquipment = [
        ...this._state.storeEquipment,
        { equipmentId, quantity },
      ];
    }
    this._notify();
  }

  startGathering(skillId: 'woodcutting' | 'mining', nodeId: string): void {
    // 查找对应节点获取采集时间
    let duration: number;
    if (skillId === 'woodcutting') {
      const node = this._state.woodcuttingNodes.find((n) => n.id === nodeId);
      if (!node) {
        return;
      }
      const skill = this._state.skills.find((s) => s.id === 'woodcutting');
      if (!skill || skill.level < node.levelRequired) {
        return;
      }
      duration = node.chopTime;
    } else {
      const node = this._state.miningNodes.find((n) => n.id === nodeId);
      if (!node) {
        return;
      }
      const skill = this._state.skills.find((s) => s.id === 'mining');
      if (!skill || skill.level < node.levelRequired) {
        return;
      }
      duration = node.mineTime;
    }

    this._state.gathering = {
      skillId,
      nodeId,
      startTime: Date.now(),
      duration,
    };
    this._notify();
  }

  stopGathering(): void {
    if (!this._state.gathering) {
      return;
    }
    this._state.gathering = null;
    this._notify();
  }

  private _tickGathering(): void {
    const g = this._state.gathering;
    if (!g) {
      return;
    }

    const now = Date.now();
    if (now >= g.startTime + g.duration) {
      // 完成采集
      if (g.skillId === 'woodcutting') {
        this.chopWood(g.nodeId);
      } else {
        this.mineOre(g.nodeId);
      }
      // 自动开始下一轮（chopWood/mineOre 已经 _notify 了）
      this._state.gathering = {
        ...g,
        startTime: now,
      };
      this._notify();
    }
  }

  startAdventurerAI(): void {
    if (this._decisionTimer) {
      return;
    }
    this._decisionTimer = setInterval(() => {
      this._tickAdventurers();
    }, 1000);
    this._gatheringTimer = setInterval(() => {
      this._tickGathering();
    }, 200);
  }

  stopAdventurerAI(): void {
    if (this._decisionTimer) {
      clearInterval(this._decisionTimer);
      this._decisionTimer = null;
    }
    if (this._gatheringTimer) {
      clearInterval(this._gatheringTimer);
      this._gatheringTimer = null;
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
