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

export type EquipmentSlot = 'weapon' | 'armor';

export interface EquipmentStats {
  attack?: number;
  defense?: number;
  maxHp?: number;
}

export interface EquipmentDef {
  id: string;
  name: string;
  description: string;
  slot: EquipmentSlot;
  stats: EquipmentStats;
  price: number;
}

export interface AdventurerEquipment {
  weapon: string | null;  // EquipmentDef.id
  armor: string | null;   // EquipmentDef.id
}

export type AdventurerClass = 'warrior' | 'mage' | 'archer' | 'healer' | 'priest';
export type AdventurerStatus = 'idle' | 'resting' | 'gathering' | 'working' | 'queuing' | 'raiding';
export type AdventurerRarity = 'common' | 'uncommon' | 'rare' | 'epic';

export type PartyStatus = 'forming' | 'raiding';

export interface Party {
  id: string;
  memberIds: string[];           // 最多4人
  status: PartyStatus;
  createdAt: number;
  formingDeadline: number;       // 创建后60秒
  raidStartTime: number | null;
  raidEndTime: number | null;    // 开始后20秒
}

export interface GuildHallState {
  formingParties: Party[];
  raidingParties: Party[];
}

export interface Adventurer {
  id: string;
  name: string;
  class: AdventurerClass;
  rarity: AdventurerRarity;
  level: number;
  xp: number;
  xpToNext: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  gold: number;
  status: AdventurerStatus;
  currentBuildingId: string | null;
  currentActionId: string | null;
  actionStartTime: number | null;
  actionEndTime: number | null;
  actionLabel: string | null;
  equipment: AdventurerEquipment;
}

export interface TavernFoodConfig {
  id: string;
  name: string;
  description: string;
  healAmount: number;
  price: number;
}

export interface TavernFoodStock {
  foodId: string;
  quantity: number;
}

/** 活动日志条目 */
export interface ActivityLog {
  /** 唯一 ID，用于 React key */
  id: string;
  /** Date.now() 时间戳 */
  timestamp: number;
  /** 冒险者名字 */
  adventurerName: string;
  /** 行动描述（如"外出探索未知区域"） */
  actionLabel: string;
  /** 效果数值 */
  effects: {
    goldDelta?: number;
    xpDelta?: number;
    hpDelta?: number;
    lootName?: string;
  };
  /** 是否触发了升级 */
  levelUp?: boolean;
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
  adventurers: Adventurer[];
  tavernFood: TavernFoodStock[];
  activityLogs: ActivityLog[];
  guildHall: GuildHallState;
}
