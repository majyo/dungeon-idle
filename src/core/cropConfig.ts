import type { CropConfig } from './types.ts';

export const CROPS: CropConfig[] = [
  {
    id: 'wheat',
    name: '小麦',
    description: '最基础的农作物，生长迅速',
    growthDuration: 10000,
    levelRequired: 1,
    xpPerHarvest: 12,
    yieldItem: { id: 'wheat-item', name: '小麦', description: '金黄的麦穗，可用于制作面包' },
    yieldQuantity: 2,
    requiredFarmLevel: 1,
  },
  {
    id: 'carrot',
    name: '胡萝卜',
    description: '营养丰富的根茎类蔬菜',
    growthDuration: 15000,
    levelRequired: 2,
    xpPerHarvest: 20,
    yieldItem: { id: 'carrot-item', name: '胡萝卜', description: '新鲜的胡萝卜，口感清甜' },
    yieldQuantity: 2,
    requiredFarmLevel: 1,
  },
  {
    id: 'pumpkin',
    name: '南瓜',
    description: '体型硕大的瓜类作物',
    growthDuration: 25000,
    levelRequired: 3,
    xpPerHarvest: 35,
    yieldItem: { id: 'pumpkin-item', name: '南瓜', description: '圆滚滚的南瓜，用途广泛' },
    yieldQuantity: 3,
    requiredFarmLevel: 2,
  },
  {
    id: 'golden-apple',
    name: '金苹果',
    description: '传说中的珍贵果实',
    growthDuration: 40000,
    levelRequired: 5,
    xpPerHarvest: 55,
    yieldItem: { id: 'golden-apple-item', name: '金苹果', description: '闪耀着金色光芒的苹果，极为珍贵' },
    yieldQuantity: 4,
    requiredFarmLevel: 3,
  },
];

export function getCropConfig(cropId: string): CropConfig | undefined {
  return CROPS.find((c) => c.id === cropId);
}
