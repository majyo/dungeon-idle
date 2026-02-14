import { useGameStore } from '../../hooks/useGameStore.ts';
import { ProgressBar } from '../../components/ProgressBar/ProgressBar.tsx';
import type { AdventurerClass, AdventurerStatus, AdventurerRarity, AdventurerEquipment } from '../../core/types.ts';
import { getEquipmentDef } from '../../core/equipmentConfig.ts';
import { getAdventurerCap } from '../../core/adventurerConfig.ts';
import styles from './AdventurerPage.module.css';

const CLASS_LABELS: Record<AdventurerClass, string> = {
  warrior: '战士',
  archer: '弓箭手',
  'elemental-mage': '元素法师',
  'life-mage': '生命法师',
};

const CLASS_ICONS: Record<AdventurerClass, string> = {
  warrior: '⚔️',
  archer: '🏹',
  'elemental-mage': '🔮',
  'life-mage': '💚',
};

const STATUS_LABELS: Record<AdventurerStatus, string> = {
  idle: '空闲',
  resting: '休息中',
  gathering: '采集中',
  working: '打工中',
  queuing: '排队中',
  raiding: '副本中',
};

const STATUS_STYLES: Record<AdventurerStatus, string> = {
  idle: styles.statusIdle,
  resting: styles.statusResting,
  gathering: styles.statusGathering,
  working: styles.statusWorking,
  queuing: styles.statusQueuing,
  raiding: styles.statusRaiding,
};

const RARITY_LABELS: Record<AdventurerRarity, string> = {
  common: '普通',
  uncommon: '优秀',
  rare: '稀有',
  epic: '史诗',
};

const RARITY_STYLES: Record<AdventurerRarity, string> = {
  common: styles.rarityCommon,
  uncommon: styles.rarityUncommon,
  rare: styles.rarityRare,
  epic: styles.rarityEpic,
};

function getEquipBonus(equipment: AdventurerEquipment): { attack: number; defense: number; maxHp: number; magicPower: number; magicResist: number; speed: number; critRate: number } {
  let attack = 0, defense = 0, maxHp = 0, magicPower = 0, magicResist = 0, speed = 0, critRate = 0;
  for (const equipId of [equipment.weapon, equipment.armor]) {
    if (!equipId) { continue; }
    const def = getEquipmentDef(equipId);
    if (!def) { continue; }
    attack += def.stats.attack ?? 0;
    defense += def.stats.defense ?? 0;
    maxHp += def.stats.maxHp ?? 0;
    magicPower += def.stats.magicPower ?? 0;
    magicResist += def.stats.magicResist ?? 0;
    speed += def.stats.speed ?? 0;
    critRate += def.stats.critRate ?? 0;
  }
  return { attack, defense, maxHp, magicPower, magicResist, speed, critRate };
}

function getEquipTierStyle(price: number): string {
  if (price >= 100) { return styles.slotItemTier4; }
  if (price >= 40) { return styles.slotItemTier3; }
  if (price >= 20) { return styles.slotItemTier2; }
  return styles.slotItemTier1;
}

function EquipmentSlotBox({ label, equipId }: { label: string; equipId: string | null }) {
  const def = equipId ? getEquipmentDef(equipId) : null;
  return (
    <div className={styles.slotBox}>
      <div className={styles.slotLabel}>{label}</div>
      {def ? (
        <>
          <div className={`${styles.slotItem} ${getEquipTierStyle(def.price)}`}>{def.name}</div>
          <div className={styles.slotStats}>
            {def.stats.attack ? `攻击+${def.stats.attack} ` : ''}
            {def.stats.defense ? `防御+${def.stats.defense} ` : ''}
            {def.stats.maxHp ? `生命+${def.stats.maxHp}` : ''}
          </div>
        </>
      ) : (
        <div className={styles.slotEmpty}>无</div>
      )}
    </div>
  );
}

export function AdventurerPage() {
  const state = useGameStore();
  const { adventurers, buildings } = state;
  const guildHall = buildings.find((b) => b.id === 'guild-hall');
  const cap = getAdventurerCap(guildHall?.level ?? 0);

  if (adventurers.length === 0) {
    return (
      <div className={styles.page}>
        <h2>🧙 冒险者 ({adventurers.length}/{cap})</h2>
        <p className={styles.empty}>还没有冒险者加入队伍</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h2>🧙 冒险者 ({adventurers.length}/{cap})</h2>
      <div className={styles.adventurerList}>
        {adventurers.map((adv) => (
          <div key={adv.id} className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.nameSection}>
                <span className={styles.classIcon}>{CLASS_ICONS[adv.class]}</span>
                <span className={`${styles.name} ${RARITY_STYLES[adv.rarity]}`}>
                  {adv.name}
                </span>
              </div>
              <span className={styles.level}>Lv.{adv.level}</span>
            </div>

            <div className={styles.tags}>
              <span className={`${styles.tag} ${RARITY_STYLES[adv.rarity]}`}>
                {RARITY_LABELS[adv.rarity]}
              </span>
              <span className={`${styles.tag} ${RARITY_STYLES[adv.rarity]}`}>
                {CLASS_LABELS[adv.class]}
              </span>
              <span className={`${styles.tag} ${STATUS_STYLES[adv.status]}`}>
                {STATUS_LABELS[adv.status]}
              </span>
            </div>

            <div className={styles.bars}>
              <div className={styles.barRow}>
                <span className={styles.barLabel}>HP</span>
                <div className={styles.barTrack}>
                  <ProgressBar current={adv.hp} max={adv.maxHp} variant="hp" />
                </div>
              </div>
              <div className={styles.barRow}>
                <span className={styles.barLabel}>XP</span>
                <div className={styles.barTrack}>
                  <ProgressBar current={adv.xp} max={adv.xpToNext} variant="xp" />
                </div>
              </div>
            </div>

            <div className={styles.stats}>
              {(() => {
                const bonus = getEquipBonus(adv.equipment);
                return (
                  <>
                    <span>攻击力 <span className={styles.statValue}>{adv.attack}</span>{bonus.attack > 0 && <span className={styles.bonusStat}> (+{bonus.attack})</span>}</span>
                    <span>防御力 <span className={styles.statValue}>{adv.defense}</span>{bonus.defense > 0 && <span className={styles.bonusStat}> (+{bonus.defense})</span>}</span>
                    <span>魔法强度 <span className={styles.statValue}>{adv.magicPower}</span>{bonus.magicPower > 0 && <span className={styles.bonusStat}> (+{bonus.magicPower})</span>}</span>
                    <span>魔法抗性 <span className={styles.statValue}>{adv.magicResist}</span>{bonus.magicResist > 0 && <span className={styles.bonusStat}> (+{bonus.magicResist})</span>}</span>
                    <span>速度 <span className={styles.statValue}>{adv.speed}</span>{bonus.speed > 0 && <span className={styles.bonusStat}> (+{bonus.speed})</span>}</span>
                    <span>暴击率 <span className={styles.statValue}>{Math.round((adv.critRate + bonus.critRate) * 100)}%</span></span>
                    <span>暴击伤害 <span className={styles.statValue}>{Math.round(adv.critDamage * 100)}%</span></span>
                    <span>金币 <span className={styles.statValue}>{adv.gold}</span></span>
                  </>
                );
              })()}
            </div>

            <div className={styles.equipmentSection}>
              <div className={styles.equipmentSlots}>
                <EquipmentSlotBox label="武器" equipId={adv.equipment.weapon} />
                <EquipmentSlotBox label="护甲" equipId={adv.equipment.armor} />
              </div>
            </div>

            {adv.actionLabel && (
              <div className={styles.actionProgress}>
                <div className={styles.actionLabel}>{adv.actionLabel}</div>
              </div>
            )}

            {!adv.actionLabel && adv.currentBuildingId && (() => {
              const building = buildings.find((b) => b.id === adv.currentBuildingId);
              return building ? (
                <div className={styles.location}>
                  📍 {building.name}
                </div>
              ) : null;
            })()}
          </div>
        ))}
      </div>
    </div>
  );
}
