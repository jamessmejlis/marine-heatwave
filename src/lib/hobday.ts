/**
 * Hobday marine heatwave classifier.
 *
 * Implements the Hobday et al. (2016) detection algorithm and the
 * Hobday et al. (2018) categorisation scheme, matching the defaults of
 * the canonical Python reference implementation at
 * https://github.com/ecjoliver/marineHeatWaves.
 *
 * Defaults used:
 *   - percentile threshold: 90 (applied via precomputed tracker climatology)
 *   - minimum duration:     5 consecutive days above threshold
 *   - gap merging:          runs separated by ≤2 days are one event
 *   - category at peak:     floor(1 + (SST-seas)/(thresh-seas)), capped at 4
 *       1 Moderate · 2 Strong · 3 Severe · 4 Extreme
 *
 * The climatology (seasonal mean + 90th-pct threshold, 366 DOY values
 * pre-smoothed with the ±5-day window + 31-day moving average) is
 * loaded from marineheatwaves.org tracker exports — see climatology.ts.
 */

import type { Region } from "./regions";
import type { Climatology } from "./climatology";
import { dayOfYear } from "./climatology";
import type { DailySst, SstSeries } from "./sst";

export const CATEGORIES = ["Moderate", "Strong", "Severe", "Extreme"] as const;
export type Category = (typeof CATEGORIES)[number];

export type DayAssessment = {
  date: string;
  doy: number;
  sst: number | null;
  seas: number | null;
  thresh: number | null;
  /** sst − seas */
  anomaly: number | null;
  /** (sst − seas) / (thresh − seas). >1 means above threshold. */
  relThreshNorm: number | null;
  aboveThreshold: boolean;
};

export type MhwEvent = {
  startIdx: number;
  endIdx: number;
  /** index of the peak (max anomaly) day within the event */
  peakIdx: number;
  /** event duration in days (inclusive) */
  duration: number;
  /** SST anomaly at peak (°C) */
  peakAnomaly: number;
  /** Category at peak (Hobday 2018) */
  category: Category;
  /** start/end ISO dates */
  startDate: string;
  endDate: string;
  /** peak ISO date */
  peakDate: string;
};

export type RegionState = {
  region: Region;
  /** true when we have climatology data loaded for this region */
  hasClimatology: boolean;
  /** per-day assessments for the full fetched window */
  series: DayAssessment[];
  /** latest day with a non-null SST (may be today or up to a few days back) */
  latest: DayAssessment | null;
  /** the active event, if the latest day is inside a qualifying event */
  activeEvent: MhwEvent | null;
  /** plain-English current status (used for UI headline) */
  summary: string;
  /** Open-Meteo snapping info — useful to show provenance */
  actualLat: number;
  actualLon: number;
  fetchedAt: string;
};

const MIN_DURATION = 5;
const MAX_GAP = 2;

/**
 * Build per-day assessments by joining live SST with climatology on DOY.
 */
function buildSeries(
  daily: DailySst[],
  climo: Climatology | null,
): DayAssessment[] {
  return daily.map((d) => {
    const doy = dayOfYear(d.date);
    const c = climo?.byDoy.get(doy) ?? null;
    if (d.sst === null || c === null) {
      return {
        date: d.date,
        doy,
        sst: d.sst,
        seas: c?.seas ?? null,
        thresh: c?.thresh ?? null,
        anomaly: d.sst !== null && c ? d.sst - c.seas : null,
        relThreshNorm:
          d.sst !== null && c && c.thresh !== c.seas
            ? (d.sst - c.seas) / (c.thresh - c.seas)
            : null,
        aboveThreshold: false,
      };
    }
    const anomaly = d.sst - c.seas;
    const denom = c.thresh - c.seas;
    return {
      date: d.date,
      doy,
      sst: d.sst,
      seas: c.seas,
      thresh: c.thresh,
      anomaly,
      relThreshNorm: denom !== 0 ? anomaly / denom : null,
      aboveThreshold: d.sst > c.thresh,
    };
  });
}

/**
 * Detect all events in a series: runs of ≥MIN_DURATION consecutive days
 * above threshold, merging runs separated by ≤MAX_GAP sub-threshold days.
 *
 * Null-SST days are treated as below threshold (conservative).
 */
function detectEvents(series: DayAssessment[]): MhwEvent[] {
  if (series.length === 0) return [];

  // Collect contiguous above-threshold runs as [start, end] inclusive index pairs.
  const runs: [number, number][] = [];
  let runStart = -1;
  for (let i = 0; i < series.length; i++) {
    if (series[i].aboveThreshold) {
      if (runStart === -1) runStart = i;
    } else {
      if (runStart !== -1) {
        runs.push([runStart, i - 1]);
        runStart = -1;
      }
    }
  }
  if (runStart !== -1) runs.push([runStart, series.length - 1]);

  // Merge runs separated by ≤MAX_GAP days of non-event.
  const merged: [number, number][] = [];
  for (const run of runs) {
    const last = merged[merged.length - 1];
    if (last && run[0] - last[1] - 1 <= MAX_GAP) {
      last[1] = run[1];
    } else {
      merged.push([run[0], run[1]]);
    }
  }

  // Filter by minimum duration and build event objects.
  const events: MhwEvent[] = [];
  for (const [start, end] of merged) {
    const duration = end - start + 1;
    if (duration < MIN_DURATION) continue;

    // Peak = max anomaly within [start, end], ignoring null anomaly days.
    let peakIdx = start;
    let peakAnom = -Infinity;
    for (let i = start; i <= end; i++) {
      const a = series[i].anomaly;
      if (a !== null && a > peakAnom) {
        peakAnom = a;
        peakIdx = i;
      }
    }
    const rtn = series[peakIdx].relThreshNorm;
    const catIdx = rtn !== null ? Math.min(Math.max(Math.floor(1 + rtn), 1), 4) : 1;
    events.push({
      startIdx: start,
      endIdx: end,
      peakIdx,
      duration,
      peakAnomaly: peakAnom === -Infinity ? 0 : peakAnom,
      category: CATEGORIES[catIdx - 1],
      startDate: series[start].date,
      endDate: series[end].date,
      peakDate: series[peakIdx].date,
    });
  }
  return events;
}

/**
 * Build region state: combine SST, climatology, and event detection into
 * a single object the UI can render.
 */
export function classifyRegion(
  sst: SstSeries,
  climo: Climatology | null,
): RegionState {
  const series = buildSeries(sst.daily, climo);

  // Latest non-null SST day
  let latest: DayAssessment | null = null;
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i].sst !== null) {
      latest = series[i];
      break;
    }
  }

  const events = climo ? detectEvents(series) : [];

  // Active event = one that contains the latest day (or extends to last index
  // allowing ≤MAX_GAP of sub-threshold days at the tail — conservative: require
  // that the latest day itself is within the event range).
  let activeEvent: MhwEvent | null = null;
  if (latest && events.length > 0) {
    const latestIdx = series.findIndex((d) => d.date === latest!.date);
    for (const e of events) {
      if (latestIdx >= e.startIdx && latestIdx <= e.endIdx) {
        activeEvent = e;
        break;
      }
    }
  }

  const summary = buildSummary({
    region: sst.region,
    hasClimatology: climo !== null,
    latest,
    activeEvent,
  });

  return {
    region: sst.region,
    hasClimatology: climo !== null,
    series,
    latest,
    activeEvent,
    summary,
    actualLat: sst.actualLat,
    actualLon: sst.actualLon,
    fetchedAt: sst.fetchedAt,
  };
}

function buildSummary(opts: {
  region: Region;
  hasClimatology: boolean;
  latest: DayAssessment | null;
  activeEvent: MhwEvent | null;
}): string {
  const { region, hasClimatology, latest, activeEvent } = opts;
  if (!latest || latest.sst === null) return `${region.name}: no SST observation available`;
  if (!hasClimatology) {
    return `${region.name}: ${latest.sst.toFixed(1)}°C — baseline not yet loaded`;
  }
  const anomalySign = latest.anomaly! >= 0 ? "above" : "below";
  const anomalyMag = Math.abs(latest.anomaly!).toFixed(1);
  const base = `${region.name}: ${latest.sst.toFixed(1)}°C — ${anomalyMag}°C ${anomalySign} average`;
  if (activeEvent) {
    return `${base}. ${activeEvent.duration}th day of marine heatwave (${activeEvent.category} category).`;
  }
  if (latest.aboveThreshold) {
    return `${base}. Above 90th-percentile threshold but not yet ≥5 consecutive days.`;
  }
  return `${base}. No active marine heatwave.`;
}
