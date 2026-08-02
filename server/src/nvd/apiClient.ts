const BASE_URL = 'https://services.nvd.nist.gov/rest/json/cves/2.0';
const RESULTS_PER_PAGE = 2000;
const MAX_RETRIES = 6;

const apiKey = process.env.NVD_API_KEY?.trim() || null;
const RATE_LIMIT = apiKey ? 50 : 5;
const RATE_WINDOW_MS = 30_000;

/** Sliding-window rate limiter matching NVD's published request policy. */
class RateLimiter {
  private timestamps: number[] = [];

  async acquire(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < RATE_WINDOW_MS);
    if (this.timestamps.length >= RATE_LIMIT) {
      const oldest = this.timestamps[0];
      const waitMs = RATE_WINDOW_MS - (now - oldest) + 50;
      await sleep(waitMs);
      return this.acquire();
    }
    this.timestamps.push(Date.now());
  }
}

const limiter = new RateLimiter();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface NvdCveRecord {
  id: string;
  published: string;
  lastModified: string;
  [key: string]: unknown;
}

interface NvdApiResponse {
  resultsPerPage: number;
  startIndex: number;
  totalResults: number;
  vulnerabilities: { cve: NvdCveRecord }[];
}

async function fetchPage(params: Record<string, string>): Promise<NvdApiResponse> {
  const url = new URL(BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    await limiter.acquire();
    const res = await fetch(url, {
      headers: apiKey ? { apiKey } : {},
    });

    if (res.ok) {
      return (await res.json()) as NvdApiResponse;
    }

    if ((res.status === 429 || res.status === 403 || res.status >= 500) && attempt < MAX_RETRIES) {
      const backoffMs = Math.min(2 ** attempt * 1000, 60_000);
      await sleep(backoffMs);
      continue;
    }

    throw new Error(`NVD API request failed: ${res.status} ${res.statusText} (${url.toString()})`);
  }

  throw new Error(`NVD API request exhausted retries (${url.toString()})`);
}

/**
 * Paginates through every result for the given base params (e.g. a pubStartDate/pubEndDate
 * window, or a lastModStartDate/lastModEndDate window), yielding one page of raw CVE
 * records at a time.
 */
export async function* fetchAllPages(
  baseParams: Record<string, string>
): AsyncGenerator<NvdCveRecord[], void, void> {
  let startIndex = 0;
  let totalResults = Infinity;

  while (startIndex < totalResults) {
    const page = await fetchPage({
      ...baseParams,
      startIndex: String(startIndex),
      resultsPerPage: String(RESULTS_PER_PAGE),
    });
    totalResults = page.totalResults;
    yield page.vulnerabilities.map((v) => v.cve);
    startIndex += page.resultsPerPage || RESULTS_PER_PAGE;
    if (!page.vulnerabilities.length) break;
  }
}

export function hasApiKey(): boolean {
  return apiKey !== null;
}
