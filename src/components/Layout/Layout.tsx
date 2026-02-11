import type { ReactNode } from 'react';
import { ActivityLog } from '../ActivityLog/ActivityLog';
import styles from './Layout.module.css';

interface LayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
}

export function Layout({ sidebar, children }: LayoutProps) {
  return (
    <div className={styles.container}>
      {sidebar}
      <main className={styles.content}>
        <div className={styles.mainContent}>{children}</div>
        <ActivityLog />
      </main>
    </div>
  );
}
