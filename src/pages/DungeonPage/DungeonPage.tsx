import { useGameStore } from '../../hooks/useGameStore.ts';
import { DUNGEON_DEFS, getDungeonDef, type DungeonDef, type DungeonDifficulty } from '../../core/dungeonConfig.ts';
import type { Party, Adventurer, AdventurerClass, DungeonClearRecord } from '../../core/types.ts';
import styles from './DungeonPage.module.css';

const DIFFICULTY_LABELS: Record<DungeonDifficulty, string> = {
  easy: '简单',
  normal: '普通',
  hard: '困难',
  nightmare: '噩梦',
};

const CLASS_ICONS: Record<AdventurerClass, string> = {
  warrior: '⚔️',
  archer: '🏹',
  'elemental-mage': '🔮',
  'life-mage': '💚',
};

interface DungeonCardProps {
  dungeon: DungeonDef;
  isUnlocked: boolean;
  clearCount: number;
  guildHallLevel: number;
  dungeonRecords: DungeonClearRecord[];
  activeParties: Party[];
  adventurers: Adventurer[];
}

function DungeonCard({ dungeon, isUnlocked, clearCount, guildHallLevel, dungeonRecords, activeParties, adventurers }: DungeonCardProps) {
  const cardClass = isUnlocked
    ? styles.dungeonCard
    : `${styles.dungeonCard} ${styles.locked}`;

  return (
    <div className={cardClass}>
      <div className={styles.cardHeader}>
        <div className={styles.dungeonIcon}>{dungeon.icon}</div>
        <div className={styles.dungeonInfo}>
          <div className={styles.dungeonName}>{dungeon.name}</div>
          <div className={styles.dungeonMeta}>
            <span className={`${styles.difficulty} ${styles[dungeon.difficulty]}`}>
              {DIFFICULTY_LABELS[dungeon.difficulty]}
            </span>
            <span>推荐等级 Lv.{dungeon.minPartyLevel}+</span>
            <span>时长 {dungeon.duration / 1000}秒</span>
          </div>
        </div>
      </div>

      <div className={styles.dungeonDesc}>{dungeon.description}</div>

      {isUnlocked ? (
        <>
        <div className={styles.rewardSection}>
          <div className={styles.rewardItem}>
            <span className={styles.rewardLabel}>金币:</span>
            <span className={styles.rewardValue}>
              {dungeon.rewards.baseGold}+{dungeon.rewards.goldPerLevel}/级
            </span>
          </div>
          <div className={styles.rewardItem}>
            <span className={styles.rewardLabel}>经验:</span>
            <span className={styles.rewardValue}>
              {dungeon.rewards.baseXp}+{dungeon.rewards.xpPerLevel}/级
            </span>
          </div>
          <div className={styles.clearCount}>
            通关次数: <span>{clearCount}</span>
          </div>
        </div>

        {activeParties.length > 0 && (
          <div className={styles.activeRaids}>
            <div className={styles.activeRaidsTitle}>正在攻略</div>
            {activeParties.map((party) => {
              const members = party.memberIds
                .map((id) => adventurers.find((a) => a.id === id))
                .filter((a): a is Adventurer => a !== undefined);
              return (
                <div key={party.id} className={styles.activeRaidParty}>
                  <div className={styles.activePartyHeader}>
                    <span className={styles.activePartyName}>{party.name}</span>
                    <span className={styles.waveInfo}>
                      第 {party.completedWaves + 1}/{party.totalWaves} 轮
                    </span>
                  </div>
                  <div className={styles.activePartyMembers}>
                    {members.map((m) => (
                      <span key={m.id} className={styles.activePartyMember}>
                        {CLASS_ICONS[m.class]} {m.name}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </>
      ) : (
        <div className={styles.lockInfo}>
          <span className={styles.lockIcon}>🔒</span>
          <div>
            {guildHallLevel < dungeon.unlockCondition.guildHallLevel && (
              <div>需要工会大厅 Lv.{dungeon.unlockCondition.guildHallLevel}（当前 Lv.{guildHallLevel}）</div>
            )}
            {dungeon.unlockCondition.requiredClears?.map((req) => {
              const reqDungeon = getDungeonDef(req.dungeonId);
              const record = dungeonRecords.find((r) => r.dungeonId === req.dungeonId);
              const current = record ? record.clearCount : 0;
              if (current >= req.count) { return null; }
              return (
                <div key={req.dungeonId}>
                  需要通关 {reqDungeon?.name ?? req.dungeonId} {req.count} 次（当前 {current} 次）
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function DungeonPage() {
  const state = useGameStore();
  const { buildings, guildHall, adventurers } = state;

  const guildHallBuilding = buildings.find((b) => b.id === 'guild-hall');
  const guildHallLevel = guildHallBuilding ? guildHallBuilding.level : 0;

  // 获取每个副本的通关次数
  const getClearCount = (dungeonId: string): number => {
    const record = guildHall.dungeonRecords.find((r) => r.dungeonId === dungeonId);
    return record ? record.clearCount : 0;
  };

  return (
    <div className={styles.page}>
      <h2>🏰 副本</h2>

      {DUNGEON_DEFS.length === 0 ? (
        <p className={styles.empty}>暂无可用副本</p>
      ) : (
        <div className={styles.dungeonList}>
          {DUNGEON_DEFS.map((dungeon) => {
            const meetsLevel = guildHallLevel >= dungeon.unlockCondition.guildHallLevel;
            const meetsClears = !dungeon.unlockCondition.requiredClears || dungeon.unlockCondition.requiredClears.every((req) => {
              const record = guildHall.dungeonRecords.find((r) => r.dungeonId === req.dungeonId);
              return record && record.clearCount >= req.count;
            });
            const isUnlocked = meetsLevel && meetsClears;
            const activeParties = guildHall.raidingParties.filter(
              (p) => p.dungeonId === dungeon.id
            );
            return (
              <DungeonCard
                key={dungeon.id}
                dungeon={dungeon}
                isUnlocked={isUnlocked}
                clearCount={getClearCount(dungeon.id)}
                guildHallLevel={guildHallLevel}
                dungeonRecords={guildHall.dungeonRecords}
                activeParties={activeParties}
                adventurers={adventurers}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
