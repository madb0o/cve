import { fetchAllPages, type NvdCveRecord } from './apiClient.js';
import { classifyCve } from './classify.js';
import { upsertCves, getSyncState, setSyncState } from '../db/client.js';

const MAX_WINDOW_DAYS = 120;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const NVD_EPOCH = new Date('1999-01-01T00:00:00Z');

function formatNvdDate(d: Date): string {
  return d.toISOString().split('.')[0] + 'Z';
}

/** Splits [start, end] into consecutive windows no longer than NVD's 120-day max. */
export function dateWindows(start: Date, end: Date): [Date, Date][] {
  const windows: [Date, Date][] = [];
  let cursor = new Date(start);
  while (cursor < end) {
    const windowEnd = new Date(Math.min(cursor.getTime() + MAX_WINDOW_DAYS * MS_PER_DAY, end.getTime()));
    windows.push([new Date(cursor), windowEnd]);
    cursor = windowEnd;
  }
  return windows;
}

export interface SyncProgress {
  windowStart: Date;
  windowEnd: Date;
  windowIndex: number;
  windowCount: number;
  recordsInWindow: number;
}

async function syncWindow(
  params: { start: string; end: string },
  dateField: 'pub' | 'lastMod',
  onRecords: (records: NvdCveRecord[]) => void
): Promise<number> {
  const baseParams: Record<string, string> =
    dateField === 'pub'
      ? { pubStartDate: params.start, pubEndDate: params.end }
      : { lastModStartDate: params.start, lastModEndDate: params.end };

  let count = 0;
  for await (const page of fetchAllPages(baseParams)) {
    onRecords(page);
    count += page.length;
  }
  return count;
}

/**
 * Backfills published CVEs across [from, to], resuming from sync_state.backfill_cursor
 * if a previous run was interrupted.
 */
export async function backfill(
  from: Date,
  to: Date,
  onProgress?: (p: SyncProgress) => void
): Promise<void> {
  const cursorStr = getSyncState('backfill_cursor');
  const cursor = cursorStr ? new Date(cursorStr) : null;
  const effectiveFrom = cursor && cursor > from ? cursor : from;

  const windows = dateWindows(effectiveFrom, to);

  for (let i = 0; i < windows.length; i++) {
    const [windowStart, windowEnd] = windows[i];
    let recordsInWindow = 0;

    await syncWindow(
      { start: formatNvdDate(windowStart), end: formatNvdDate(windowEnd) },
      'pub',
      (records) => {
        const classified = records.map((r) => classifyCve(r as never));
        upsertCves(classified);
        recordsInWindow += records.length;
      }
    );

    setSyncState('backfill_cursor', windowEnd.toISOString());
    onProgress?.({
      windowStart,
      windowEnd,
      windowIndex: i + 1,
      windowCount: windows.length,
      recordsInWindow,
    });
  }
}

/** Pulls anything published or modified since the last successful sync. */
export async function incrementalSync(): Promise<{ recordsSynced: number }> {
  const lastSyncStr = getSyncState('last_incremental_sync');
  const from = lastSyncStr ? new Date(lastSyncStr) : new Date(Date.now() - 24 * MS_PER_DAY);
  const to = new Date();

  let total = 0;
  for (const [windowStart, windowEnd] of dateWindows(from, to)) {
    total += await syncWindow(
      { start: formatNvdDate(windowStart), end: formatNvdDate(windowEnd) },
      'lastMod',
      (records) => {
        const classified = records.map((r) => classifyCve(r as never));
        upsertCves(classified);
      }
    );
  }

  setSyncState('last_incremental_sync', to.toISOString());
  return { recordsSynced: total };
}
