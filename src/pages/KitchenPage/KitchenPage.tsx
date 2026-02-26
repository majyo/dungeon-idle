import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore, store } from '../../hooks/useGameStore.ts';
import { RECIPES } from '../../core/recipeConfig.ts';
import type { ProcessingRecipe } from '../../core/recipeConfig.ts';
import styles from './KitchenPage.module.css';

export function KitchenPage() {
  const state = useGameStore();
  const kitchen = state.buildings.find((b) => b.id === 'kitchen');
  const kitchenLevel = kitchen?.level ?? 0;
  const slots = state.processingSlots;

  // 确保槽位与等级一致（修复旧存档）
  useEffect(() => {
    store.ensureProcessingSlots();
  }, [kitchenLevel]);

  // 每个槽位选中的配方
  const [selectedRecipes, setSelectedRecipes] = useState<Record<number, string>>({});
  // 倒计时
  const [remainingTimes, setRemainingTimes] = useState<Record<number, number>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 可用配方（根据厨房等级过滤）
  const availableRecipes = RECIPES.filter((r) => r.requiredKitchenLevel <= kitchenLevel);

  useEffect(() => {
    const processingSlots = slots.filter((s) => s.status === 'processing');
    if (processingSlots.length === 0) {
      setRemainingTimes({});
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const updateTimes = () => {
      const now = Date.now();
      const next: Record<number, number> = {};
      for (const slot of processingSlots) {
        if (slot.startTime !== null && slot.processingTime !== null) {
          next[slot.id] = Math.max(0, Math.ceil((slot.startTime + slot.processingTime - now) / 1000));
        }
      }
      setRemainingTimes(next);
    };

    updateTimes();
    timerRef.current = setInterval(updateTimes, 1000);
    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [slots]);

  const handleSelectRecipe = useCallback((slotId: number, recipeId: string) => {
    setSelectedRecipes((prev) => ({ ...prev, [slotId]: recipeId }));
  }, []);

  const handleStartProcessing = useCallback((slotId: number) => {
    const recipeId = selectedRecipes[slotId];
    if (recipeId) {
      store.startProcessing(slotId, recipeId);
    }
  }, [selectedRecipes]);

  /** 检查背包中某材料是否足够 */
  const getItemQuantity = useCallback((itemId: string): number => {
    return state.inventory.find((i) => i.id === itemId)?.quantity ?? 0;
  }, [state.inventory]);

  /** 渲染配方所需材料 */
  const renderIngredients = (recipe: ProcessingRecipe) => {
    return recipe.ingredients.map((ing) => {
      const have = getItemQuantity(ing.itemId);
      const enough = have >= ing.amount;
      return (
        <span key={ing.itemId} className={enough ? styles.ingredientOk : styles.ingredientLack}>
          {ing.name} {have}/{ing.amount}
        </span>
      );
    });
  };

  if (kitchenLevel === 0) {
    return (
      <div className={styles.page}>
        <h2>🍳 厨房</h2>
        <p className={styles.notBuilt}>厨房尚未建造，请先在建筑页面建造厨房。</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h2>🍳 厨房</h2>
      <div className={styles.slotGrid}>
        {slots.map((slot) => {
          const recipe = slot.recipeId ? RECIPES.find((r) => r.id === slot.recipeId) : null;

          return (
            <div key={slot.id} className={styles.slotCard}>
              <div className={styles.slotHeader}>
                <span className={styles.slotTitle}>加工槽 #{slot.id + 1}</span>
                <span className={styles.slotStatus}>
                  {slot.status === 'idle' && '空闲'}
                  {slot.status === 'processing' && '加工中'}
                </span>
              </div>

              {slot.status === 'idle' && (
                <>
                  {availableRecipes.length > 0 ? (
                    <>
                      <div className={styles.recipeRow}>
                        <select
                          className={styles.recipeSelect}
                          value={selectedRecipes[slot.id] ?? ''}
                          onChange={(e) => handleSelectRecipe(slot.id, e.target.value)}
                        >
                          <option value="" disabled>选择配方</option>
                          {availableRecipes.map((r) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                        <button
                          className={styles.actionButton}
                          disabled={!selectedRecipes[slot.id]}
                          onClick={() => handleStartProcessing(slot.id)}
                        >
                          开始加工
                        </button>
                      </div>
                      {selectedRecipes[slot.id] && (() => {
                        const selRecipe = availableRecipes.find((r) => r.id === selectedRecipes[slot.id]);
                        return selRecipe ? (
                          <div className={styles.ingredients}>
                            需要：{renderIngredients(selRecipe)}
                          </div>
                        ) : null;
                      })()}
                    </>
                  ) : (
                    <p className={styles.notBuilt}>暂无可用配方</p>
                  )}
                </>
              )}

              {slot.status === 'processing' && recipe && (
                <div className={styles.slotInfo}>
                  <span>{recipe.name}</span>
                  <span>剩余 {remainingTimes[slot.id] ?? 0}s</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
