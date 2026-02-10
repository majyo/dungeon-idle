import type { ReactNode } from 'react';
import styles from './Layout.module.css';

interface LayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
}

export function Layout({ sidebar, children }: LayoutProps) {
  return (
    <div className={styles.container}>
      {sidebar}
      <main className={styles.content}>{children}</main>
    </div>
  );
}
