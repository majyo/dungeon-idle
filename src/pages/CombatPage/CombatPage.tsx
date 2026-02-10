import { useGameStore, store } from '../../hooks/useGameStore.ts';
import { ProgressBar } from '../../components/ProgressBar/ProgressBar.tsx';
import styles from './CombatPage.module.css';

export function CombatPage() {
  const state = useGameStore();
  const { combat } = state;

  return (
    <div className={styles.page}>
      <h2>⚔️ 战斗</h2>

      <div className={styles.panel}>
        <div className={styles.panelTitle}>敌人</div>
        <div className={styles.enemyName}>{combat.enemyName}</div>
        <ProgressBar current={combat.enemyHp} max={combat.enemyMaxHp} variant="hp" />
        <div className={styles.statRow}>
          <span>攻击力: {combat.enemyAttack}</span>
          <span>金币奖励: {combat.enemyGoldReward}</span>
        </div>
      </div>

      <div className={styles.panel}>
        <div className={styles.panelTitle}>玩家</div>
        <ProgressBar current={combat.playerHp} max={combat.playerMaxHp} variant="hp" />
        <div className={styles.statRow}>
          <span>攻击力: {combat.playerAttack}</span>
        </div>
      </div>

      <button className={styles.attackButton} onClick={() => store.attackEnemy()}>
        攻击
      </button>

      <div className={styles.stats}>
        <span>击败敌人: <span className={styles.statValue}>{combat.enemiesDefeated}</span></span>
        <span>金币: <span className={styles.statValue}>{state.gold}</span></span>
      </div>
    </div>
  );
}
