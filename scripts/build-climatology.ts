#!/usr/bin/env bun
/**
 * Build Hobday climatology + 90th-percentile threshold CSVs per region.
 *
 * Data source: NOAA Coral Reef Watch CoralTemp v3.1 (5 km daily SST),
 * served via the PIFSC ERDDAP endpoint. CoralTemp is what NOAA CRW uses
 * for its global marine-heatwave monitoring; methodology is compatible
 * with the Hobday (2016) reference algorithm.
 *
 * Climatology period: 1991-01-01 → 2020-12-31 (30 years, WMO standard).
 *
 * Algorithm (matching ecjoliver/marineHeatWaves defaults):
 *   For each DOY t ∈ [1, 366]:
 *     pool = SST values for all (year, doy') where doy' ∈ [t-5, t+5] (mod 366)
 *     seas[t]   = mean(pool)
 *     thresh[t] = 90th percentile(pool)
 *   Then apply 31-day centred moving average (wrapping year boundary)
 *   to both seas and thresh.
 *
 * Output: data/climatology/<region-id>.csv with columns
 *   lon, lat, doy, seas, thresh, thresh_MCS
 * (thresh_MCS = 10th-percentile cold-spell threshold, computed for
 * compatibility with the tracker's CSV format; unused by the app.)
 *
 * Run:
 *   bun run scripts/build-climatology.ts
 *
 * Re-runnable: skips regions whose output CSV already exists unless
 * --force is passed.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { regions, type Region } from "../src/lib/regions";

const ERDDAP_BASE =
  "https://oceanwatch.pifsc.noaa.gov/erddap/griddap/CRW_sst_v3_1.csv";
const CLIM_START_YEAR = 1991;
const CLIM_END_YEAR = 2020;
const CHUNK_YEARS = 10; // ~110s per 10-year chunk per pixel; ERDDAP-friendly size
const CONCURRENCY = 3; // polite parallelism against PIFSC
const WINDOW_HALF_WIDTH = 5; // Oliver default: ±5-day DOY pool
const SMOOTH_WIDTH = 31; // Oliver default: 31-day moving average
const PCTILE_HIGH = 90;
const PCTILE_LOW = 10;

const OUT_DIR = path.join(process.cwd(), "data", "climatology");
const FORCE = process.argv.includes("--force");

type DailySst = {
  doy: number;
  sst: number;
};

type FetchedSeries = {
  region: Region;
  values: DailySst[];
  resolvedLat: number;
  resolvedLon: number;
};

/**
 * Fetch a single 10-year chunk of CoralTemp daily SST from PIFSC ERDDAP.
 * Retries twice on transient failure (502/timeout).
 */
async function fetchChunk(
  region: Region,
  startYear: number,
  endYear: number,
): Promise<{ rows: DailySst[]; resolvedLat: number; resolvedLon: number }> {
  const start = `${startYear}-01-01T12:00:00Z`;
  const end = `${endYear}-12-31T12:00:00Z`;
  const query =
    `analysed_sst` +
    `[(${start}):1:(${end})]` +
    `[(${region.lat}):1:(${region.lat})]` +
    `[(${region.lon}):1:(${region.lon})]`;
  const url = `${ERDDAP_BASE}?${encodeURIComponent(query)}`;

  const maxAttempts = 3;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const ctrl = AbortSignal.timeout(180_000);
      const res = await fetch(url, { signal: ctrl });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      return parseErddapCsv(text);
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        const backoff = 2000 * attempt;
        console.warn(
          `  retry ${attempt}/${maxAttempts - 1} for ${region.id} ${startYear}-${endYear}: ${err}`,
        );
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
  }
  throw new Error(
    `fetchChunk failed for ${region.id} ${startYear}-${endYear}: ${lastErr}`,
  );
}

function parseErddapCsv(text: string): {
  rows: DailySst[];
  resolvedLat: number;
  resolvedLon: number;
} {
  // ERDDAP CSV: first line = column names, second line = units, then data.
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 3) throw new Error(`empty ERDDAP response: ${text.slice(0, 200)}`);
  const header = lines[0].split(",");
  const iTime = header.indexOf("time");
  const iLat = header.indexOf("latitude");
  const iLon = header.indexOf("longitude");
  const iSst = header.indexOf("analysed_sst");
  if (iTime < 0 || iSst < 0) throw new Error(`bad header: ${lines[0]}`);

  const rows: DailySst[] = [];
  let resolvedLat = 0;
  let resolvedLon = 0;
  for (let k = 2; k < lines.length; k++) {
    const cols = lines[k].split(",");
    const sstStr = cols[iSst];
    if (!sstStr || sstStr === "NaN") continue;
    const sst = Number(sstStr);
    if (!Number.isFinite(sst)) continue;
    const dateIso = cols[iTime];
    resolvedLat = Number(cols[iLat]);
    resolvedLon = Number(cols[iLon]);
    rows.push({ doy: calendarDoy(dateIso), sst });
  }
  return { rows, resolvedLat, resolvedLon };
}

/** Calendar day-of-year 1..366 for an ISO date string. */
function calendarDoy(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const start = Date.UTC(y, 0, 1);
  const now = Date.UTC(y, m - 1, d);
  return Math.floor((now - start) / 86_400_000) + 1;
}

/**
 * Pull all chunks for a region and concat into a single series.
 */
async function fetchRegion(region: Region): Promise<FetchedSeries> {
  const chunks: { rows: DailySst[]; resolvedLat: number; resolvedLon: number }[] = [];
  for (let y = CLIM_START_YEAR; y <= CLIM_END_YEAR; y += CHUNK_YEARS) {
    const endY = Math.min(y + CHUNK_YEARS - 1, CLIM_END_YEAR);
    process.stderr.write(`  ${region.id}: fetching ${y}-${endY}... `);
    const t0 = Date.now();
    const c = await fetchChunk(region, y, endY);
    process.stderr.write(
      `${c.rows.length} rows in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`,
    );
    chunks.push(c);
  }
  const values: DailySst[] = chunks.flatMap((c) => c.rows);
  return {
    region,
    values,
    resolvedLat: chunks[0]?.resolvedLat ?? region.lat,
    resolvedLon: chunks[0]?.resolvedLon ?? region.lon,
  };
}

/**
 * Hobday climatology + thresholds.
 * Pool step: for each target DOY, pool values from all years whose DOY
 * falls within ±windowHalfWidth of target (wrapping modulo 366).
 * Smoothing: 31-day centred moving average on the DOY axis.
 */
function computeClimatology(values: DailySst[]): {
  seas: number[];
  thresh: number[];
  threshMCS: number[];
} {
  // Bucket values by DOY (1..366).
  const byDoy = new Map<number, number[]>();
  for (const v of values) {
    const arr = byDoy.get(v.doy);
    if (arr) arr.push(v.sst);
    else byDoy.set(v.doy, [v.sst]);
  }

  // For each target DOY t ∈ 1..366, pool all samples from t-W..t+W (wrap).
  const seas = new Array<number>(367);
  const thresh = new Array<number>(367);
  const threshMCS = new Array<number>(367);
  for (let t = 1; t <= 366; t++) {
    const pool: number[] = [];
    for (let off = -WINDOW_HALF_WIDTH; off <= WINDOW_HALF_WIDTH; off++) {
      let d = t + off;
      if (d < 1) d += 366;
      if (d > 366) d -= 366;
      const arr = byDoy.get(d);
      if (arr) pool.push(...arr);
    }
    if (pool.length === 0) {
      seas[t] = NaN;
      thresh[t] = NaN;
      threshMCS[t] = NaN;
      continue;
    }
    seas[t] = mean(pool);
    thresh[t] = percentile(pool, PCTILE_HIGH);
    threshMCS[t] = percentile(pool, PCTILE_LOW);
  }

  // Fill any NaN (shouldn't occur with full 1991-2020 coverage, but guard)
  // by nearest-neighbour interpolation over DOY.
  interpolateNaNs(seas);
  interpolateNaNs(thresh);
  interpolateNaNs(threshMCS);

  // 31-day centred moving average on the DOY axis (wrap year boundary).
  return {
    seas: smoothWrap(seas),
    thresh: smoothWrap(thresh),
    threshMCS: smoothWrap(threshMCS),
  };
}

function mean(xs: number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/** Linear interpolation percentile (matches numpy default). */
function percentile(xs: number[], p: number): number {
  const sorted = xs.slice().sort((a, b) => a - b);
  const n = sorted.length;
  const rank = (p / 100) * (n - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  const frac = rank - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

function interpolateNaNs(arr: number[]): void {
  // Indices 1..366 are meaningful; index 0 unused.
  for (let i = 1; i <= 366; i++) {
    if (!Number.isFinite(arr[i])) {
      // Find nearest non-NaN forward and back with DOY wrap.
      let back = i - 1;
      let fwd = i + 1;
      let bVal = NaN;
      let fVal = NaN;
      let steps = 0;
      while (steps < 366) {
        const b = ((back - 1 + 366) % 366) + 1;
        const f = ((fwd - 1) % 366) + 1;
        if (!Number.isFinite(bVal) && Number.isFinite(arr[b])) bVal = arr[b];
        if (!Number.isFinite(fVal) && Number.isFinite(arr[f])) fVal = arr[f];
        if (Number.isFinite(bVal) && Number.isFinite(fVal)) break;
        back--;
        fwd++;
        steps++;
      }
      if (Number.isFinite(bVal) && Number.isFinite(fVal)) arr[i] = (bVal + fVal) / 2;
      else if (Number.isFinite(bVal)) arr[i] = bVal;
      else if (Number.isFinite(fVal)) arr[i] = fVal;
    }
  }
}

function smoothWrap(arr: number[]): number[] {
  // arr[1..366] is meaningful. Centred moving average of width SMOOTH_WIDTH.
  const half = Math.floor(SMOOTH_WIDTH / 2);
  const out = new Array<number>(367);
  for (let t = 1; t <= 366; t++) {
    let sum = 0;
    let n = 0;
    for (let k = -half; k <= half; k++) {
      let d = t + k;
      if (d < 1) d += 366;
      if (d > 366) d -= 366;
      const v = arr[d];
      if (Number.isFinite(v)) {
        sum += v;
        n++;
      }
    }
    out[t] = n > 0 ? sum / n : NaN;
  }
  return out;
}

function writeRegionCsv(
  region: Region,
  resolvedLat: number,
  resolvedLon: number,
  seas: number[],
  thresh: number[],
  threshMCS: number[],
): string {
  const header = "lon,lat,doy,seas,thresh,thresh_MCS";
  const rows: string[] = [header];
  for (let t = 1; t <= 366; t++) {
    rows.push(
      [
        resolvedLon.toFixed(3),
        resolvedLat.toFixed(3),
        t,
        seas[t].toFixed(4),
        thresh[t].toFixed(4),
        threshMCS[t].toFixed(4),
      ].join(","),
    );
  }
  return rows.join("\n") + "\n";
}

async function processRegion(region: Region): Promise<void> {
  const outPath = path.join(OUT_DIR, `${region.id}.csv`);
  if (!FORCE) {
    try {
      await fs.access(outPath);
      console.log(`✓ ${region.id} — already built, skipping (pass --force to rebuild)`);
      return;
    } catch {
      // not present, continue
    }
  }
  console.log(`→ ${region.id} (${region.lat}, ${region.lon})`);
  const fetched = await fetchRegion(region);
  if (fetched.values.length < 365 * 20) {
    throw new Error(
      `${region.id}: only ${fetched.values.length} SST samples — likely a land pixel or ERDDAP problem`,
    );
  }
  console.log(
    `  ${region.id}: ${fetched.values.length} daily SSTs, resolved grid (${fetched.resolvedLat}, ${fetched.resolvedLon})`,
  );
  const { seas, thresh, threshMCS } = computeClimatology(fetched.values);
  const csv = writeRegionCsv(
    region,
    fetched.resolvedLat,
    fetched.resolvedLon,
    seas,
    thresh,
    threshMCS,
  );
  await fs.writeFile(outPath, csv, "utf-8");
  console.log(
    `✓ ${region.id} → ${outPath}  (seas@doy=107: ${seas[107].toFixed(2)}°C · thresh@doy=107: ${thresh[107].toFixed(2)}°C)`,
  );
}

/** Run processRegion on all regions with bounded concurrency. */
async function runAll(): Promise<void> {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const queue = regions.slice();
  let active = 0;
  let failed = 0;
  await new Promise<void>((resolve) => {
    const launch = () => {
      while (active < CONCURRENCY && queue.length > 0) {
        const region = queue.shift()!;
        active++;
        processRegion(region)
          .catch((err) => {
            failed++;
            console.error(`✗ ${region.id}: ${err}`);
          })
          .finally(() => {
            active--;
            if (queue.length === 0 && active === 0) resolve();
            else launch();
          });
      }
    };
    launch();
  });

  if (failed > 0) {
    console.error(`\n${failed}/${regions.length} regions failed.`);
    process.exit(1);
  }
  console.log(`\n✓ all ${regions.length} regions built.`);
}

runAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
