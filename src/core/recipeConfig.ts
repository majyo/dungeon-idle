export interface RecipeIngredient {
  itemId: string;
  name: string;
  amount: number;
}

export interface ProcessingRecipe {
  id: string;
  name: string;
  description: string;
  ingredients: RecipeIngredient[];
  outputFoodId: string;
  outputQuantity: number;
  processingTime: number;
  requiredKitchenLevel: number;
}

export const RECIPES: ProcessingRecipe[] = [
  {
    id: 'bread',
    name: '面包',
    description: '用小麦烘焙的新鲜面包',
    ingredients: [{ itemId: 'wheat-item', name: '小麦', amount: 3 }],
    outputFoodId: 'bread-food',
    outputQuantity: 2,
    processingTime: 8000,
    requiredKitchenLevel: 1,
  },
  {
    id: 'veggie-soup',
    name: '蔬菜汤',
    description: '用胡萝卜熬制的营养浓汤',
    ingredients: [{ itemId: 'carrot-item', name: '胡萝卜', amount: 3 }],
    outputFoodId: 'veggie-soup-food',
    outputQuantity: 2,
    processingTime: 12000,
    requiredKitchenLevel: 1,
  },
  {
    id: 'pumpkin-pie',
    name: '南瓜派',
    description: '香甜可口的南瓜派',
    ingredients: [{ itemId: 'pumpkin-item', name: '南瓜', amount: 2 }],
    outputFoodId: 'pumpkin-pie-food',
    outputQuantity: 2,
    processingTime: 18000,
    requiredKitchenLevel: 2,
  },
  {
    id: 'golden-apple-wine',
    name: '金苹果酒',
    description: '用金苹果酿造的珍贵美酒',
    ingredients: [{ itemId: 'golden-apple-item', name: '金苹果', amount: 2 }],
    outputFoodId: 'golden-apple-wine-food',
    outputQuantity: 2,
    processingTime: 25000,
    requiredKitchenLevel: 3,
  },
];

export function getRecipeConfig(recipeId: string): ProcessingRecipe | undefined {
  return RECIPES.find((r) => r.id === recipeId);
}
