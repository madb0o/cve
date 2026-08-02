import type {
  CveListItem,
  Filters,
  Granularity,
  Meta,
  SeverityRow,
  SummaryStats,
  TrendResponse,
  TypeRow,
} from './types';

function toQuery(params: Record<string, string | string[] | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length) search.set(key, value.join(','));
    } else {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Request failed: ${res.status} ${path}`);
  return res.json() as Promise<T>;
}

function filterQuery(filters: Filters): Record<string, string | string[] | undefined> {
  return { from: filters.from, to: filters.to, severity: filters.severity, type: filters.type };
}

export function fetchSummary(filters: Filters): Promise<SummaryStats> {
  return getJson(`/api/stats/summary${toQuery(filterQuery(filters))}`);
}

export function fetchTrend(
  filters: Filters,
  granularity: Granularity,
  groupBy: 'severity' | 'type' | null
): Promise<TrendResponse> {
  return getJson(
    `/api/stats/trend${toQuery({ ...filterQuery(filters), granularity, groupBy: groupBy ?? undefined })}`
  );
}

export function fetchBySeverity(filters: Filters): Promise<{ rows: SeverityRow[] }> {
  return getJson(`/api/stats/by-severity${toQuery(filterQuery(filters))}`);
}

export function fetchByType(filters: Filters, limit = 15): Promise<{ rows: TypeRow[]; truncated: boolean }> {
  return getJson(`/api/stats/by-type${toQuery({ ...filterQuery(filters), limit })}`);
}

export function fetchCves(
  filters: Filters,
  page: number,
  pageSize: number,
  q?: string
): Promise<{ total: number; page: number; pageSize: number; rows: CveListItem[] }> {
  return getJson(`/api/cves${toQuery({ ...filterQuery(filters), page, pageSize, q })}`);
}

export function fetchMeta(): Promise<Meta> {
  return getJson('/api/meta');
}

export async function triggerSync(): Promise<{ recordsSynced: number }> {
  const res = await fetch('/api/sync/trigger', { method: 'POST' });
  if (!res.ok) throw new Error(`Sync trigger failed: ${res.status}`);
  return res.json();
}
