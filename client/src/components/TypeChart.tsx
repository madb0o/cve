import { useEffect, useState } from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fetchByType } from '../api';
import type { Filters, TypeRow } from '../types';
import { ChartCard } from './ChartCard';
import { ChartTooltip } from './ChartTooltip';

interface TypeChartProps {
  filters: Filters;
}

const TOP_N = 15;

export function TypeChart({ filters }: TypeChartProps) {
  const [rows, setRows] = useState<TypeRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchByType(filters, TOP_N)
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

  const data = [...rows].sort((a, b) => b.count - a.count);
  const height = Math.max(220, data.length * 26 + 40);

  return (
    <ChartCard title="Vulnerability type (derived from CWE)">
      <div style={{ width: '100%', height, opacity: loading ? 0.6 : 1, transition: 'opacity 150ms' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }} barSize={16}>
            <XAxis
              type="number"
              allowDecimals={false}
              stroke="var(--baseline)"
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="vuln_type"
              stroke="var(--baseline)"
              tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
              tickLine={false}
              width={170}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--gridline)', opacity: 0.4 }} />
            <Bar dataKey="count" name="CVEs" radius={[0, 4, 4, 0]}>
              {data.map((d, i) => (
                <Cell
                  key={d.vuln_type}
                  fill={d.vuln_type === 'Other' ? 'var(--other)' : 'var(--series-1)'}
                  fillOpacity={d.vuln_type === 'Other' ? 1 : Math.max(0.45, 1 - (i / Math.max(1, data.length)) * 0.55)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
