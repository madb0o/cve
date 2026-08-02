import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fetchTrend } from '../api';
import type { Filters, Granularity, TrendRow } from '../types';
import { ChartCard } from './ChartCard';
import { ChartTooltip } from './ChartTooltip';
import { severityColor } from './severityColor';

const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE', 'UNKNOWN'];
const TYPE_SLOT_VARS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)', 'var(--series-6)'];
const MAX_TYPE_SERIES = 6;

const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
  { value: 'daily', label: 'Day' },
  { value: 'weekly', label: 'Week' },
  { value: 'monthly', label: 'Month' },
  { value: 'yearly', label: 'Year' },
];

const GROUP_OPTIONS = [
  { value: 'none', label: 'Total' },
  { value: 'severity', label: 'By severity' },
  { value: 'type', label: 'By type' },
];

function defaultGranularity(from?: string): Granularity {
  if (!from) return 'monthly';
  const days = (Date.now() - new Date(from).getTime()) / (24 * 60 * 60 * 1000);
  if (days <= 60) return 'daily';
  if (days <= 500) return 'weekly';
  if (days <= 365 * 4) return 'monthly';
  return 'yearly';
}

function formatBucketLabel(bucket: string, granularity: Granularity): string {
  const d = new Date(bucket);
  if (Number.isNaN(d.getTime())) return bucket;
  switch (granularity) {
    case 'daily':
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    case 'weekly':
      return `Wk of ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    case 'monthly':
      return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    case 'yearly':
      return d.toLocaleDateString('en-US', { year: 'numeric' });
  }
}

interface TrendChartProps {
  filters: Filters;
}

export function TrendChart({ filters }: TrendChartProps) {
  const [granularity, setGranularity] = useState<Granularity>(() => defaultGranularity(filters.from));
  const [granularityTouched, setGranularityTouched] = useState(false);
  const [groupBy, setGroupBy] = useState<'none' | 'severity' | 'type'>('none');
  const [rows, setRows] = useState<TrendRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!granularityTouched) {
      setGranularity(defaultGranularity(filters.from));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.from]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchTrend(filters, granularity, groupBy === 'none' ? null : groupBy)
      .then((res) => {
        if (!cancelled) setRows(res.rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters, granularity, groupBy]);

  const { data, seriesKeys, colorFor } = useMemo(() => {
    if (groupBy === 'none') {
      const data = rows.map((r) => ({ bucket: r.bucket, total: r.count }));
      return { data, seriesKeys: ['total'], colorFor: () => 'var(--series-1)' as string };
    }

    if (groupBy === 'severity') {
      const keysPresent = new Set(rows.map((r) => r.group_key ?? 'UNKNOWN'));
      const seriesKeys = SEVERITY_ORDER.filter((k) => keysPresent.has(k));
      const byBucket = new Map<string, Record<string, number>>();
      for (const r of rows) {
        const bucketEntry = byBucket.get(r.bucket) ?? {};
        bucketEntry[r.group_key ?? 'UNKNOWN'] = r.count;
        byBucket.set(r.bucket, bucketEntry);
      }
      const data = [...byBucket.entries()]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([bucket, values]) => ({ bucket, ...values }));
      return { data, seriesKeys, colorFor: (k: string) => severityColor(k) };
    }

    // groupBy === 'type': cap to top N by total volume, fold rest into Other
    const totals = new Map<string, number>();
    for (const r of rows) {
      const key = r.group_key ?? 'Other';
      totals.set(key, (totals.get(key) ?? 0) + r.count);
    }
    const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    const topKeys = ranked.slice(0, MAX_TYPE_SERIES).map(([k]) => k);
    const hasOther = ranked.length > MAX_TYPE_SERIES;
    const seriesKeys = hasOther ? [...topKeys, 'Other'] : topKeys;

    const byBucket = new Map<string, Record<string, number>>();
    for (const r of rows) {
      const key = r.group_key ?? 'Other';
      const finalKey = topKeys.includes(key) ? key : 'Other';
      const bucketEntry = byBucket.get(r.bucket) ?? {};
      bucketEntry[finalKey] = (bucketEntry[finalKey] ?? 0) + r.count;
      byBucket.set(r.bucket, bucketEntry);
    }
    const data = [...byBucket.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([bucket, values]) => ({ bucket, ...values }));
    const colorFor = (k: string) => (k === 'Other' ? 'var(--other)' : TYPE_SLOT_VARS[topKeys.indexOf(k)] ?? 'var(--other)');
    return { data, seriesKeys, colorFor };
  }, [rows, groupBy]);

  const legend =
    seriesKeys.length > 1 ? seriesKeys.map((k) => ({ label: k, color: colorFor(k) })) : undefined;

  return (
    <ChartCard
      title="CVE publication trend"
      segments={GRANULARITY_OPTIONS}
      segValue={granularity}
      onSegChange={(v) => {
        setGranularityTouched(true);
        setGranularity(v);
      }}
      secondarySegments={GROUP_OPTIONS}
      secondaryValue={groupBy}
      onSecondaryChange={(v) => setGroupBy(v as 'none' | 'severity' | 'type')}
      legend={legend}
    >
      <div style={{ width: '100%', height: 280, opacity: loading ? 0.6 : 1, transition: 'opacity 150ms' }}>
        <ResponsiveContainer width="100%" height="100%">
          {groupBy === 'none' ? (
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--gridline)" strokeDasharray="0" />
              <XAxis
                dataKey="bucket"
                tickFormatter={(v) => formatBucketLabel(v, granularity)}
                stroke="var(--baseline)"
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                allowDecimals={false}
                stroke="var(--baseline)"
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                tickLine={false}
                width={44}
              />
              <Tooltip
                content={<ChartTooltip labelFormatter={(l) => formatBucketLabel(l, granularity)} />}
                cursor={{ stroke: 'var(--baseline)', strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="total"
                name="CVEs"
                stroke="var(--series-1)"
                strokeWidth={2}
                fill="var(--series-1)"
                fillOpacity={0.1}
              />
            </AreaChart>
          ) : (
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--gridline)" strokeDasharray="0" />
              <XAxis
                dataKey="bucket"
                tickFormatter={(v) => formatBucketLabel(v, granularity)}
                stroke="var(--baseline)"
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                allowDecimals={false}
                stroke="var(--baseline)"
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                tickLine={false}
                width={44}
              />
              <Tooltip
                content={<ChartTooltip labelFormatter={(l) => formatBucketLabel(l, granularity)} />}
                cursor={{ stroke: 'var(--baseline)', strokeWidth: 1 }}
              />
              {seriesKeys.map((k) => (
                <Line
                  key={k}
                  type="monotone"
                  dataKey={k}
                  name={k}
                  stroke={colorFor(k)}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface-1)' }}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
