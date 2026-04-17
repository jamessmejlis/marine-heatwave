#!/usr/bin/env bun
/**
 * Build per-region calibration offsets between Open-Meteo SST (live source)
 * and NOAA CoralTemp v3.1 (climatology source).
 *
 * Why: live SST and climatology come from different SST products with a
 * ~0.0–0.3 °C systematic offset per pixel. Without correction every anomaly
 * we display is silently biased. See ROADMAP.md v1.1 calibration pass.
 *
 * Method: pull the overlapping recent ~90-day window of both products per
 * region, align by date, compute a single scalar offset
 *
 *   Δ = mean(SST_OM − SST_CT)
 *
 * which gets subtracted from live SST at request time before comparison
 * to climatology. Scalar (not per-DOY) because 90 days isn't enough to
 * resolve seasonal variation; the residual diagnostic below tells us
 * whether that assumption holds.
 *
 * Output: data/calibration/<region-id>.json — committed artifact, loaded
 * by src/lib/calibration.ts and applied in src/lib/hobday.ts buildSeries().
 *
 * Diagnostic: data/calibration/_diagnostic.json — per-region weekly
 * residuals + slope. Build-time only, not loaded by the app. Drives the
 * v1.2 decision on whether to upgrade to per-DOY calibration. See
 * ROADMAP.md v1.2.
 *
 * Run:
 *   bun run scripts/build-calibration.ts
 *
 * Re-runnable: always overwrites (calibration is fast — ~2 min total —
 * and the values drift over time, so a fresh build is the expected case).
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { regions, type Region } from "../src/lib/regions";

const ERDDAP_BASE =
  "https://oceanwatch.pifsc.noaa.gov/erddap/griddap/CRW_sst_v3_1.csv";
const OPEN_METEO_BASE = "https://marine-api.open-meteo.com/v1/marine";

// CoralTemp lags real-time by ~1–2 days. Use a 95-day window ending 2 days
// before today to maximise overlap with Open-Meteo's past_days=95 history.
const WINDOW_DAYS = 95;
const CT_LAG_DAYS = 2;
const MIN_PAIRS = 60; // minimum joined non-null days to trust the offset
const SUSPICIOUS_OFFSET = 1.0; // |Δ| > 1.0 °C → likely a fetch bug
const SUSPICIOUS_SLOPE_90D = 0.15; // |slope across 90d| > 0.15 °C → flag for v1.2
const SUSPICIOUS_RANGE = 0.4; // weekly residual range > 0.4 °C → flag for v1.2
const CONCURRENCY = 3; // polite parallelism (CoralTemp side is the bottleneck)

const OUT_DIR = path.join(process.cwd(), "data", "calibration");

type DailyValue = { date: string; sst: number };

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

/**
 * Fetch CoralTemp daily SST for a region across [start, end]. Single ERDDAP
 * request, single pixel — should return in 5–15s. Mirrors the retry pattern
 * from scripts/build-climatology.ts:fetchChunk.
 */
async function fetchCoralTemp(
  region: Region,
  start: string,
  end: string,
): Promise<{ rows: DailyValue[]; resolvedLat: number; resolvedLon: number }> {
  const query =
    `analysed_sst` +
    `[(${start}T12:00:00Z):1:(${end}T12:00:00Z)]` +
    `[(${region.lat}):1:(${region.lat})]` +
    `[(${region.lon}):1:(${region.lon})]`;
  const url = `${ERDDAP_BASE}?${encodeURIComponent(query)}`;

  const maxAttempts = 3;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const ctrl = AbortSignal.timeout(120_000);
      const res = await fetch(url, { signal: ctrl });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      return parseErddapCsv(text);
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        const backoff = 2000 * attempt;
        console.warn(
          `  retry ${attempt}/${maxAttempts - 1} CoralTemp ${region.id}: ${err}`,
        );
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
  }
  throw new Error(`fetchCoralTemp failed for ${region.id}: ${lastErr}`);
}

function parseErddapCsv(text: string): {
  rows: DailyValue[];
  resolvedLat: number;
  resolvedLon: number;
} {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 3)
    throw new Error(`empty ERDDAP response: ${text.slice(0, 200)}`);
  const header = lines[0].split(",");
  const iTime = header.indexOf("time");
  const iLat = header.indexOf("latitude");
  const iLon = header.indexOf("longitude");
  const iSst = header.indexOf("analysed_sst");
  if (iTime < 0 || iSst < 0) throw new Error(`bad header: ${lines[0]}`);

  const rows: DailyValue[] = [];
  let resolvedLat = 0;
  let resolvedLon = 0;
  for (let k = 2; k < lines.length; k++) {
    const cols = lines[k].split(",");
    const sstStr = cols[iSst];
    if (!sstStr || sstStr === "NaN") continue;
    const sst = Number(sstStr);
    if (!Number.isFinite(sst)) continue;
    const dateIso = cols[iTime].slice(0, 10);
    resolvedLat = Number(cols[iLat]);
    resolvedLon = Number(cols[iLon]);
    rows.push({ date: dateIso, sst });
  }
  return { rows, resolvedLat, resolvedLon };
}

type OpenMeteoResponse = {
  daily: { time: string[]; sea_surface_temperature_mean: (number | null)[] };
};

/**
 * Fetch Open-Meteo SST for [today − WINDOW_DAYS, today]. UTC dates so they
 * align cleanly with CoralTemp's UTC daily files.
 */
async function fetchOpenMeteo(region: Region): Promise<DailyValue[]> {
  const params = new URLSearchParams({
    latitude: region.lat.toString(),
    longitude: region.lon.toString(),
    daily: "sea_surface_temperature_mean",
    timezone: "GMT",
    past_days: WINDOW_DAYS.toString(),
    forecast_days: "1",
  });
  const url = `${OPEN_METEO_BASE}?${params}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok)
    throw new Error(`Open-Meteo failed for ${region.id}: ${res.status}`);
  const json = (await res.json()) as OpenMeteoResponse;
  const out: DailyValue[] = [];
  for (let i = 0; i < json.daily.time.length; i++) {
    const sst = json.daily.sea_surface_temperature_mean[i];
    if (sst === null || sst === undefined || !Number.isFinite(sst)) continue;
    out.push({ date: json.daily.time[i], sst });
  }
  return out;
}

type Pair = { date: string; om: number; ct: number; residual: number };

type RegionDiagnostic = {
  regionId: string;
  n: number;
  offset: number;
  slope_per_day: number;
  slope_per_90d: number;
  r_squared: number;
  weekly_residuals: { weekStart: string; mean: number; n: number }[];
  weekly_range: number;
  flagged: string[];
};

type CalibrationFile = {
  regionId: string;
  offset: number;
  n: number;
  window: { start: string; end: string };
  ctResolvedLat: number;
  ctResolvedLon: number;
  computedAt: string;
};

function mean(xs: number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/** Simple linear regression y = a + b·x. Returns { slope, r_squared }. */
function linreg(ys: number[]): { slope: number; r_squared: number } {
  const n = ys.length;
  if (n < 3) return { slope: 0, r_squared: 0 };
  const xs = Array.from({ length: n }, (_, i) => i);
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0,
    sxx = 0,
    syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const r_squared = sxx === 0 || syy === 0 ? 0 : (sxy * sxy) / (sxx * syy);
  return { slope, r_squared };
}

function weeklyBins(pairs: Pair[]): { weekStart: string; mean: number; n: number }[] {
  // Pairs are date-ordered; group every 7 consecutive days.
  const out: { weekStart: string; mean: number; n: number }[] = [];
  for (let i = 0; i < pairs.length; i += 7) {
    const slice = pairs.slice(i, i + 7);
    if (slice.length === 0) continue;
    out.push({
      weekStart: slice[0].date,
      mean: mean(slice.map((p) => p.residual)),
      n: slice.length,
    });
  }
  return out;
}

async function processRegion(
  region: Region,
): Promise<{ calib: CalibrationFile | null; diag: RegionDiagnostic | null }> {
  const startDate = isoDate(daysAgo(WINDOW_DAYS));
  const endDate = isoDate(daysAgo(CT_LAG_DAYS));
  process.stderr.write(`→ ${region.id}: fetching ${startDate}..${endDate}\n`);

  const [ct, om] = await Promise.all([
    fetchCoralTemp(region, startDate, endDate),
    fetchOpenMeteo(region),
  ]);

  const ctMap = new Map(ct.rows.map((r) => [r.date, r.sst]));
  const pairs: Pair[] = [];
  for (const o of om) {
    const c = ctMap.get(o.date);
    if (c === undefined) continue;
    pairs.push({ date: o.date, om: o.sst, ct: c, residual: o.sst - c });
  }
  pairs.sort((a, b) => a.date.localeCompare(b.date));

  if (pairs.length < MIN_PAIRS) {
    console.warn(
      `✗ ${region.id}: only ${pairs.length} paired days (need ≥${MIN_PAIRS}); writing null calibration`,
    );
    return { calib: null, diag: null };
  }

  const offset = mean(pairs.map((p) => p.residual));
  const { slope, r_squared } = linreg(pairs.map((p) => p.residual));
  const slope_per_90d = slope * 90;
  const weekly = weeklyBins(pairs);
  const weekRange =
    weekly.length > 0
      ? Math.max(...weekly.map((w) => w.mean)) -
        Math.min(...weekly.map((w) => w.mean))
      : 0;

  const flagged: string[] = [];
  if (Math.abs(offset) > SUSPICIOUS_OFFSET) flagged.push("offset>1°C");
  if (Math.abs(slope_per_90d) > SUSPICIOUS_SLOPE_90D)
    flagged.push("trended residual");
  if (weekRange > SUSPICIOUS_RANGE) flagged.push("seasonal residual");

  const calib: CalibrationFile = {
    regionId: region.id,
    offset,
    n: pairs.length,
    window: { start: pairs[0].date, end: pairs[pairs.length - 1].date },
    ctResolvedLat: ct.resolvedLat,
    ctResolvedLon: ct.resolvedLon,
    computedAt: new Date().toISOString(),
  };

  const diag: RegionDiagnostic = {
    regionId: region.id,
    n: pairs.length,
    offset,
    slope_per_day: slope,
    slope_per_90d,
    r_squared,
    weekly_residuals: weekly,
    weekly_range: weekRange,
    flagged,
  };

  console.log(
    `✓ ${region.id}: Δ=${offset >= 0 ? "+" : ""}${offset.toFixed(3)}°C  n=${pairs.length}  slope/90d=${slope_per_90d >= 0 ? "+" : ""}${slope_per_90d.toFixed(3)}°C  weekRange=${weekRange.toFixed(2)}°C${flagged.length ? "  ⚠ " + flagged.join(", ") : ""}`,
  );
  return { calib, diag };
}

async function runAll(): Promise<void> {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const queue = regions.slice();
  const calibs: { region: Region; calib: CalibrationFile | null }[] = [];
  const diags: RegionDiagnostic[] = [];
  let active = 0;
  let failed = 0;

  await new Promise<void>((resolve) => {
    const launch = () => {
      while (active < CONCURRENCY && queue.length > 0) {
        const region = queue.shift()!;
        active++;
        processRegion(region)
          .then(({ calib, diag }) => {
            calibs.push({ region, calib });
            if (diag) diags.push(diag);
          })
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

  for (const { region, calib } of calibs) {
    const outPath = path.join(OUT_DIR, `${region.id}.json`);
    await fs.writeFile(outPath, JSON.stringify(calib, null, 2) + "\n", "utf-8");
  }

  diags.sort((a, b) => a.regionId.localeCompare(b.regionId));
  const diagPath = path.join(OUT_DIR, "_diagnostic.json");
  await fs.writeFile(
    diagPath,
    JSON.stringify(
      {
        computedAt: new Date().toISOString(),
        windowDays: WINDOW_DAYS,
        regions: diags,
      },
      null,
      2,
    ) + "\n",
    "utf-8",
  );

  console.log(`\n✓ wrote ${calibs.length} calibrations + 1 diagnostic to ${OUT_DIR}`);
  const flaggedCount = diags.filter((d) => d.flagged.length > 0).length;
  if (flaggedCount > 0) {
    console.log(
      `\n⚠ ${flaggedCount}/${diags.length} regions flagged in diagnostic — see _diagnostic.json. If many are flagged with "trended residual" or "seasonal residual", consider upgrading to per-DOY calibration (ROADMAP v1.2).`,
    );
  }
  if (failed > 0) {
    console.error(`\n${failed}/${regions.length} regions failed.`);
    process.exit(1);
  }
}

runAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
