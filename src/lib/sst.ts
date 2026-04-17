/**
 * Open-Meteo Marine API — live SST fetcher.
 *
 * Docs: https://open-meteo.com/en/docs/marine-weather-api
 *
 * Used for daily current + recent-history SST per region (no key, free,
 * CC-BY, parallel-friendly). Fetches `past_days=92` so the Hobday event
 * detector has enough history to detect multi-month events.
 *
 * The 30-year Hobday climatology comes from a *different* product — NOAA
 * CoralTemp v3.1, computed offline via scripts/build-climatology.ts.
 * CoralTemp is used by NOAA Coral Reef Watch and is scientifically valid
 * for MHW detection, but it may differ from Open-Meteo's SST by ~0.0-0.3°C
 * for the same pixel. This potential cross-product offset is documented
 * in the footer; a per-region calibration is queued for v1.1.
 */

import type { Region } from "./regions";

const BASE = "https://marine-api.open-meteo.com/v1/marine";

export type DailySst = {
  /** ISO date, YYYY-MM-DD, in Pacific/Auckland timezone */
  date: string;
  /** Daily mean SST in °C. null if the pixel has no data for that day. */
  sst: number | null;
};

export type SstSeries = {
  region: Region;
  /** lat Open-Meteo snapped to (nearest marine grid cell) */
  actualLat: number;
  actualLon: number;
  /** oldest → newest, includes today */
  daily: DailySst[];
  /** most recent non-null SST */
  latest: DailySst | null;
  fetchedAt: string;
};

type OpenMeteoResponse = {
  latitude: number;
  longitude: number;
  daily: {
    time: string[];
    sea_surface_temperature_mean: (number | null)[];
  };
};

/** Cached by Next.js for 1 hour — SST updates daily from Open-Meteo. */
export async function fetchSst(region: Region): Promise<SstSeries> {
  const params = new URLSearchParams({
    latitude: region.lat.toString(),
    longitude: region.lon.toString(),
    daily: "sea_surface_temperature_mean",
    timezone: "Pacific/Auckland",
    past_days: "92",
    forecast_days: "1",
  });
  const url = `${BASE}?${params}`;

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) {
    throw new Error(
      `Open-Meteo marine API failed for ${region.id}: ${res.status}`,
    );
  }
  const json = (await res.json()) as OpenMeteoResponse;

  const daily: DailySst[] = json.daily.time.map((date, i) => ({
    date,
    sst: json.daily.sea_surface_temperature_mean[i],
  }));

  let latest: DailySst | null = null;
  for (let i = daily.length - 1; i >= 0; i--) {
    if (daily[i].sst !== null) {
      latest = daily[i];
      break;
    }
  }

  return {
    region,
    actualLat: json.latitude,
    actualLon: json.longitude,
    daily,
    latest,
    fetchedAt: new Date().toISOString(),
  };
}

/** Fetch SST for all regions in parallel (Open-Meteo handles concurrency well). */
export async function fetchAllSst(regions: Region[]): Promise<SstSeries[]> {
  return Promise.all(regions.map(fetchSst));
}
