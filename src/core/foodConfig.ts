import type { TavernFoodConfig } from './types.ts';

export const TAVERN_FOODS: TavernFoodConfig[] = [
  {
    id: 'stale-bread',
    name: '劣质面包',
    description: '干硬的面包，勉强能填饱肚子，但至少能恢复一些体力',
    healAmount: 15,
    price: 3,
  },
];

export function getFoodConfig(foodId: string): TavernFoodConfig | undefined {
  return TAVERN_FOODS.find((f) => f.id === foodId);
}
