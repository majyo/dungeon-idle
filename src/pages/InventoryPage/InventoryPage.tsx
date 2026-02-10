import { useGameStore } from '../../hooks/useGameStore.ts';
import type { ItemType } from '../../core/types.ts';
import styles from './InventoryPage.module.css';

const TYPE_LABELS: Record<ItemType, string> = {
  weapon: '武器',
  armor: '护甲',
  consumable: '消耗品',
  material: '材料',
};

export function InventoryPage() {
  const state = useGameStore();
  const { inventory } = state;

  if (inventory.length === 0) {
    return (
      <div className={styles.page}>
        <h2>🎒 背包</h2>
        <div className={styles.empty}>背包空空如也...</div>
      </div>
    );
  }

  const grouped = new Map<ItemType, typeof inventory>();
  for (const item of inventory) {
    const list = grouped.get(item.type) ?? [];
    list.push(item);
    grouped.set(item.type, list);
  }

  return (
    <div className={styles.page}>
      <h2>🎒 背包</h2>
      {Array.from(grouped.entries()).map(([type, items]) => (
        <div key={type} className={styles.group}>
          <div className={styles.groupTitle}>{TYPE_LABELS[type]}</div>
          <div className={styles.itemList}>
            {items.map((item) => (
              <div key={item.id} className={styles.item}>
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>{item.name}</span>
                  <span className={styles.itemDesc}>{item.description}</span>
                </div>
                <span className={styles.itemQuantity}>x{item.quantity}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}