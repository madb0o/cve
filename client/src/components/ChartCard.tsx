import type { ReactNode } from 'react';
import styles from './ChartCard.module.css';

interface SegOption<T extends string> {
  value: T;
  label: string;
}

interface ChartCardProps<T extends string> {
  title: string;
  segments?: SegOption<T>[];
  segValue?: T;
  onSegChange?: (v: T) => void;
  secondarySegments?: SegOption<string>[];
  secondaryValue?: string;
  onSecondaryChange?: (v: string) => void;
  legend?: { label: string; color: string }[];
  children: ReactNode;
}

export function ChartCard<T extends string>({
  title,
  segments,
  segValue,
  onSegChange,
  secondarySegments,
  secondaryValue,
  onSecondaryChange,
  legend,
  children,
}: ChartCardProps<T>) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        <div className={styles.controls}>
          {secondarySegments && (
            <div className={styles.controls}>
              {secondarySegments.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  className={`${styles.segButton} ${secondaryValue === s.value ? styles.segButtonActive : ''}`}
                  onClick={() => onSecondaryChange?.(s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
          {segments && (
            <div className={styles.controls}>
              {segments.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  className={`${styles.segButton} ${segValue === s.value ? styles.segButtonActive : ''}`}
                  onClick={() => onSegChange?.(s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {legend && legend.length > 0 && (
        <div className={styles.legend}>
          {legend.map((l) => (
            <span className={styles.legendItem} key={l.label}>
              <span className={styles.legendSwatch} style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}
