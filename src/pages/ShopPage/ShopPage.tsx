import { useGameStore, store } from '../../hooks/useGameStore.ts';
import styles from './ShopPage.module.css';

export function ShopPage() {
  const state = useGameStore();

  return (
    <div className={styles.page}>
      <h2>🏪 商店</h2>
      <div className={styles.grid}>
        {state.shop.map((item) => (
          <div key={item.id} className={styles.card}>
            <div className={styles.cardName}>{item.name}</div>
            <div className={styles.cardDesc}>{item.description}</div>
            <div className={styles.cardPrice}>🪙 {item.price}</div>
            <button
              className={styles.buyButton}
              disabled={state.gold < item.price}
              onClick={() => store.buyItem(item.id)}
            >
              {state.gold < item.price ? '金币不足' : '购买'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
