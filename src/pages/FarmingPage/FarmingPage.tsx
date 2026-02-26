import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore, store } from '../../hooks/useGameStore.ts';
import { ProgressBar } from '../../components/ProgressBar/ProgressBar.tsx';
import { CROPS } from '../../core/cropConfig.ts';
import styles from './FarmingPage.module.css';

export function FarmingPage() {
  const state = useGameStore();
  const skill = state.skills.find((s) => s.id === 'farming');
  const farm = state.buildings.find((b) => b.id === 'farm');
  const farmLevel = farm?.level ?? 0;
  const plots = state.farmPlots;

  // 确保农场地块与等级一致（修复旧存档）
  useEffect(() => {
    store.ensureFarmPlots();
  }, [farmLevel]);

  // 每个地块的选中作物
  const [selectedCrops, setSelectedCrops] = useState<Record<number, string>>({});
  // 倒计时显示
  const [remainingTimes, setRemainingTimes] = useState<Record<number, number>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 可种植的作物（根据农场等级和技能等级过滤）
  const availableCrops = CROPS.filter(
    (c) => c.requiredFarmLevel <= farmLevel && (skill ? skill.level >= c.levelRequired : false)
  );

  useEffect(() => {
    const growingPlots = plots.filter((p) => p.status === 'growing');
    if (growingPlots.length === 0) {
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
      for (const plot of growingPlots) {
        if (plot.plantTime !== null && plot.growthDuration !== null) {
          next[plot.id] = Math.max(0, Math.ceil((plot.plantTime + plot.growthDuration - now) / 1000));
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
  }, [plots]);

  const handleSelectCrop = useCallback((plotId: number, cropId: string) => {
    setSelectedCrops((prev) => ({ ...prev, [plotId]: cropId }));
  }, []);

  const handlePlant = useCallback((plotId: number) => {
    const cropId = selectedCrops[plotId];
    if (cropId) {
      store.plantCrop(plotId, cropId);
    }
  }, [selectedCrops]);

  const handleHarvest = useCallback((plotId: number) => {
    store.harvestCrop(plotId);
  }, []);

  if (farmLevel === 0) {
    return (
      <div className={styles.page}>
        <h2>🌾 农场</h2>
        <p className={styles.notBuilt}>农场尚未建造，请先在建筑页面建造农场。</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h2>🌾 农场</h2>
      <div className={styles.plotGrid}>
        {plots.map((plot) => {
          const crop = plot.cropId ? CROPS.find((c) => c.id === plot.cropId) : null;

          return (
            <div key={plot.id} className={styles.plotCard}>
              <div className={styles.plotHeader}>
                <span className={styles.plotTitle}>地块 #{plot.id + 1}</span>
                <span className={styles.plotStatus}>
                  {plot.status === 'empty' && '空闲'}
                  {plot.status === 'growing' && '生长中'}
                  {plot.status === 'ready' && '已成熟'}
                </span>
              </div>

              {plot.status === 'empty' && (
                <>
                  {availableCrops.length > 0 ? (
                    <div className={styles.plantRow}>
                      <select
                        className={styles.cropSelect}
                        value={selectedCrops[plot.id] ?? ''}
                        onChange={(e) => handleSelectCrop(plot.id, e.target.value)}
                      >
                        <option value="" disabled>选择作物</option>
                        {availableCrops.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <button
                        className={styles.actionButton}
                        disabled={!selectedCrops[plot.id]}
                        onClick={() => handlePlant(plot.id)}
                      >
                        播种
                      </button>
                    </div>
                  ) : (
                    <p className={styles.notBuilt}>暂无可种植的作物</p>
                  )}
                </>
              )}

              {plot.status === 'growing' && crop && (
                <div className={styles.plotInfo}>
                  <span>{crop.name}</span>
                  <span>剩余 {remainingTimes[plot.id] ?? 0}s</span>
                </div>
              )}

              {plot.status === 'ready' && crop && (
                <>
                  <div className={styles.plotInfo}>
                    <span>{crop.name}</span>
                    <span>产出: {crop.yieldItem.name} x{crop.yieldQuantity}</span>
                  </div>
                  <button
                    className={styles.harvestButton}
                    onClick={() => handleHarvest(plot.id)}
                  >
                    收割
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {skill && (
        <div className={styles.skillStatus}>
          <div className={styles.skillHeader}>
            <span className={styles.skillName}>农耕技能</span>
            <span className={styles.skillLevel}>Lv.{skill.level}</span>
          </div>
          <ProgressBar current={skill.xp} max={skill.xpToNext} variant="xp" />
        </div>
      )}
    </div>
  );
}
