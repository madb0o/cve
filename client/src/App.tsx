import { useEffect, useMemo, useState } from 'react';
import styles from './App.module.css';
import { fetchMeta, fetchSummary, triggerSync } from './api';
import { defaultFilterState, FilterBar, type FilterState } from './components/FilterBar';
import { KpiTiles } from './components/KpiTiles';
import { SeasonalComparisonChart } from './components/SeasonalComparisonChart';
import { SeverityChart } from './components/SeverityChart';
import { TrendChart } from './components/TrendChart';
import { TypeChart } from './components/TypeChart';
import type { Filters, Meta, SummaryStats } from './types';

function toApiFilters(state: FilterState): Filters {
  return {
    from: state.from,
    to: state.to,
    severity: state.severities,
    type: state.types,
    vendor: state.vendor,
    includeRejected: state.includeRejected,
  };
}

function formatSyncTime(iso: string | null): string {
  if (!iso) return 'never';
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function App() {
  const [filterState, setFilterState] = useState<FilterState>(defaultFilterState());
  const [meta, setMeta] = useState<Meta | null>(null);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  const filters = useMemo(() => toApiFilters(filterState), [filterState]);

  useEffect(() => {
    fetchMeta()
      .then((m) => {
        setMeta(m);
        setLoadError(false);
      })
      .catch(() => setLoadError(true));
  }, [syncing, retryTick]);

  useEffect(() => {
    fetchSummary(filters)
      .then((s) => {
        setSummary(s);
        setLoadError(false);
      })
      .catch(() => setLoadError(true));
  }, [filters, retryTick]);

  // getJson already retries a couple of times internally; this covers the
  // longer outage (e.g. a pod restart) that outlasts those retries, so the
  // dashboard recovers on its own instead of needing a manual "Sync now".
  useEffect(() => {
    if (!loadError) return;
    const timer = setTimeout(() => setRetryTick((t) => t + 1), 8000);
    return () => clearTimeout(timer);
  }, [loadError, retryTick]);

  async function handleSync() {
    setSyncing(true);
    try {
      await triggerSync();
    } catch {
      setLoadError(true);
    } finally {
      setSyncing(false);
      fetchMeta()
        .then((m) => {
          setMeta(m);
          setLoadError(false);
        })
        .catch(() => setLoadError(true));
      fetchSummary(filters)
        .then((s) => {
          setSummary(s);
          setLoadError(false);
        })
        .catch(() => setLoadError(true));
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>CVE Monitoring Dashboard</h1>
          <p className={styles.subtitle}>
            {meta ? `${meta.totalCves.toLocaleString()} CVEs tracked` : 'Loading…'}
            {meta?.dateRange.min && (
              <> · {new Date(meta.dateRange.min).getFullYear()}–{new Date(meta.dateRange.max ?? '').getFullYear()}</>
            )}
            {filterState.vendorLabel && <> · Showing: {filterState.vendorLabel}</>}
          </p>
        </div>
        <div className={styles.syncRow}>
          {loadError && <span className={styles.syncError}>Couldn't reach the server — retrying…</span>}
          <span>Last synced: {formatSyncTime(meta?.lastIncrementalSync ?? null)}</span>
          <button className={styles.syncButton} onClick={handleSync} disabled={syncing || meta?.syncInProgress}>
            {syncing || meta?.syncInProgress ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
      </div>

      <FilterBar
        state={filterState}
        onChange={setFilterState}
        availableSeverities={meta?.severities ?? []}
        availableTypes={meta?.types ?? []}
      />

      <div className={styles.section}>
        <KpiTiles summary={summary} />
      </div>

      <div className={styles.section}>
        <TrendChart filters={filters} />
      </div>

      <div className={styles.section}>
        <SeasonalComparisonChart filters={filters} />
      </div>

      <div className={styles.chartsRow}>
        <SeverityChart filters={filters} />
        <TypeChart filters={filters} />
      </div>
    </div>
  );
}
