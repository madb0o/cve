import type {
  CveListItem,
  Filters,
  Granularity,
  Meta,
  MonthlyMatrixResponse,
  SeverityRow,
  SummaryStats,
  TrendResponse,
  TypeRow,
  VendorSearchResponse,
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

// The server can briefly stop responding mid-sync (large NVD batches block
// its event loop for short stretches) or during a pod restart. A couple of
// short retries absorb that without the user having to notice and click
// "Sync now" to recover.
const FETCH_RETRY_DELAYS_MS = [500, 2000];

async function getJson<T>(path: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`Request failed: ${res.status} ${path}`);
      return (await res.json()) as T;
    } catch (err) {
      if (attempt >= FETCH_RETRY_DELAYS_MS.length) throw err;
      await new Promise((resolve) => setTimeout(resolve, FETCH_RETRY_DELAYS_MS[attempt]));
    }
  }
}

function filterQuery(filters: Filters): Record<string, string | string[] | undefined> {
  return {
    from: filters.from,
    to: filters.to,
    severity: filters.severity,
    type: filters.type,
    vendor: filters.vendor,
    includeRejected: filters.includeRejected ? 'true' : undefined,
  };
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

export function fetchByMonth(
  filters: Pick<Filters, 'severity' | 'type' | 'vendor' | 'includeRejected'>
): Promise<MonthlyMatrixResponse> {
  return getJson(
    `/api/stats/by-month${toQuery({
      severity: filters.severity,
      type: filters.type,
      vendor: filters.vendor,
      includeRejected: filters.includeRejected ? 'true' : undefined,
    })}`
  );
}

export function fetchVendors(q: string, limit = 20): Promise<VendorSearchResponse> {
  return getJson(`/api/vendors${toQuery({ q, limit })}`);
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
