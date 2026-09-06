import { useEffect, useRef, useState } from 'react';
import type { PresetKey } from '../dateRanges';
import { PRESETS, presetToRange } from '../dateRanges';
import { fetchVendors } from '../api';
import type { VendorOption } from '../types';
import { severityColor } from './severityColor';
import styles from './FilterBar.module.css';

export interface FilterState {
  preset: PresetKey;
  from?: string;
  to?: string;
  severities: string[];
  types: string[];
  vendor?: string;
  vendorLabel?: string;
  includeRejected: boolean;
}

export function defaultFilterState(): FilterState {
  return {
    preset: 'all',
    ...presetToRange('all'),
    severities: [],
    types: [],
    vendor: undefined,
    vendorLabel: undefined,
    includeRejected: false,
  };
}

interface FilterBarProps {
  state: FilterState;
  onChange: (next: FilterState) => void;
  availableSeverities: string[];
  availableTypes: string[];
}

const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE', 'UNKNOWN'];

export function FilterBar({ state, onChange, availableSeverities, availableTypes }: FilterBarProps) {
  const [openControl, setOpenControl] = useState<'date' | 'severity' | 'type' | 'vendor' | null>(null);
  const [vendorQuery, setVendorQuery] = useState('');
  const [vendorResults, setVendorResults] = useState<VendorOption[]>([]);
  const [vendorLoading, setVendorLoading] = useState(false);
  const vendorDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function closeOnBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setOpenControl(null);
    }
  }

  useEffect(() => {
    if (openControl !== 'vendor') return;
    if (vendorDebounceRef.current) clearTimeout(vendorDebounceRef.current);
    vendorDebounceRef.current = setTimeout(() => {
      setVendorLoading(true);
      fetchVendors(vendorQuery)
        .then((res) => setVendorResults(res.vendors))
        .finally(() => setVendorLoading(false));
    }, 250);
    return () => {
      if (vendorDebounceRef.current) clearTimeout(vendorDebounceRef.current);
    };
  }, [vendorQuery, openControl]);

  function selectVendor(v: VendorOption) {
    onChange({ ...state, vendor: v.slug, vendorLabel: v.label });
    setOpenControl(null);
    setVendorQuery('');
  }

  function clearVendor() {
    onChange({ ...state, vendor: undefined, vendorLabel: undefined });
    setOpenControl(null);
    setVendorQuery('');
  }

  function selectPreset(preset: PresetKey) {
    if (preset === 'custom') {
      onChange({ ...state, preset });
      return;
    }
    onChange({ ...state, preset, ...presetToRange(preset) });
    setOpenControl(null);
  }

  function toggleSeverity(sev: string) {
    const has = state.severities.includes(sev);
    onChange({
      ...state,
      severities: has ? state.severities.filter((s) => s !== sev) : [...state.severities, sev],
    });
  }

  function toggleType(t: string) {
    const has = state.types.includes(t);
    onChange({ ...state, types: has ? state.types.filter((s) => s !== t) : [...state.types, t] });
  }

  const dateLabel = PRESETS.find((p) => p.key === state.preset)?.label ?? 'Date range';
  const sortedSeverities = [...availableSeverities].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a) - SEVERITY_ORDER.indexOf(b)
  );

  return (
    <div className={styles.bar}>
      <div className={styles.control} onBlur={closeOnBlur}>
        <button
          type="button"
          className={styles.trigger}
          onClick={() => setOpenControl(openControl === 'date' ? null : 'date')}
        >
          {dateLabel}
        </button>
        {openControl === 'date' && (
          <div className={styles.panel}>
            {PRESETS.map((p) => (
              <div
                key={p.key}
                className={`${styles.row} ${state.preset === p.key ? styles.rowSelected : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectPreset(p.key)}
              >
                <span className={styles.rowLabel}>{p.label}</span>
                <span className={styles.check}>&#10003;</span>
              </div>
            ))}
            {state.preset === 'custom' && (
              <div className={styles.footer}>
                <input
                  type="date"
                  value={state.from ? state.from.slice(0, 10) : ''}
                  onChange={(e) =>
                    onChange({ ...state, from: e.target.value ? `${e.target.value}T00:00:00.000Z` : undefined })
                  }
                />
                <span>&rarr;</span>
                <input
                  type="date"
                  value={state.to ? state.to.slice(0, 10) : ''}
                  onChange={(e) =>
                    onChange({ ...state, to: e.target.value ? `${e.target.value}T23:59:59.999Z` : undefined })
                  }
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.control} onBlur={closeOnBlur}>
        <button
          type="button"
          className={styles.trigger}
          onClick={() => setOpenControl(openControl === 'severity' ? null : 'severity')}
        >
          Severity
          {state.severities.length > 0 && <span className={styles.count}>({state.severities.length})</span>}
        </button>
        {openControl === 'severity' && (
          <div className={styles.panel}>
            {sortedSeverities.map((sev) => (
              <div
                key={sev}
                className={`${styles.row} ${state.severities.includes(sev) ? styles.rowSelected : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => toggleSeverity(sev)}
              >
                <span className={styles.rowLabel}>
                  <span className={styles.dot} style={{ background: severityColor(sev) }} />
                  {sev}
                </span>
                <span className={styles.check}>&#10003;</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.control} onBlur={closeOnBlur}>
        <button
          type="button"
          className={styles.trigger}
          onClick={() => setOpenControl(openControl === 'type' ? null : 'type')}
        >
          Vulnerability type
          {state.types.length > 0 && <span className={styles.count}>({state.types.length})</span>}
        </button>
        {openControl === 'type' && (
          <div className={styles.panel} style={{ maxHeight: 320, overflowY: 'auto' }}>
            {availableTypes.map((t) => (
              <div
                key={t}
                className={`${styles.row} ${state.types.includes(t) ? styles.rowSelected : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => toggleType(t)}
              >
                <span className={styles.rowLabel}>{t}</span>
                <span className={styles.check}>&#10003;</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.control} onBlur={closeOnBlur}>
        <button
          type="button"
          className={`${styles.trigger} ${state.vendor ? styles.toggleActive : ''}`}
          onClick={() => setOpenControl(openControl === 'vendor' ? null : 'vendor')}
        >
          {state.vendor ? `Vendor: ${state.vendorLabel}` : 'Vendor'}
        </button>
        {openControl === 'vendor' && (
          <div className={styles.panel} style={{ minWidth: 260 }}>
            <input
              type="text"
              autoFocus
              placeholder="Search vendors (e.g. microsoft)"
              value={vendorQuery}
              onChange={(e) => setVendorQuery(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                fontSize: 13,
                padding: '7px 10px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--surface-1)',
                color: 'var(--text-primary)',
                marginBottom: 4,
              }}
            />
            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
              {vendorLoading && <div className={styles.row}>Searching…</div>}
              {!vendorLoading && vendorResults.length === 0 && (
                <div className={styles.row}>{vendorQuery ? 'No matching vendors' : 'Top vendors by CVE count'}</div>
              )}
              {!vendorLoading &&
                vendorResults.map((v) => (
                  <div
                    key={v.slug}
                    className={`${styles.row} ${state.vendor === v.slug ? styles.rowSelected : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectVendor(v)}
                  >
                    <span className={styles.rowLabel}>{v.label}</span>
                    <span className={styles.count}>{v.count.toLocaleString()}</span>
                  </div>
                ))}
            </div>
            {state.vendor && (
              <div className={styles.footer}>
                <button type="button" className={styles.trigger} onMouseDown={(e) => e.preventDefault()} onClick={clearVendor}>
                  Clear vendor
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        className={`${styles.trigger} ${state.includeRejected ? styles.toggleActive : ''}`}
        aria-pressed={state.includeRejected}
        onClick={() => onChange({ ...state, includeRejected: !state.includeRejected })}
      >
        Include rejected
      </button>

      {(state.severities.length > 0 ||
        state.types.length > 0 ||
        state.vendor ||
        state.preset !== 'all' ||
        state.includeRejected) && (
        <button type="button" className={styles.trigger} onClick={() => onChange(defaultFilterState())}>
          Clear filters
        </button>
      )}
    </div>
  );
}
