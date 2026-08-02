interface TooltipPayloadItem {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  label?: string;
  payload?: TooltipPayloadItem[];
  labelFormatter?: (label: string) => string;
  valueFormatter?: (value: number) => string;
}

const numberFormat = new Intl.NumberFormat('en-US');

export function ChartTooltip({ active, label, payload, labelFormatter, valueFormatter }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const fmtValue = valueFormatter ?? ((v: number) => numberFormat.format(v));
  const fmtLabel = labelFormatter ?? ((l: string) => l);

  return (
    <div
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '8px 10px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
        fontSize: 12,
        minWidth: 140,
      }}
    >
      {label != null && (
        <div style={{ color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>{fmtLabel(label)}</div>
      )}
      {payload.map((entry, i) => (
        <div
          key={`${entry.dataKey ?? entry.name ?? i}`}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}
        >
          <span style={{ width: 10, height: 2, background: entry.color, flex: 'none', borderRadius: 1 }} />
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            {entry.value != null ? fmtValue(entry.value) : '—'}
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>{entry.name}</span>
        </div>
      ))}
    </div>
  );
}
