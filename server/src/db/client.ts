import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'cve.db'));
db.exec('PRAGMA journal_mode = WAL;');
db.exec(readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8'));

export interface ClassifiedCve {
  id: string;
  published: string;
  lastModified: string;
  vulnStatus: string | null;
  description: string | null;
  cvssVersion: string | null;
  cvssScore: number | null;
  severity: string | null;
  cweIds: string[];
  vulnType: string;
  raw: unknown;
}

const upsertStmt = db.prepare(`
  INSERT INTO cves (id, published, last_modified, vuln_status, description, cvss_version, cvss_score, severity, cwe_ids, vuln_type, raw_json)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    published=excluded.published,
    last_modified=excluded.last_modified,
    vuln_status=excluded.vuln_status,
    description=excluded.description,
    cvss_version=excluded.cvss_version,
    cvss_score=excluded.cvss_score,
    severity=excluded.severity,
    cwe_ids=excluded.cwe_ids,
    vuln_type=excluded.vuln_type,
    raw_json=excluded.raw_json
`);

export function upsertCves(records: ClassifiedCve[]): void {
  if (records.length === 0) return;
  db.exec('BEGIN');
  try {
    for (const c of records) {
      upsertStmt.run(
        c.id,
        c.published,
        c.lastModified,
        c.vulnStatus,
        c.description,
        c.cvssVersion,
        c.cvssScore,
        c.severity,
        JSON.stringify(c.cweIds),
        c.vulnType,
        JSON.stringify(c.raw)
      );
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

const getStateStmt = db.prepare('SELECT value FROM sync_state WHERE key = ?');
const setStateStmt = db.prepare(
  'INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
);

export function getSyncState(key: string): string | null {
  const row = getStateStmt.get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

export function setSyncState(key: string, value: string): void {
  setStateStmt.run(key, value);
}
