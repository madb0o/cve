export interface RangeSummaryStats {
  mode: 'range';
  total: number;
  rangeFrom: string;
  rangeTo: string;
  previousPeriodCount: number;
  periodDeltaPct: number | null;
  yoyCount: number;
  yoyDeltaPct: number | null;
}

export interface AllTimeSummaryStats {
  mode: 'alltime';
  total: number;
  thisYear: number;
  thisMonth: number;
  thisWeek: number;
  today: number;
  lastYearToDate: number;
  yoyDeltaPct: number | null;
}

export type SummaryStats = RangeSummaryStats | AllTimeSummaryStats;

export type Granularity = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type GroupBy = 'severity' | 'type' | null;

export interface TrendRow {
  bucket: string;
  group_key?: string;
  count: number;
}

export interface TrendResponse {
  granularity: Granularity;
  groupBy: string | null;
  rows: TrendRow[];
}

export interface SeverityRow {
  severity: string;
  count: number;
}

export interface TypeRow {
  vuln_type: string;
  count: number;
}

export interface CveListItem {
  id: string;
  published: string;
  last_modified: string;
  severity: string | null;
  cvss_score: number | null;
  cvss_version: string | null;
  vuln_type: string;
  description: string | null;
}

export interface Meta {
  severities: string[];
  types: string[];
  dateRange: { min: string | null; max: string | null };
  totalCves: number;
  lastIncrementalSync: string | null;
  backfillCursor: string | null;
  syncInProgress: boolean;
}

export interface MonthlyMatrixRow {
  year: number;
  month: number; // 1-12
  count: number;
}

export interface MonthlyMatrixResponse {
  rows: MonthlyMatrixRow[];
}

export interface Filters {
  from?: string;
  to?: string;
  severity?: string[];
  type?: string[];
  includeRejected?: boolean;
}
