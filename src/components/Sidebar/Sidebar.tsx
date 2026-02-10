import styles from './Sidebar.module.css';
import { useGameStore } from '../../hooks/useGameStore.ts';

interface Tab {
  id: string;
  label: string;
  icon: string;
}

interface SidebarProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function Sidebar({ tabs, activeTab, onTabChange }: SidebarProps) {
  const state = useGameStore();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.title}>Dungeon Idle</div>
      <nav className={styles.nav}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.navButton} ${activeTab === tab.id ? styles.navButtonActive : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <span className={styles.navIcon}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>
      <div className={styles.footer}>
        <span className={styles.coinIcon}>🪙</span>
        <span>{state.gold} 金币</span>
      </div>
    </aside>
  );
}
