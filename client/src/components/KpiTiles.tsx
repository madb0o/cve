import type { SummaryStats } from '../types';
import styles from './KpiTiles.module.css';

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const exact = new Intl.NumberFormat('en-US');

function formatValue(n: number): string {
  return n < 10000 ? exact.format(n) : compact.format(n);
}

function formatRange(fromIso: string, toIso: string): string {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const fromLabel = from.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const toLabel = to.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return `${fromLabel} – ${toLabel}`;
}

interface Tile {
  label: string;
  value?: number;
  delta?: number | null;
  deltaLabel?: string;
}

interface KpiTilesProps {
  summary: SummaryStats | null;
}

export function KpiTiles({ summary }: KpiTilesProps) {
  let tiles: Tile[];

  if (!summary) {
    tiles = [
      { label: 'Total CVEs' },
      { label: 'Previous period' },
      { label: 'Same period last year' },
    ];
  } else if (summary.mode === 'range') {
    tiles = [
      { label: `Total CVEs (${formatRange(summary.rangeFrom, summary.rangeTo)})`, value: summary.total },
      {
        label: 'vs previous period',
        value: summary.previousPeriodCount,
        delta: summary.periodDeltaPct,
        deltaLabel: 'vs previous period',
      },
      {
        label: 'vs same period last year',
        value: summary.yoyCount,
        delta: summary.yoyDeltaPct,
        deltaLabel: 'vs same period last year',
      },
    ];
  } else {
    tiles = [
      { label: 'Total CVEs (all time)', value: summary.total },
      { label: 'This year', value: summary.thisYear, delta: summary.yoyDeltaPct, deltaLabel: 'vs same period last year' },
      { label: 'This month', value: summary.thisMonth },
      { label: 'Last 7 days', value: summary.thisWeek },
      { label: 'Today', value: summary.today },
    ];
  }

  return (
    <div className={styles.grid}>
      {tiles.map((t) => (
        <div className={styles.tile} key={t.label}>
          <p className={styles.label}>{t.label}</p>
          <div className={styles.value}>{t.value != null ? formatValue(t.value) : '—'}</div>
          {t.delta != null && (
            <div className={styles.delta} style={{ color: t.delta >= 0 ? 'var(--delta-up)' : 'var(--delta-down)' }}>
              <span aria-hidden>{t.delta >= 0 ? '↑' : '↓'}</span>
              <span>
                {Math.abs(t.delta).toFixed(1)}% {t.deltaLabel}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
