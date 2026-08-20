import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fetchByMonth } from '../api';
import type { Filters, MonthlyMatrixRow } from '../types';
import { ChartCard } from './ChartCard';
import { ChartTooltip } from './ChartTooltip';
import styles from './SeasonalComparisonChart.module.css';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const YEAR_SERIES_VARS = [
  'var(--series-1)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
  'var(--series-5)',
  'var(--series-6)',
];
const MAX_OVERLAY_YEARS = 6;
const SEQ_VARS = ['var(--seq-100)', 'var(--seq-250)', 'var(--seq-400)', 'var(--seq-450)', 'var(--seq-550)', 'var(--seq-700)'];

type ViewMode = 'heatmap' | 'overlay' | 'month';
const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: 'heatmap', label: 'Heatmap' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'month', label: 'Single month' },
];

const MONTH_PICKER_OPTIONS = MONTH_NAMES.map((label, i) => ({ value: String(i + 1), label }));

function pct(current: number, baseline: number): number | null {
  return baseline > 0 ? ((current - baseline) / baseline) * 100 : null;
}

interface SeasonalComparisonChartProps {
  filters: Filters;
}

export function SeasonalComparisonChart({ filters }: SeasonalComparisonChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('heatmap');
  const [selectedMonth, setSelectedMonth] = useState('8');
  const [rows, setRows] = useState<MonthlyMatrixRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedYears, setSelectedYears] = useState<number[] | null>(null); // null = not yet initialized

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchByMonth({ severity: filters.severity, type: filters.type, includeRejected: filters.includeRejected })
      .then((res) => {
        if (!cancelled) setRows(res.rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.severity, filters.type, filters.includeRejected]);

  const matrix = useMemo(() => {
    const m = new Map<number, Map<number, number>>();
    for (const r of rows) {
      if (!m.has(r.year)) m.set(r.year, new Map());
      m.get(r.year)!.set(r.month, r.count);
    }
    return m;
  }, [rows]);

  const availableYears = useMemo(() => [...matrix.keys()].sort((a, b) => a - b), [matrix]);

  // Default the overlay year selection to the most recent MAX_OVERLAY_YEARS once data loads.
  useEffect(() => {
    if (selectedYears !== null || availableYears.length === 0) return;
    setSelectedYears(availableYears.slice(-MAX_OVERLAY_YEARS));
  }, [availableYears, selectedYears]);

  function toggleYear(year: number) {
    setSelectedYears((prev) => {
      const cur = prev ?? [];
      if (cur.includes(year)) return cur.filter((y) => y !== year);
      const next = [...cur, year].sort((a, b) => a - b);
      return next.length > MAX_OVERLAY_YEARS ? next.slice(next.length - MAX_OVERLAY_YEARS) : next;
    });
  }

  const overlayData = useMemo(() => {
    const years = (selectedYears ?? []).sort((a, b) => a - b);
    return MONTH_NAMES.map((name, i) => {
      const point: Record<string, string | number> = { month: name };
      for (const y of years) point[String(y)] = matrix.get(y)?.get(i + 1) ?? 0;
      return point;
    });
  }, [matrix, selectedYears]);

  const monthData = useMemo(() => {
    const month = Number(selectedMonth);
    const counts = availableYears.map((y) => matrix.get(y)?.get(month) ?? 0);
    return availableYears.map((y, i) => ({
      year: String(y),
      count: counts[i],
      delta: i > 0 ? pct(counts[i], counts[i - 1]) : null,
    }));
  }, [availableYears, matrix, selectedMonth]);

  const heatmapMax = useMemo(() => {
    let max = 0;
    for (const byMonth of matrix.values()) {
      for (const c of byMonth.values()) max = Math.max(max, c);
    }
    return max;
  }, [matrix]);

  function heatmapCellStyle(count: number): { background: string; color: string } {
    if (count === 0 || heatmapMax === 0) {
      return { background: 'var(--gridline)', color: 'var(--text-muted)' };
    }
    const bucket = Math.max(0, Math.min(SEQ_VARS.length - 1, Math.ceil((count / heatmapMax) * SEQ_VARS.length) - 1));
    // seq-450/550/700 (bucket >= 3) are dark/saturated enough to need white text — same rule
    // tokens.css already applies to --series-1 (== --seq-450) via .segButtonActive.
    return { background: SEQ_VARS[bucket], color: bucket >= 3 ? 'white' : 'var(--text-primary)' };
  }

  const overlayYearsSorted = (selectedYears ?? []).sort((a, b) => a - b);
  const legend =
    viewMode === 'overlay'
      ? overlayYearsSorted.map((y, i) => ({ label: String(y), color: YEAR_SERIES_VARS[i % YEAR_SERIES_VARS.length] }))
      : undefined;

  return (
    <ChartCard
      title="Seasonal comparison"
      segments={VIEW_OPTIONS}
      segValue={viewMode}
      onSegChange={setViewMode}
      secondarySegments={viewMode === 'month' ? MONTH_PICKER_OPTIONS : undefined}
      secondaryValue={viewMode === 'month' ? selectedMonth : undefined}
      onSecondaryChange={viewMode === 'month' ? setSelectedMonth : undefined}
      legend={legend}
    >
      {viewMode === 'overlay' && (
        <div className={styles.yearChips}>
          {availableYears.map((y) => (
            <button
              key={y}
              type="button"
              className={`${styles.yearChip} ${(selectedYears ?? []).includes(y) ? styles.yearChipActive : ''}`}
              onClick={() => toggleYear(y)}
            >
              {y}
            </button>
          ))}
        </div>
      )}

      <div style={{ width: '100%', opacity: loading ? 0.6 : 1, transition: 'opacity 150ms' }}>
        {viewMode === 'heatmap' && (
          <div className={styles.heatmap}>
            <div className={styles.heatmapHeaderRow}>
              <div className={styles.heatmapYearLabel} />
              {MONTH_NAMES.map((m) => (
                <div key={m} className={styles.heatmapColLabel}>
                  {m}
                </div>
              ))}
            </div>
            {[...availableYears].reverse().map((y) => (
              <div key={y} className={styles.heatmapRow}>
                <div className={styles.heatmapYearLabel}>{y}</div>
                {MONTH_NAMES.map((_, i) => {
                  const count = matrix.get(y)?.get(i + 1) ?? 0;
                  return (
                    <div
                      key={i}
                      className={styles.heatmapCell}
                      style={heatmapCellStyle(count)}
                      title={`${MONTH_NAMES[i]} ${y}: ${count.toLocaleString()} CVEs`}
                    >
                      {count > 0 ? count.toLocaleString() : ''}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {viewMode === 'overlay' && (
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={overlayData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--gridline)" strokeDasharray="0" />
                <XAxis
                  dataKey="month"
                  stroke="var(--baseline)"
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  stroke="var(--baseline)"
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  tickLine={false}
                  width={44}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--baseline)', strokeWidth: 1 }} />
                {overlayYearsSorted.map((y, i) => (
                  <Line
                    key={y}
                    type="monotone"
                    dataKey={String(y)}
                    name={String(y)}
                    stroke={YEAR_SERIES_VARS[i % YEAR_SERIES_VARS.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface-1)' }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {viewMode === 'month' && (
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthData} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--gridline)" strokeDasharray="0" />
                <XAxis
                  dataKey="year"
                  stroke="var(--baseline)"
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  stroke="var(--baseline)"
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  tickLine={false}
                  width={44}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--gridline)' }} />
                <Bar
                  dataKey="count"
                  name="CVEs"
                  fill="var(--series-1)"
                  radius={[4, 4, 0, 0]}
                  label={(props: { x?: string | number; y?: string | number; width?: string | number; index?: number }) => {
                    const index = props.index ?? -1;
                    const d = monthData[index];
                    if (d?.delta == null) return <g />;
                    const x = Number(props.x ?? 0);
                    const y = Number(props.y ?? 0);
                    const width = Number(props.width ?? 0);
                    const color = d.delta >= 0 ? 'var(--delta-up)' : 'var(--delta-down)';
                    const arrow = d.delta >= 0 ? '↑' : '↓';
                    return (
                      <text x={x + width / 2} y={y - 8} textAnchor="middle" fontSize={11} fill={color}>
                        {arrow} {Math.abs(d.delta).toFixed(0)}%
                      </text>
                    );
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </ChartCard>
  );
}
