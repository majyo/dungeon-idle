import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore, store } from '../../hooks/useGameStore.ts';
import { ProgressBar } from '../../components/ProgressBar/ProgressBar.tsx';
import styles from './MiningPage.module.css';

const TICK_INTERVAL = 50;

export function MiningPage() {
  const state = useGameStore();
  const skill = state.skills.find((s) => s.id === 'mining');

  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [skipTransition, setSkipTransition] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearGatherInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startGathering = useCallback(
    (nodeId: string, mineTime: number) => {
      clearGatherInterval();
      setActiveNodeId(nodeId);
      setProgress(0);

      const increment = (TICK_INTERVAL / mineTime) * 100;
      let current = 0;
      let justCompleted = false;

      intervalRef.current = setInterval(() => {
        if (justCompleted) {
          current = 0;
          justCompleted = false;
          setSkipTransition(true);
        } else {
          setSkipTransition(false);
        }
        current += increment;
        if (current >= 100) {
          current = 100;
          store.mineOre(nodeId);
          justCompleted = true;
        }
        setProgress(current);
      }, TICK_INTERVAL);
    },
    [clearGatherInterval],
  );

  const handleNodeClick = useCallback(
    (nodeId: string, mineTime: number) => {
      if (activeNodeId === nodeId) {
        clearGatherInterval();
        setActiveNodeId(null);
        setProgress(0);
      } else {
        startGathering(nodeId, mineTime);
      }
    },
    [activeNodeId, clearGatherInterval, startGathering],
  );

  useEffect(() => {
    return () => {
      clearGatherInterval();
    };
  }, [clearGatherInterval]);

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
                onClick={() => handleNodeClick(node.id, node.mineTime)}
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
