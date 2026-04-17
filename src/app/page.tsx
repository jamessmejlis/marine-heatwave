import type { Metadata } from "next";
import { regions } from "@/lib/regions";
import { fetchAllSst } from "@/lib/sst";
import { loadClimatology } from "@/lib/climatology";
import { loadCalibration } from "@/lib/calibration";
import { classifyRegion, type RegionState } from "@/lib/hobday";
import { buildHeadline } from "@/lib/headline";
import { RegionCard } from "@/components/RegionCard";

// Revalidate hourly — SST data from Open-Meteo is daily, heatwave status is
// not a minute-to-minute metric.
export const revalidate = 3600;

/**
 * Fetch live data + classify. Called by both generateMetadata and the page
 * component; Next's fetch cache and the module-level loader caches dedupe
 * so this is effectively free to call twice per render.
 */
async function getStates(): Promise<RegionState[]> {
  const [sstSeries, climos, calibrations] = await Promise.all([
    fetchAllSst(regions),
    Promise.all(regions.map((r) => loadClimatology(r.id))),
    Promise.all(regions.map((r) => loadCalibration(r.id))),
  ]);
  return sstSeries.map((sst, i) =>
    classifyRegion(sst, climos[i], calibrations[i]),
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const states = await getStates();
  const description = buildHeadline(states);
  // Next replaces nested metadata objects entirely rather than deep-merging.
  // Return full openGraph/twitter here with only the description changed so
  // locale, siteName, card type, etc. set in layout.tsx survive.
  return {
    description,
    openGraph: {
      title: "Marine Heatwave Live NZ",
      description,
      url: "/",
      siteName: "Marulho · Marine Heatwave Live NZ",
      locale: "en_NZ",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Marine Heatwave Live NZ",
      description,
    },
  };
}

export default async function Home() {
  const states = await getStates();

  // Headline computation
  const activeHeatwaves = states.filter((s) => s.activeEvent !== null);
  const longestActive = activeHeatwaves
    .slice()
    .sort((a, b) => (b.activeEvent!.duration - a.activeEvent!.duration))[0];

  const missingClimo = states.filter((s) => !s.hasClimatology);

  const latestDate = states.reduce<string | null>((acc, s) => {
    if (!s.latest) return acc;
    return !acc || s.latest.date > acc ? s.latest.date : acc;
  }, null);

  return (
    <div className="flex flex-col flex-1">
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 sm:px-8 sm:py-14">
        <header className="mb-10">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-widest text-slate-500 uppercase dark:text-slate-400">
            <span>Marulho · Marine Heatwave Live NZ</span>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-slate-50">
            Sea temperature, honestly reported.
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
            Current sea-surface temperature for 10 NZ coastal regions, compared
            to the 30-year climatological baseline and classified using the
            Hobday marine-heatwave definition.
          </p>

          {/* Headline stat */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {activeHeatwaves.length > 0 ? (
              <p className="text-lg leading-snug text-slate-800 dark:text-slate-100">
                <span className="font-semibold">
                  {activeHeatwaves.length}
                </span>{" "}
                {activeHeatwaves.length === 1 ? "region" : "regions"} currently
                in marine heatwave conditions.
                {longestActive && (
                  <>
                    {" "}Longest active event:{" "}
                    <span className="font-semibold">
                      {longestActive.activeEvent!.duration} days
                    </span>{" "}
                    in {longestActive.region.name} ({longestActive.activeEvent!.category}{" "}
                    category).
                  </>
                )}
              </p>
            ) : (
              <p className="text-lg leading-snug text-slate-800 dark:text-slate-100">
                No regions currently meet Hobday marine-heatwave criteria.
              </p>
            )}
            {latestDate && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Latest observation: {latestDate} · live SST from{" "}
                <a
                  href="https://open-meteo.com/en/docs/marine-weather-api"
                  className="underline hover:text-slate-700 dark:hover:text-slate-200"
                >
                  Open-Meteo Marine API
                </a>{" "}
                · climatology from NOAA CoralTemp (1991–2020)
              </p>
            )}
          </div>
        </header>

        <section
          aria-label="Regions"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {states.map((s) => (
            <RegionCard key={s.region.id} state={s} />
          ))}
        </section>

        {missingClimo.length > 0 && (
          <section className="mt-10 rounded-xl border border-dashed border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
            <p className="font-semibold">
              Baseline data pending for {missingClimo.length}{" "}
              {missingClimo.length === 1 ? "region" : "regions"}.
            </p>
            <p className="mt-1 text-xs">
              Drop tracker climatology CSVs in{" "}
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[11px] dark:bg-amber-900/60">
                data/climatology/&lt;region-id&gt;.csv
              </code>{" "}
              to enable classification. Missing:{" "}
              {missingClimo.map((s) => s.region.id).join(", ")}.
            </p>
          </section>
        )}

        <footer className="mt-16 border-t border-slate-200 pt-8 text-sm leading-relaxed text-slate-600 dark:border-slate-800 dark:text-slate-400">
          <h2 className="mb-2 text-xs font-semibold tracking-widest uppercase text-slate-500 dark:text-slate-400">
            Methodology & sources
          </h2>
          <p>
            <strong>Live SST:</strong> daily mean from the{" "}
            <a
              href="https://open-meteo.com/en/docs/marine-weather-api"
              className="underline hover:text-slate-900 dark:hover:text-slate-100"
            >
              Open-Meteo Marine API
            </a>{" "}
            (free, CC-BY, no API key). One grid cell per region, snapped
            to the nearest marine pixel. Refreshed hourly.
          </p>
          <p className="mt-2">
            <strong>Baseline and threshold:</strong> 30-year seasonal
            climatology (mean SST per day-of-year) and 90th-percentile
            heatwave threshold computed locally from{" "}
            <a
              href="https://coralreefwatch.noaa.gov/product/5km/index.php"
              className="underline hover:text-slate-900 dark:hover:text-slate-100"
            >
              NOAA Coral Reef Watch CoralTemp v3.1
            </a>{" "}
            daily SST (5 km, 1991–2020, WMO standard reference period),
            accessed via{" "}
            <a
              href="https://oceanwatch.pifsc.noaa.gov/erddap/griddap/CRW_sst_v3_1.html"
              className="underline hover:text-slate-900 dark:hover:text-slate-100"
            >
              PIFSC ERDDAP
            </a>
            . Parameters match the Hobday et al. (2016) reference: ±5-day
            DOY pool, 31-day moving-average smoothing. Build script at{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] dark:bg-slate-800">
              scripts/build-climatology.ts
            </code>
            .
          </p>
          <p className="mt-2">
            <strong>Cross-product calibration:</strong> live SST
            (Open-Meteo) and the climatology (CoralTemp) come from
            different products that can disagree by ~0.0–0.3 °C for
            the same pixel. A per-region scalar offset is computed
            offline from the most recent overlapping ~90-day window
            and subtracted from live SST before classification. Build
            script at{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] dark:bg-slate-800">
              scripts/build-calibration.ts
            </code>
            ; per-region offsets in{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] dark:bg-slate-800">
              data/calibration/
            </code>
            .
          </p>
          <p className="mt-2">
            <strong>Classification:</strong>{" "}
            <a
              href="https://www.marineheatwaves.org/mhw-overview.html"
              className="underline hover:text-slate-900 dark:hover:text-slate-100"
            >
              Hobday et al. (2016, 2018)
            </a>
            : a marine heatwave is ≥5 consecutive days of SST above the 90th
            percentile, with events separated by ≤2 days merged. Categories are
            multiples of the (threshold − climatology) anomaly: 1× Moderate, 2×
            Strong, 3× Severe, 4×+ Extreme.
          </p>
          <p className="mt-2">
            <strong>Cross-referenced against:</strong>{" "}
            <a
              href="https://niwa.co.nz/oceans/marine-heatwaves"
              className="underline hover:text-slate-900 dark:hover:text-slate-100"
            >
              NIWA's marine heatwave programme
            </a>
            . NIWA uses NOAA OISST v2.1 (25 km); we use CoralTemp (5 km,
            partly built on OISST). Anomaly values may differ by
            ~0.1–0.3°C from NIWA's published figures due to the
            product-resolution difference, but the Hobday methodology is
            identical and heatwave detections agree at a daily scale.
          </p>
          <p className="mt-6 text-xs text-slate-500 dark:text-slate-500">
            A Marulho experiment in turning hidden NZ data into single useful
            answers.
          </p>
        </footer>
      </main>
    </div>
  );
}
