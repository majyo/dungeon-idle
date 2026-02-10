export type ItemType = 'weapon' | 'armor' | 'consumable' | 'material';

export interface CombatState {
  playerHp: number;
  playerMaxHp: number;
  playerAttack: number;
  enemyName: string;
  enemyHp: number;
  enemyMaxHp: number;
  enemyAttack: number;
  enemyGoldReward: number;
  enemiesDefeated: number;
}

export interface Skill {
  id: string;
  name: string;
  level: number;
  xp: number;
  xpToNext: number;
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  type: ItemType;
}

export interface WoodcuttingNode {
  id: string;
  name: string;
  levelRequired: number;
  xpPerChop: number;
  chopTime: number;
  item: { id: string; name: string; description: string };
}

export interface MiningNode {
  id: string;
  name: string;
  levelRequired: number;
  xpPerMine: number;
  mineTime: number;
  item: { id: string; name: string; description: string };
}

export interface BuildingMaterialCost {
  itemId: string;
  name: string;
  amount: number;
}

export interface BuildingLevelConfig {
  gold: number;
  materials: BuildingMaterialCost[];
  time: number;
}

export interface Building {
  id: string;
  name: string;
  description: string;
  level: number;
  maxLevel: number;
  levels: BuildingLevelConfig[];
}

export interface BuildingConstruction {
  buildingId: string;
  startTime: number;
  endTime: number;
}

export interface GameState {
  gold: number;
  combat: CombatState;
  skills: Skill[];
  shop: ShopItem[];
  inventory: InventoryItem[];
  woodcuttingNodes: WoodcuttingNode[];
  miningNodes: MiningNode[];
  buildings: Building[];
  buildingConstruction: BuildingConstruction | null;
}
