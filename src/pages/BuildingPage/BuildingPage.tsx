import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore, store } from '../../hooks/useGameStore.ts';
import { ProgressBar } from '../../components/ProgressBar/ProgressBar.tsx';
import { Modal } from '../../components/Modal/Modal.tsx';
import { TAVERN_FOODS, getFoodConfig } from '../../core/foodConfig.ts';
import styles from './BuildingPage.module.css';

const TICK_INTERVAL = 50;

export function BuildingPage() {
  const state = useGameStore();
  const construction = state.buildingConstruction;
  const { adventurers } = state;

  const [progress, setProgress] = useState(0);
  const [showFoodModal, setShowFoodModal] = useState(false);
  const [selectedFoodId, setSelectedFoodId] = useState(TAVERN_FOODS[0]?.id ?? '');
  const [stockQuantity, setStockQuantity] = useState(10);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTickInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // 建造进度 tick
  useEffect(() => {
    if (!construction) {
      setProgress(0);
      clearTickInterval();
      return;
    }

    const tick = () => {
      const now = Date.now();
      const elapsed = now - construction.startTime;
      const total = construction.endTime - construction.startTime;
      const pct = Math.min(100, (elapsed / total) * 100);
      setProgress(pct);

      if (now >= construction.endTime) {
        store.completeBuildingUpgrade();
      }
    };

    tick();
    intervalRef.current = setInterval(tick, TICK_INTERVAL);

    return () => {
      clearTickInterval();
    };
  }, [construction, clearTickInterval]);

  const getItemQuantity = (itemId: string): number => {
    const item = state.inventory.find((i) => i.id === itemId);
    return item ? item.quantity : 0;
  };

  const handleStockFood = () => {
    if (selectedFoodId && stockQuantity > 0) {
      store.stockTavernFood(selectedFoodId, stockQuantity);
      setShowFoodModal(false);
      setStockQuantity(10);
    }
  };

  const selectedFoodConfig = getFoodConfig(selectedFoodId);

  return (
    <div className={styles.page}>
      <h2>🏗️ 建筑</h2>
      <div className={styles.buildingList}>
        {state.buildings.map((building) => {
          const isMaxLevel = building.level >= building.maxLevel;
          const levelConfig = isMaxLevel ? null : building.levels[building.level];
          const isConstructing = construction?.buildingId === building.id;
          const otherConstructing = construction !== null && !isConstructing;

          // 检查资源是否足够
          let canAfford = false;
          if (levelConfig) {
            const goldOk = state.gold >= levelConfig.gold;
            const matsOk = levelConfig.materials.every(
              (mat) => getItemQuantity(mat.itemId) >= mat.amount
            );
            canAfford = goldOk && matsOk;
          }

          let buttonText: string;
          let buttonDisabled = false;
          if (isMaxLevel) {
            buttonText = '已满级';
            buttonDisabled = true;
          } else if (isConstructing) {
            buttonText = '建造中...';
            buttonDisabled = true;
          } else if (otherConstructing) {
            buttonText = '建造中...';
            buttonDisabled = true;
          } else if (!canAfford) {
            buttonText = building.level === 0 ? '建造' : '升级';
            buttonDisabled = true;
          } else {
            buttonText = building.level === 0 ? '建造' : '升级';
          }

          // 酒馆食物库存
          const isTavern = building.id === 'tavern' && building.level >= 1;
          const foodStocks = isTavern
            ? state.tavernFood.filter((f) => f.quantity > 0)
            : [];

          return (
            <div key={building.id} className={styles.buildingCard}>
              <div className={styles.buildingHeader}>
                <span className={styles.buildingName}>{building.name}</span>
                <span className={styles.buildingLevel}>
                  {isMaxLevel ? 'Lv.MAX' : `Lv.${building.level}`}
                </span>
              </div>
              <p className={styles.buildingDesc}>{building.description}</p>

              {levelConfig && (
                <div className={styles.costList}>
                  <div className={state.gold >= levelConfig.gold ? styles.costItem : styles.costItemInsufficient}>
                    金币: {state.gold}/{levelConfig.gold}
                  </div>
                  {levelConfig.materials.map((mat) => {
                    const owned = getItemQuantity(mat.itemId);
                    const enough = owned >= mat.amount;
                    return (
                      <div key={mat.itemId} className={enough ? styles.costItem : styles.costItemInsufficient}>
                        {mat.name}: {owned}/{mat.amount}
                      </div>
                    );
                  })}
                </div>
              )}

              {isConstructing && (
                <div className={styles.constructionProgress}>
                  <ProgressBar current={progress} max={100} variant="gather" showLabel={false} />
                </div>
              )}

              <button
                className={styles.buildButton}
                disabled={buttonDisabled}
                onClick={() => store.startBuilding(building.id)}
              >
                {buttonText}
              </button>

              {building.level >= 1 && (() => {
                const residents = adventurers.filter(
                  (a) => a.currentBuildingId === building.id
                );
                return residents.length > 0 ? (
                  <div className={styles.residents}>
                    {residents.map((a) => (
                      <span key={a.id} className={styles.residentItem}>
                        🧙 {a.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className={styles.residents}>
                    <span className={styles.residentEmpty}>暂无冒险者驻扎</span>
                  </div>
                );
              })()}

              {isTavern && (
                <>
                  {foodStocks.length > 0 && (
                    <div className={styles.foodStock}>
                      {foodStocks.map((stock) => {
                        const config = getFoodConfig(stock.foodId);
                        return config ? (
                          <span key={stock.foodId} className={styles.foodStockItem}>
                            🍞 {config.name} x{stock.quantity}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                  <button className={styles.stockButton} onClick={() => { setShowFoodModal(true); }}>
                    上架食物
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {showFoodModal && (
        <Modal title="上架食物" onClose={() => { setShowFoodModal(false); }}>
          <div className={styles.stockForm}>
            <div className={styles.formGroup}>
              <label htmlFor="food-select">食物类型</label>
              <select
                id="food-select"
                value={selectedFoodId}
                onChange={(e) => { setSelectedFoodId(e.target.value); }}
              >
                {TAVERN_FOODS.map((food) => (
                  <option key={food.id} value={food.id}>{food.name}</option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="food-quantity">数量</label>
              <input
                id="food-quantity"
                type="number"
                min={1}
                max={999}
                value={stockQuantity}
                onChange={(e) => { setStockQuantity(Math.max(1, parseInt(e.target.value) || 1)); }}
              />
            </div>
            {selectedFoodConfig && (
              <div className={styles.foodInfo}>
                {selectedFoodConfig.description}<br />
                回复 {selectedFoodConfig.healAmount} HP · 售价 {selectedFoodConfig.price} 金币
              </div>
            )}
            <button
              className={styles.confirmButton}
              disabled={!selectedFoodId || stockQuantity <= 0}
              onClick={handleStockFood}
            >
              确认上架
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

