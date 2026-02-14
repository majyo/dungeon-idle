import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../hooks/useGameStore.ts';
import { ProgressBar } from '../../components/ProgressBar/ProgressBar.tsx';
import { getDungeonDef } from '../../core/dungeonConfig.ts';
import { getMonsterDef } from '../../core/monsterConfig.ts';
import { getEffectiveStats } from '../../core/WorldSystem.ts';
import type { AdventurerClass, Party, Adventurer, PartyRoleSlots, StatusEffect } from '../../core/types.ts';
import styles from './GuildHallPage.module.css';

const CLASS_ICONS: Record<AdventurerClass, string> = {
  warrior: '⚔️',
  archer: '🏹',
  'elemental-mage': '🔮',
  'life-mage': '💚',
};

const DEFAULT_RAID_DURATION = 20000; // 默认20秒

const STATUS_ICONS: Record<string, string> = {
  taunt: '🛡️',
  stun: '💫',
  burn: '🔥',
  freeze: '❄️',
  shield: '🔰',
  'defense-up': '⬆️',
};

function StatusEffectIcons({ effects }: { effects: StatusEffect[] }) {
  if (effects.length === 0) { return null; }
  return (
    <span className={styles.statusEffects}>
      {effects.map((e, i) => (
        <span key={`${e.id}-${i}`} className={styles.statusIcon} title={`${e.id} (${e.remainingTurns}回合)`}>
          {STATUS_ICONS[e.id] ?? '✨'}
        </span>
      ))}
    </span>
  );
}

function formatTime(seconds: number): string {
  if (seconds <= 0) { return '0秒'; }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) {
    return `${mins}分${secs}秒`;
  }
  return `${secs}秒`;
}

const ROLE_LABELS: Record<string, string> = {
  tank: '坦克',
  dps1: 'DPS',
  dps2: 'DPS',
  healer: '治疗',
};

function RoleSlotDisplay({ roleSlots, adventurers }: { roleSlots: PartyRoleSlots; adventurers: Adventurer[] }) {
  const slots = [
    { key: 'tank', id: roleSlots.tank },
    { key: 'dps1', id: roleSlots.dps1 },
    { key: 'dps2', id: roleSlots.dps2 },
    { key: 'healer', id: roleSlots.healer },
  ];

  return (
    <>
      {slots.map((slot) => {
        const adv = slot.id ? adventurers.find((a) => a.id === slot.id) : null;
        return (
          <div key={slot.key} className={styles.memberTag}>
            <span className={styles.memberIcon}>{adv ? CLASS_ICONS[adv.class] : '⬜'}</span>
            <span className={styles.memberName}>
              {adv ? adv.name : `${ROLE_LABELS[slot.key]}(空)`}
            </span>
            {adv && <span className={styles.memberLevel}>Lv.{adv.level}</span>}
          </div>
        );
      })}
    </>
  );
}

interface PartyCardProps {
  party: Party;
  adventurers: Adventurer[];
  now: number;
}

const LOG_TYPE_COLORS: Record<string, string> = {
  skill: 'var(--gold)',
  damage: 'var(--text-secondary)',
  heal: '#4ade80',
  status: '#c084fc',
  wave: 'var(--gold)',
  death: '#f87171',
};

function CombatLog({ entries }: { entries: { text: string; type: string }[] }) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [entries.length]);

  // 只显示最近10条
  const recent = entries.slice(-10);

  return (
    <div className={styles.combatLog} ref={logRef}>
      {recent.map((entry, i) => (
        <div key={i} className={styles.logEntry} style={{ color: LOG_TYPE_COLORS[entry.type] ?? 'var(--text-secondary)' }}>
          {entry.text}
        </div>
      ))}
    </div>
  );
}

function PartyCard({ party, adventurers, now }: PartyCardProps) {
  const members = party.memberIds
    .map((id) => adventurers.find((a) => a.id === id))
    .filter((a): a is Adventurer => a !== undefined);

  const isRaiding = party.status === 'raiding';
  const hasCombat = party.waveState !== null;

  // 获取副本信息
  const dungeon = party.dungeonId ? getDungeonDef(party.dungeonId) : null;
  const dungeonName = dungeon ? dungeon.name : '未知副本';
  const raidDuration = dungeon ? dungeon.duration : DEFAULT_RAID_DURATION;

  // 计算剩余时间（仅时间制副本）
  let remaining = 0;
  let progress = 0;
  if (isRaiding && !hasCombat && party.raidStartTime && party.raidEndTime) {
    remaining = Math.max(0, Math.ceil((party.raidEndTime - now) / 1000));
    const elapsed = now - party.raidStartTime;
    progress = Math.min(elapsed, raidDuration);
  } else if (!isRaiding) {
    remaining = Math.max(0, Math.ceil((party.formingDeadline - now) / 1000));
  }

  // 战斗制副本：渲染战斗界面
  if (isRaiding && hasCombat && party.waveState) {
    const ws = party.waveState;
    return (
      <div className={styles.partyCard}>
        <div className={styles.partyHeader}>
          <span className={styles.partySize}>{party.name} - {dungeonName}</span>
          <span className={styles.waveProgress}>
            第 {party.completedWaves + 1}/{party.totalWaves} 轮
          </span>
        </div>

        <div className={styles.battleArea}>
          {/* 冒险者队伍 */}
          <div className={styles.teamSide}>
            <div className={styles.teamLabel}>冒险者</div>
            <div className={styles.combatantList}>
              {members.map((member) => {
                const currentHp = ws.adventurerHp[member.id] ?? member.hp;
                const effStats = getEffectiveStats(member);
                const isDead = currentHp <= 0;
                const effects = ws.adventurerStatusEffects[member.id] ?? [];
                return (
                  <div key={member.id} className={`${styles.combatant} ${isDead ? styles.dead : ''}`}>
                    <span className={styles.combatantIcon}>{CLASS_ICONS[member.class]}</span>
                    <div className={styles.combatantInfo}>
                      <div className={styles.combatantNameRow}>
                        <span className={styles.combatantName}>{member.name}</span>
                        <StatusEffectIcons effects={effects} />
                      </div>
                      <ProgressBar
                        current={currentHp}
                        max={effStats.maxHp}
                        variant="hp"
                        showLabel={false}
                      />
                      <span className={styles.hpText}>{currentHp}/{effStats.maxHp}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* VS 分隔 */}
          <div className={styles.vsLabel}>VS</div>

          {/* 怪物队伍 */}
          <div className={styles.teamSide}>
            <div className={styles.teamLabel}>怪物</div>
            <div className={styles.combatantList}>
              {ws.monsters.map((monster, idx) => {
                const monsterDef = getMonsterDef(monster.defId);
                const isDead = monster.hp <= 0;
                const effects = ws.monsterStatusEffects[idx] ?? [];
                return (
                  <div key={idx} className={`${styles.combatant} ${isDead ? styles.dead : ''}`}>
                    <span className={styles.combatantIcon}>{monsterDef?.icon ?? '👾'}</span>
                    <div className={styles.combatantInfo}>
                      <div className={styles.combatantNameRow}>
                        <span className={styles.combatantName}>{monsterDef?.name ?? '未知怪物'}</span>
                        <StatusEffectIcons effects={effects} />
                      </div>
                      <ProgressBar
                        current={monster.hp}
                        max={monster.maxHp}
                        variant="hp"
                        showLabel={false}
                      />
                      <span className={styles.hpText}>{monster.hp}/{monster.maxHp}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 战斗日志 */}
        {ws.combatLog.length > 0 && (
          <CombatLog entries={ws.combatLog} />
        )}

        {/* 累计奖励 */}
        <div className={styles.rewardsInfo}>
          累计奖励: {party.accumulatedRewards.gold} 金币 / {party.accumulatedRewards.xp} 经验
        </div>
      </div>
    );
  }

  // 时间制副本或组队中：原有渲染逻辑
  return (
    <div className={styles.partyCard}>
      <div className={styles.partyHeader}>
        <span className={styles.partySize}>
          {isRaiding ? `${party.name} - ${dungeonName}` : `${party.name} (${members.length}/4)`}
        </span>
        <span className={styles.countdown}>
          剩余 {formatTime(remaining)}
        </span>
      </div>

      {isRaiding && !hasCombat && (
        <div className={styles.raidProgress}>
          <ProgressBar
            current={progress}
            max={raidDuration}
            variant="gather"
            showLabel={false}
          />
        </div>
      )}

      <div className={styles.memberList}>
        {!isRaiding && party.roleSlots ? (
          <RoleSlotDisplay roleSlots={party.roleSlots} adventurers={adventurers} />
        ) : (
          members.map((member) => (
            <div key={member.id} className={styles.memberTag}>
              <span className={styles.memberIcon}>{CLASS_ICONS[member.class]}</span>
              <span className={styles.memberName}>{member.name}</span>
              <span className={styles.memberLevel}>Lv.{member.level}</span>
            </div>
          ))
        )}
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
