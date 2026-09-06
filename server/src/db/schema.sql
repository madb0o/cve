CREATE TABLE IF NOT EXISTS cves (
  id TEXT PRIMARY KEY,
  published TEXT NOT NULL,
  last_modified TEXT NOT NULL,
  vuln_status TEXT,
  description TEXT,
  cvss_version TEXT,
  cvss_score REAL,
  severity TEXT,
  cwe_ids TEXT,
  vuln_type TEXT,
  raw_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_cves_published ON cves(published);
CREATE INDEX IF NOT EXISTS idx_cves_severity ON cves(severity);
CREATE INDEX IF NOT EXISTS idx_cves_vuln_type ON cves(vuln_type);
CREATE INDEX IF NOT EXISTS idx_cves_last_modified ON cves(last_modified);

CREATE TABLE IF NOT EXISTS sync_state (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- One row per (cve, vendor) pair, derived from CPE match strings in each
-- CVE's raw_json configurations. A CVE can name multiple vendors, so this
-- is a separate table rather than a column on cves, joined via subquery in
-- queryFilters.ts.
CREATE TABLE IF NOT EXISTS cve_vendors (
  cve_id TEXT NOT NULL,
  vendor TEXT NOT NULL,
  PRIMARY KEY (cve_id, vendor)
);

CREATE INDEX IF NOT EXISTS idx_cve_vendors_vendor ON cve_vendors(vendor);
