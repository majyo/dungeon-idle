import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  current: number;
  max: number;
  variant: 'hp' | 'xp' | 'gather';
  showLabel?: boolean;
  noTransition?: boolean;
}

export function ProgressBar({ current, max, variant, showLabel = true, noTransition = false }: ProgressBarProps) {
  const percent = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;

  const fillStyle: React.CSSProperties = { width: `${percent}%` };
  if (noTransition) {
    fillStyle.transition = 'none';
  }

  return (
    <div className={`${styles.track} ${styles[variant]}`}>
      <div className={styles.fill} style={fillStyle} />
      {showLabel && (
        <span className={styles.label}>
          {current} / {max}
        </span>
      )}
    </div>
  );
}
