export type PresetKey = '7d' | '30d' | '90d' | 'mtd' | 'ytd' | '12m' | 'all' | 'custom';

export const PRESETS: { key: PresetKey; label: string }[] = [
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 90 days' },
  { key: 'mtd', label: 'Month to date' },
  { key: 'ytd', label: 'Year to date' },
  { key: '12m', label: 'Last 12 months' },
  { key: 'all', label: 'All time' },
  { key: 'custom', label: 'Custom range' },
];

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export function presetToRange(preset: PresetKey): { from?: string; to?: string } {
  const now = new Date();
  switch (preset) {
    case '7d':
      return { from: isoDaysAgo(7) };
    case '30d':
      return { from: isoDaysAgo(30) };
    case '90d':
      return { from: isoDaysAgo(90) };
    case 'mtd':
      return { from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString() };
    case 'ytd':
      return { from: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString() };
    case '12m':
      return { from: isoDaysAgo(365) };
    case 'all':
      return {};
    case 'custom':
      return {};
  }
}
