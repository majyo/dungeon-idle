import { useEffect, useRef } from 'react';
import { useGameStoreSelector } from '../../hooks/useGameStore';
import styles from './ActivityLog.module.css';

export function ActivityLog() {
  const logs = useGameStoreSelector((s) => s.activityLogs);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 自动滚动到底部
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs.length]);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className={styles.panel} ref={containerRef}>
      <div className={styles.title}>📜 行动记录</div>
      
      {logs.length === 0 ? (
        <div className={styles.emptyState}>暂无记录</div>
      ) : (
        <div className={styles.logList}>
          {logs.map((log) => {
            const { id, timestamp, adventurerName, actionLabel, effects, levelUp } = log;
            
            return (
              <div 
                key={id} 
                className={`${styles.logItem} ${levelUp ? styles.levelUp : ''}`}
              >
                <span className={styles.timestamp}>
                  {formatTime(timestamp)}
                </span>
                
                <span className={styles.content}>
                  {levelUp ? (
                    <span>⬆ {adventurerName} 升级了！</span>
                  ) : (
                    <span>
                      <strong>{adventurerName}</strong> {actionLabel}
                    </span>
                  )}
                </span>

                <span className={styles.effects}>
                  {effects.goldDelta ? (
                    <span className={styles.goldEffect}>
                      {effects.goldDelta > 0 ? '+' : ''}{effects.goldDelta} 金币
                    </span>
                  ) : null}

                  {effects.xpDelta ? (
                    <span className={styles.xpEffect}>
                      {effects.xpDelta > 0 ? '+' : ''}{effects.xpDelta} XP
                    </span>
                  ) : null}

                  {effects.hpDelta ? (
                    <span className={styles.hpEffect}>
                      HP {effects.hpDelta > 0 ? '+' : ''}{effects.hpDelta}
                    </span>
                  ) : null}

                  {effects.lootName && (
                    <span className={styles.lootText}>🛡️ {effects.lootName}</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
