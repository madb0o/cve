import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fetchBySeverity } from '../api';
import type { Filters, SeverityRow } from '../types';
import { ChartCard } from './ChartCard';
import { ChartTooltip } from './ChartTooltip';
import { severityColor } from './severityColor';

const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE', 'UNKNOWN'];

interface SeverityChartProps {
  filters: Filters;
}

export function SeverityChart({ filters }: SeverityChartProps) {
  const [rows, setRows] = useState<SeverityRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchBySeverity(filters)
      .then((res) => {
        if (!cancelled) setRows(res.rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const data = useMemo(
    () =>
      [...rows].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)),
    [rows]
  );

  return (
    <ChartCard title="Severity distribution">
      <div style={{ width: '100%', height: 280, opacity: loading ? 0.6 : 1, transition: 'opacity 150ms' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }} barSize={20}>
            <XAxis
              type="number"
              allowDecimals={false}
              stroke="var(--baseline)"
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="severity"
              stroke="var(--baseline)"
              tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
              tickLine={false}
              width={70}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--gridline)', opacity: 0.4 }} />
            <Bar dataKey="count" name="CVEs" radius={[0, 4, 4, 0]}>
              {data.map((d) => (
                <Cell key={d.severity} fill={severityColor(d.severity)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
