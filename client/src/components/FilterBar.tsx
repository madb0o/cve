import { useState } from 'react';
import type { PresetKey } from '../dateRanges';
import { PRESETS, presetToRange } from '../dateRanges';
import { severityColor } from './severityColor';
import styles from './FilterBar.module.css';

export interface FilterState {
  preset: PresetKey;
  from?: string;
  to?: string;
  severities: string[];
  types: string[];
}

export function defaultFilterState(): FilterState {
  return { preset: 'all', ...presetToRange('all'), severities: [], types: [] };
}

interface FilterBarProps {
  state: FilterState;
  onChange: (next: FilterState) => void;
  availableSeverities: string[];
  availableTypes: string[];
}

const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE', 'UNKNOWN'];

export function FilterBar({ state, onChange, availableSeverities, availableTypes }: FilterBarProps) {
  const [openControl, setOpenControl] = useState<'date' | 'severity' | 'type' | null>(null);

  function closeOnBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setOpenControl(null);
    }
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

      {(state.severities.length > 0 || state.types.length > 0 || state.preset !== 'all') && (
        <button type="button" className={styles.trigger} onClick={() => onChange(defaultFilterState())}>
          Clear filters
        </button>
      )}
    </div>
  );
}
