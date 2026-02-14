import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore, store } from '../../hooks/useGameStore.ts';
import { ProgressBar } from '../../components/ProgressBar/ProgressBar.tsx';
import styles from './MiningPage.module.css';

const UI_TICK = 50;

export function MiningPage() {
  const state = useGameStore();
  const skill = state.skills.find((s) => s.id === 'mining');
  const gathering = state.gathering;
  const isGatheringOre = gathering !== null && gathering.skillId === 'mining';
  const activeNodeId = isGatheringOre ? gathering.nodeId : null;

  const [progress, setProgress] = useState(0);
  const [skipTransition, setSkipTransition] = useState(false);
  const uiTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevStartTimeRef = useRef<number | null>(null);

  // 纯 UI 进度条动画
  useEffect(() => {
    if (!isGatheringOre) {
      setProgress(0);
      prevStartTimeRef.current = null;
      if (uiTimerRef.current !== null) {
        clearInterval(uiTimerRef.current);
        uiTimerRef.current = null;
      }
      return;
    }

    const { startTime, duration } = gathering;

    // 检测新一轮开始（startTime 变化）
    if (prevStartTimeRef.current !== null && prevStartTimeRef.current !== startTime) {
      setSkipTransition(true);
      requestAnimationFrame(() => setSkipTransition(false));
    }
    prevStartTimeRef.current = startTime;

    uiTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min((elapsed / duration) * 100, 100);
      setProgress(pct);
    }, UI_TICK);

    return () => {
      if (uiTimerRef.current !== null) {
        clearInterval(uiTimerRef.current);
        uiTimerRef.current = null;
      }
    };
  }, [isGatheringOre, gathering?.startTime, gathering?.duration]);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      if (activeNodeId === nodeId) {
        store.stopGathering();
      } else {
        store.startGathering('mining', nodeId);
      }
    },
    [activeNodeId],
  );

  return (
    <div className={styles.page}>
      <h2>⛏️ 采矿</h2>
      <div className={styles.nodeList}>
        {state.miningNodes.map((node) => {
          const canMine = skill !== undefined && skill.level >= node.levelRequired;
          const isActive = activeNodeId === node.id;

          let buttonText: string;
          if (!canMine) {
            buttonText = '等级不足';
          } else if (isActive) {
            buttonText = '停止';
          } else {
            buttonText = '采集';
          }

          return (
            <div key={node.id} className={styles.nodeCard}>
              <div className={styles.nodeHeader}>
                <span className={styles.nodeName}>{node.name}</span>
                <span className={styles.nodeLevel}>需要 Lv.{node.levelRequired}</span>
              </div>
              <div className={styles.nodeInfo}>
                <span>经验: +{node.xpPerMine}</span>
                <span>产出: {node.item.name}</span>
              </div>
              {isActive && (
                <div className={styles.gatherProgress}>
                  <ProgressBar current={progress} max={100} variant="gather" showLabel={false} noTransition={skipTransition} />
                </div>
              )}
              <button
                className={styles.mineButton}
                disabled={!canMine}
                onClick={() => handleNodeClick(node.id)}
              >
                {buttonText}
              </button>
            </div>
          );
        })}
      </div>
      {skill && (
        <div className={styles.skillStatus}>
          <div className={styles.skillHeader}>
            <span className={styles.skillName}>采矿技能</span>
            <span className={styles.skillLevel}>Lv.{skill.level}</span>
          </div>
          <ProgressBar current={skill.xp} max={skill.xpToNext} variant="xp" />
        </div>
      )}
    </div>
  );
}
