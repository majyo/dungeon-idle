import { useState } from 'react';
import { useGameStore, store } from '../../hooks/useGameStore.ts';
import styles from './DebugPage.module.css';

// 所有可添加的材料
const MATERIALS = [
  { id: 'copper', name: '铜矿', description: '常见的金属矿石，用途广泛' },
  { id: 'iron', name: '铁矿', description: '坚硬的铁矿石，可用于锻造' },
  { id: 'silver', name: '银矿', description: '闪亮的银矿石，价值不菲' },
  { id: 'gold-ore-item', name: '金矿', description: '珍贵的金矿石，极为稀有' },
  { id: 'oak-wood', name: '橡木', description: '常见的木材，用途广泛' },
  { id: 'pine-wood', name: '松木', description: '带有松香气息的木材' },
  { id: 'birch-wood', name: '桦木', description: '质地细腻的白色木材' },
  { id: 'redwood-wood', name: '红杉木', description: '珍贵的红色木材，坚固耐用' },
];

function BuildingLevelRow({ building }: { building: { id: string; name: string; level: number; maxLevel: number } }) {
  const [target, setTarget] = useState(building.level);

  const options = [];
  for (let i = 0; i <= building.maxLevel; i++) {
    options.push(i);
  }

  return (
    <div className={styles.levelRow}>
      <span className={styles.levelName}>{building.name}</span>
      <span className={styles.levelCurrent}>Lv.{building.level}</span>
      <select value={target} onChange={(e) => setTarget(Number(e.target.value))}>
        {options.map((lv) => (
          <option key={lv} value={lv}>Lv.{lv}</option>
        ))}
      </select>
      <button className={styles.setBtn} onClick={() => store.debugSetBuildingLevel(building.id, target)}>
        设置
      </button>
    </div>
  );
}

function SkillLevelRow({ skill }: { skill: { id: string; name: string; level: number } }) {
  const [target, setTarget] = useState(skill.level);

  return (
    <div className={styles.levelRow}>
      <span className={styles.levelName}>{skill.name}</span>
      <span className={styles.levelCurrent}>Lv.{skill.level}</span>
      <input
        type="number"
        min={1}
        max={99}
        value={target}
        onChange={(e) => setTarget(Number(e.target.value))}
      />
      <button className={styles.setBtn} onClick={() => store.debugSetSkillLevel(skill.id, target)}>
        设置
      </button>
    </div>
  );
}

export function DebugPage() {
  const state = useGameStore();
  const [materialId, setMaterialId] = useState(MATERIALS[0].id);
  const [materialQty, setMaterialQty] = useState(10);

  const handleAddMaterial = () => {
    const mat = MATERIALS.find((m) => m.id === materialId);
    if (mat) {
      store.debugAddMaterial(mat.id, mat.name, mat.description, materialQty);
    }
  };

  const handleAddAll = (qty: number) => {
    for (const mat of MATERIALS) {
      store.debugAddMaterial(mat.id, mat.name, mat.description, qty);
    }
  };

  return (
    <div className={styles.page}>
      <h2>🛠️ 调试</h2>

      {/* 金币 */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>金币</div>
        <div className={styles.goldCurrent}>当前: {state.gold}</div>
        <div className={styles.buttonRow}>
          <button className={styles.quickBtn} onClick={() => store.debugAddGold(100)}>+100</button>
          <button className={styles.quickBtn} onClick={() => store.debugAddGold(1000)}>+1000</button>
          <button className={styles.quickBtn} onClick={() => store.debugAddGold(10000)}>+10000</button>
        </div>
      </div>

      {/* 添加材料 */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>添加材料</div>
        <div className={styles.materialRow}>
          <select value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
            {MATERIALS.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={materialQty}
            onChange={(e) => setMaterialQty(Number(e.target.value))}
          />
          <button className={styles.setBtn} onClick={handleAddMaterial}>添加</button>
        </div>
        <div className={styles.buttonRow} style={{ marginTop: 10 }}>
          <button className={styles.quickBtn} onClick={() => handleAddAll(1)}>全部 +1</button>
          <button className={styles.quickBtn} onClick={() => handleAddAll(10)}>全部 +10</button>
          <button className={styles.quickBtn} onClick={() => handleAddAll(100)}>全部 +100</button>
        </div>
      </div>

      {/* 建筑等级 */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>建筑等级</div>
        {state.buildings.map((b) => (
          <BuildingLevelRow key={b.id} building={b} />
        ))}
      </div>

      {/* 技能等级 */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>技能等级</div>
        {state.skills.map((s) => (
          <SkillLevelRow key={s.id} skill={s} />
        ))}
      </div>
    </div>
  );
}