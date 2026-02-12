import type { EquipmentDef, EquipmentSlot } from './types.ts';

export const ALL_EQUIPMENT: EquipmentDef[] = [
  // 武器
  {
    id: 'wooden-sword',
    name: '木剑',
    description: '简陋的木制武器，聊胜于无',
    slot: 'weapon',
    stats: { attack: 3 },
    price: 15,
  },
  {
    id: 'hunting-bow',
    name: '猎弓',
    description: '猎人常用的弓，适合远程攻击',
    slot: 'weapon',
    stats: { attack: 5 },
    price: 25,
  },
  {
    id: 'iron-sword',
    name: '铁剑',
    description: '坚固的铁制长剑，可靠的武器',
    slot: 'weapon',
    stats: { attack: 7 },
    price: 40,
  },
  {
    id: 'magic-staff',
    name: '魔法杖',
    description: '蕴含魔力的法杖，施法者的利器',
    slot: 'weapon',
    stats: { attack: 8 },
    price: 50,
  },
  {
    id: 'steel-sword',
    name: '钢剑',
    description: '精锻钢制长剑，锋利无比',
    slot: 'weapon',
    stats: { attack: 12 },
    price: 100,
  },
  // 护甲
  {
    id: 'leather-armor',
    name: '皮甲',
    description: '轻便的皮革护甲，提供基础防护',
    slot: 'armor',
    stats: { defense: 3 },
    price: 20,
  },
  {
    id: 'mage-robe',
    name: '法师长袍',
    description: '附魔的长袍，兼顾防御与生命力',
    slot: 'armor',
    stats: { defense: 4, maxHp: 15 },
    price: 45,
  },
  {
    id: 'chainmail',
    name: '锁子甲',
    description: '环环相扣的金属甲，防御出色',
    slot: 'armor',
    stats: { defense: 6, maxHp: 10 },
    price: 50,
  },
  {
    id: 'plate-armor',
    name: '板甲',
    description: '厚重的全身板甲，最强的防护',
    slot: 'armor',
    stats: { defense: 12, maxHp: 25 },
    price: 120,
  },
];

export function getEquipmentDef(id: string): EquipmentDef | undefined {
  return ALL_EQUIPMENT.find((e) => e.id === id);
}

/** 计算装备的总属性值，用于比较优劣 */
function equipmentPower(def: EquipmentDef): number {
  return (def.stats.attack ?? 0) + (def.stats.defense ?? 0) + (def.stats.maxHp ?? 0) * 0.2;
}

/** 找到买得起的、比当前装备更好的最佳装备 */
export function findBestAffordable(slot: EquipmentSlot, gold: number, currentEquipId: string | null): EquipmentDef | null {
  const currentDef = currentEquipId ? ALL_EQUIPMENT.find((e) => e.id === currentEquipId) : null;
  const currentPower = currentDef ? equipmentPower(currentDef) : 0;

  let best: EquipmentDef | null = null;
  let bestPower = currentPower;

  for (const equip of ALL_EQUIPMENT) {
    if (equip.slot !== slot) { continue; }
    if (equip.price > gold) { continue; }
    const power = equipmentPower(equip);
    if (power > bestPower) {
      best = equip;
      bestPower = power;
    }
  }

  return best;
}
