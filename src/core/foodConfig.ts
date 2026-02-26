import type { TavernFoodConfig } from './types.ts';

export const TAVERN_FOODS: TavernFoodConfig[] = [
  {
    id: 'stale-bread',
    name: '劣质面包',
    description: '干硬的面包，勉强能填饱肚子，但至少能恢复一些体力',
    healAmount: 15,
    price: 3,
  },
  {
    id: 'bread-food',
    name: '面包',
    description: '用新鲜小麦烘焙的面包，松软可口',
    healAmount: 25,
    price: 5,
  },
  {
    id: 'veggie-soup-food',
    name: '蔬菜汤',
    description: '用胡萝卜熬制的营养浓汤，暖胃又暖心',
    healAmount: 40,
    price: 8,
  },
  {
    id: 'pumpkin-pie-food',
    name: '南瓜派',
    description: '香甜可口的南瓜派，令人回味无穷',
    healAmount: 65,
    price: 12,
  },
  {
    id: 'golden-apple-wine-food',
    name: '金苹果酒',
    description: '用金苹果酿造的珍贵美酒，饮后神清气爽',
    healAmount: 100,
    price: 20,
  },
];

export function getFoodConfig(foodId: string): TavernFoodConfig | undefined {
  return TAVERN_FOODS.find((f) => f.id === foodId);
}
