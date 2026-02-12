import { useState, useEffect } from 'react';
import { useGameStore } from '../../hooks/useGameStore.ts';
import { ProgressBar } from '../../components/ProgressBar/ProgressBar.tsx';
import type { AdventurerClass, Party, Adventurer } from '../../core/types.ts';
import styles from './GuildHallPage.module.css';

const CLASS_ICONS: Record<AdventurerClass, string> = {
  warrior: '⚔️',
  mage: '🔮',
  archer: '🏹',
  healer: '💚',
  priest: '✝️',
};

const RAID_DURATION = 20000; // 20秒

function formatTime(seconds: number): string {
  if (seconds <= 0) { return '0秒'; }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) {
    return `${mins}分${secs}秒`;
  }
  return `${secs}秒`;
}

interface PartyCardProps {
  party: Party;
  adventurers: Adventurer[];
  now: number;
}

function PartyCard({ party, adventurers, now }: PartyCardProps) {
  const members = party.memberIds
    .map((id) => adventurers.find((a) => a.id === id))
    .filter((a): a is Adventurer => a !== undefined);

  const isRaiding = party.status === 'raiding';

  // 计算剩余时间
  let remaining = 0;
  let progress = 0;
  if (isRaiding && party.raidStartTime && party.raidEndTime) {
    remaining = Math.max(0, Math.ceil((party.raidEndTime - now) / 1000));
    const elapsed = now - party.raidStartTime;
    progress = Math.min(elapsed, RAID_DURATION);
  } else {
    remaining = Math.max(0, Math.ceil((party.formingDeadline - now) / 1000));
  }

  return (
    <div className={styles.partyCard}>
      <div className={styles.partyHeader}>
        <span className={styles.partySize}>
          队伍 ({members.length}/4)
        </span>
        <span className={styles.countdown}>
          剩余 {formatTime(remaining)}
        </span>
      </div>

      {isRaiding && (
        <div className={styles.raidProgress}>
          <ProgressBar
            current={progress}
            max={RAID_DURATION}
            variant="gather"
            showLabel={false}
          />
        </div>
      )}

      <div className={styles.memberList}>
        {members.map((member) => (
          <div key={member.id} className={styles.memberTag}>
            <span className={styles.memberIcon}>{CLASS_ICONS[member.class]}</span>
            <span className={styles.memberName}>{member.name}</span>
            <span className={styles.memberLevel}>Lv.{member.level}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GuildHallPage() {
  const state = useGameStore();
  const { guildHall, adventurers } = state;
  const [now, setNow] = useState(Date.now());

  // 每秒更新倒计时
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hasFormingParties = guildHall.formingParties.length > 0;
  const hasRaidingParties = guildHall.raidingParties.length > 0;
  const isEmpty = !hasFormingParties && !hasRaidingParties;

  return (
    <div className={styles.page}>
      <h2>👥 队伍</h2>

      {isEmpty ? (
        <p className={styles.empty}>
          暂无队伍活动。将工会大厅升级到 2 级后，冒险者会自动组队挑战副本。
        </p>
      ) : (
        <>
          {hasFormingParties && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>组队中</h3>
              <div className={styles.partyList}>
                {guildHall.formingParties.map((party) => (
                  <PartyCard
                    key={party.id}
                    party={party}
                    adventurers={adventurers}
                    now={now}
                  />
                ))}
              </div>
            </section>
          )}

          {hasRaidingParties && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>副本中</h3>
              <div className={styles.partyList}>
                {guildHall.raidingParties.map((party) => (
                  <PartyCard
                    key={party.id}
                    party={party}
                    adventurers={adventurers}
                    now={now}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
