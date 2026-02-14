export type ItemType = 'weapon' | 'armor' | 'consumable' | 'material';

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
  magicPower?: number;
  magicResist?: number;
  speed?: number;
  critRate?: number;
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

export type AdventurerClass = 'warrior' | 'archer' | 'elemental-mage' | 'life-mage';
export type AdventurerRole = 'tank' | 'dps' | 'healer';

export interface PartyRoleSlots {
  tank: string | null;
  dps1: string | null;
  dps2: string | null;
  healer: string | null;
}
export type AdventurerStatus = 'idle' | 'resting' | 'gathering' | 'working' | 'queuing' | 'raiding';
export type AdventurerRarity = 'common' | 'uncommon' | 'rare' | 'epic';

export type PartyStatus = 'forming' | 'raiding';

/** 怪物定义（配置数据） */
export interface MonsterDef {
  id: string;
  name: string;
  icon: string;
  maxHp: number;
  attack: number;
  defense: number;
  magicPower: number;
  magicResist: number;
  speed: number;
  xpReward: number;
  goldReward: number;
  skills?: MonsterSkillDef[];
}

/** 怪物技能定义 */
export interface MonsterSkillDef {
  id: string;
  name: string;
  type: 'physical' | 'magical';
  target: 'single' | 'all' | 'lowest-hp';
  multiplier: number;
  cooldown: number;
  statusEffect?: { id: StatusEffectId; duration: number; chance: number; value?: number };
}

/** 状态效果ID */
export type StatusEffectId = 'taunt' | 'stun' | 'burn' | 'freeze' | 'shield' | 'defense-up';

/** 战斗中的状态效果 */
export interface StatusEffect {
  id: StatusEffectId;
  sourceId: string;
  remainingTurns: number;
  value?: number;
}

/** 战斗中的怪物实例 */
export interface MonsterInstance {
  defId: string;
  hp: number;
  maxHp: number;
}

/** 战斗轮次配置 */
export interface WaveDef {
  monsterIds: [string, string, string, string];
  bonusGold?: number;
  bonusXp?: number;
}

/** 战斗轮次运行时状态 */
export interface WaveState {
  waveIndex: number;
  monsters: MonsterInstance[];
  adventurerHp: Record<string, number>;
  monsterStatusEffects: Record<number, StatusEffect[]>;
  adventurerStatusEffects: Record<string, StatusEffect[]>;
  cooldowns: Record<string, Record<string, number>>;
  combatLog: CombatLogEntry[];
  lastTickTime: number;
}

/** 战斗日志条目 */
export interface CombatLogEntry {
  timestamp: number;
  text: string;
  type: 'skill' | 'damage' | 'heal' | 'status' | 'wave' | 'death';
}

export interface Party {
  id: string;
  name: string;
  memberIds: string[];           // 最多4人
  status: PartyStatus;
  createdAt: number;
  formingDeadline: number;       // 创建后60秒
  raidStartTime: number | null;
  raidEndTime: number | null;    // 开始后20秒
  dungeonId: string | null;      // 当前攻略的副本ID
  waveState: WaveState | null;   // 战斗轮次状态
  completedWaves: number;        // 已完成轮次数
  totalWaves: number;            // 总轮次数
  accumulatedRewards: { gold: number; xp: number };  // 累计奖励
  roleSlots: PartyRoleSlots | null;  // 职能槽位（组队阶段使用）
}

/** 副本通关记录 */
export interface DungeonClearRecord {
  dungeonId: string;
  clearCount: number;
  lastClearTime: number;
}

export interface GuildHallState {
  formingParties: Party[];
  raidingParties: Party[];
  dungeonRecords: DungeonClearRecord[];
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
  magicPower: number;
  magicResist: number;
  speed: number;
  critRate: number;
  critDamage: number;
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

export interface EquipmentStock {
  equipmentId: string;
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

export interface GatheringState {
  skillId: 'woodcutting' | 'mining';
  nodeId: string;
  startTime: number;
  duration: number;
}

export interface GameState {
  gold: number;
  skills: Skill[];
  shop: ShopItem[];
  inventory: InventoryItem[];
  woodcuttingNodes: WoodcuttingNode[];
  miningNodes: MiningNode[];
  buildings: Building[];
  buildingConstruction: BuildingConstruction | null;
  adventurers: Adventurer[];
  tavernFood: TavernFoodStock[];
  storeEquipment: EquipmentStock[];
  activityLogs: ActivityLog[];
  gathering: GatheringState | null;
  guildHall: GuildHallState;
  nextAdventurerIndex: number;
  lastSpawnTime: number;
}
