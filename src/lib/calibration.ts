/**
 * Per-region SST calibration loader.
 *
 * Loads `data/calibration/<region-id>.json` — a static JSON artifact built
 * by scripts/build-calibration.ts. Each file holds a single scalar offset
 * `Δ = mean(SST_OpenMeteo − SST_CoralTemp)` over a recent ~90-day window.
 *
 * At request time we subtract Δ from live Open-Meteo SST before comparing
 * to the CoralTemp-derived climatology, removing the cross-product mean
 * bias documented in the v1.0 footer.
 *
 * Cached in a module-level Map — restart the dev server after editing a
 * calibration JSON; HMR alone won't clear it (same gotcha as climatology).
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

export type Calibration = {
  regionId: string;
  /** °C to subtract from live Open-Meteo SST before climatology comparison */
  offset: number;
  /** number of paired non-null days used to compute the offset */
  n: number;
  /** ISO date range of the overlap window */
  window: { start: string; end: string };
  /** CoralTemp grid pixel actually used (post-snapping) */
  ctResolvedLat: number;
  ctResolvedLon: number;
  /** ISO timestamp of when the build script ran */
  computedAt: string;
};

const cache = new Map<string, Calibration | null>();

/**
 * Load calibration for a region. Returns null if the JSON is absent
 * (calibration build not yet run) or if the build script wrote `null`
 * (insufficient paired days). Callers should fall through to uncalibrated
 * SST in that case.
 */
export async function loadCalibration(
  regionId: string,
): Promise<Calibration | null> {
  if (cache.has(regionId)) return cache.get(regionId) ?? null;

  const jsonPath = path.join(
    process.cwd(),
    "data",
    "calibration",
    `${regionId}.json`,
  );

  let raw: string;
  try {
    raw = await fs.readFile(jsonPath, "utf-8");
  } catch {
    cache.set(regionId, null);
    return null;
  }

  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed.offset !== "number") {
    cache.set(regionId, null);
    return null;
  }

  cache.set(regionId, parsed as Calibration);
  return parsed as Calibration;
}
