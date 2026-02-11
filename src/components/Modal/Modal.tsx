import type { ReactNode } from 'react';
import styles from './Modal.module.css';

interface ModalProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
}

export function Modal({ title, children, onClose }: ModalProps) {
  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className={styles.modal} onClick={(e) => { e.stopPropagation(); }}>
        <div className={styles.header}>
          <span className={styles.title}>{title}</span>
          <button className={styles.closeButton} onClick={onClose} aria-label="关闭">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
