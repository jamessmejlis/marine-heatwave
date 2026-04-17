/**
 * Hobday climatology loader.
 *
 * Reads the Marine Heatwave Tracker CSV export per region from
 * `data/climatology/<region-id>.csv`. The tracker's CSV format is:
 *
 *   lon,lat,doy,seas,thresh,thresh_MCS
 *   174.875,-36.375,1,20.31,22.05,17.80
 *   ...
 *
 * where:
 *   - doy      = day of year (1..366, Feb 29 is doy 60)
 *   - seas     = seasonal climatology (mean SST for that DOY, 1982-2011)
 *   - thresh   = 90th-percentile MHW threshold for that DOY
 *   - thresh_MCS = 10th-percentile marine cold-spell threshold (unused here)
 *
 * The climatology is static — cached in memory after first read.
 */

import fs from "node:fs/promises";
import path from "node:path";

export type DailyClimatology = {
  /** day-of-year, 1..366 */
  doy: number;
  /** Seasonal climatological mean SST (°C) for that DOY */
  seas: number;
  /** 90th-percentile threshold (°C) for that DOY */
  thresh: number;
};

export type Climatology = {
  /** sourced lat (from CSV) */
  lat: number;
  /** sourced lon (from CSV) */
  lon: number;
  /** DOY 1..366 → daily record */
  byDoy: Map<number, DailyClimatology>;
};

const cache = new Map<string, Climatology | null>();

/**
 * Load climatology for a region. Returns null if the CSV is absent
 * (e.g. user hasn't downloaded it yet) — callers should handle gracefully.
 */
export async function loadClimatology(
  regionId: string,
): Promise<Climatology | null> {
  if (cache.has(regionId)) return cache.get(regionId) ?? null;

  const csvPath = path.join(
    process.cwd(),
    "data",
    "climatology",
    `${regionId}.csv`,
  );

  let raw: string;
  try {
    raw = await fs.readFile(csvPath, "utf-8");
  } catch {
    cache.set(regionId, null);
    return null;
  }

  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = lines[0].split(",").map((s) => s.trim());
  const idx = {
    lon: header.indexOf("lon"),
    lat: header.indexOf("lat"),
    doy: header.indexOf("doy"),
    seas: header.indexOf("seas"),
    thresh: header.indexOf("thresh"),
  };
  if (
    idx.doy < 0 ||
    idx.seas < 0 ||
    idx.thresh < 0 ||
    idx.lat < 0 ||
    idx.lon < 0
  ) {
    throw new Error(
      `Climatology CSV for ${regionId} is missing required columns. Got: ${header.join(",")}`,
    );
  }

  const byDoy = new Map<number, DailyClimatology>();
  let lat = 0;
  let lon = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const doy = Number(cols[idx.doy]);
    const seas = Number(cols[idx.seas]);
    const thresh = Number(cols[idx.thresh]);
    if (!Number.isFinite(doy) || !Number.isFinite(seas) || !Number.isFinite(thresh)) continue;
    lat = Number(cols[idx.lat]);
    lon = Number(cols[idx.lon]);
    byDoy.set(doy, { doy, seas, thresh });
  }

  const climo: Climatology = { lat, lon, byDoy };
  cache.set(regionId, climo);
  return climo;
}

/**
 * Day-of-year for an ISO date (YYYY-MM-DD), 1-indexed, handling leap years.
 * Computed in UTC to avoid TZ drift — the Open-Meteo date string is
 * already localised to Pacific/Auckland, so we just need the calendar DOY.
 */
export function dayOfYear(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  const start = Date.UTC(y, 0, 1);
  const now = Date.UTC(y, m - 1, d);
  return Math.floor((now - start) / 86_400_000) + 1;
}
