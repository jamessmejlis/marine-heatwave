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
          <div className="flex items-center justify-between gap-4 font-mono text-[10px] font-medium tracking-[0.14em] text-marulho uppercase sm:text-xs sm:tracking-[0.2em]">
            <span>Marine Heatwave Live NZ</span>
            <a
              href="https://marulho.co"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink/60 transition-colors hover:text-marulho dark:text-slate-400"
            >
              Built by Marulho
            </a>
          </div>
          <h1 className="font-serif mt-4 text-4xl leading-[1.02] tracking-tight text-ink sm:text-[56px]">
            How warm is the sea today?
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
            A live dashboard tracking sea surface temperature (SST), 30-year
            anomaly, and marine-heatwave status across {regions.length} NZ
            coastal regions — updated daily.
          </p>

          <section
            aria-labelledby="explainer-heading"
            className="mt-6 max-w-2xl"
          >
            <h2
              id="explainer-heading"
              className="font-mono text-xs font-medium tracking-[0.2em] text-marulho uppercase"
            >
              What's a marine heatwave?
            </h2>
            <p className="mt-2 text-base leading-relaxed text-slate-600 dark:text-slate-300">
              Sea temperature in the warmest 10% of the 30-year record for at
              least 5 consecutive days. Slower and larger than a land heatwave,
              often invisible from shore — but linked to kelp forest die-off,
              mass marine mortality, and disrupted fisheries.
            </p>
          </section>

          {/* Headline stat — editorial treatment, dashed rule echoes the
              sparkline reference lines (visual through-line). */}
          <div
            className="mt-8 border-t border-dashed border-marulho/40 pt-6"
            aria-hidden="true"
          />
          <div>
            {activeHeatwaves.length > 0 ? (
              <p className="font-serif text-2xl leading-snug text-ink sm:text-[28px]">
                <span className="font-semibold text-marulho tabular-nums">
                  {activeHeatwaves.length}
                </span>{" "}
                {activeHeatwaves.length === 1 ? "region" : "regions"} currently
                in marine heatwave conditions.
                {longestActive && (
                  <>
                    {" "}Longest active event:{" "}
                    <span className="font-semibold text-marulho tabular-nums">
                      {longestActive.activeEvent!.duration} days
                    </span>{" "}
                    in{" "}
                    <span className="underline decoration-marulho decoration-2 underline-offset-4">
                      {longestActive.region.name}
                    </span>{" "}
                    ({longestActive.activeEvent!.category} category).
                  </>
                )}
              </p>
            ) : (
              <p className="font-serif text-2xl leading-snug text-ink sm:text-[28px]">
                No regions currently meet Hobday marine-heatwave criteria.
              </p>
            )}
            {latestDate && (
              <p className="mt-3 font-mono text-xs tracking-wide text-ink/60">
                Latest observation:{" "}
                <span className="text-ink/80">{latestDate}</span> — live sea
                temperature from{" "}
                <a
                  href="https://open-meteo.com/en/docs/marine-weather-api"
                  className="text-marulho underline decoration-marulho/40 underline-offset-2 hover:decoration-marulho"
                >
                  Open-Meteo Marine API
                </a>{" "}
                — 30-year average from NOAA CoralTemp (1991–2020)
              </p>
            )}
          </div>
        </header>

        <section
          aria-label="Regions"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
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

        <section
          aria-labelledby="about-mhw-heading"
          className="mt-16 max-w-2xl"
        >
          <h2
            id="about-mhw-heading"
            className="font-mono text-xs font-medium tracking-[0.2em] text-marulho uppercase"
          >
            About marine heatwaves
          </h2>
          <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-slate-300">
            Past NZ events have stretched thousands of kilometres across the
            Tasman Sea. Documented impacts{" "}
            <a
              href="https://rsnz.onlinelibrary.wiley.com/doi/10.1080/00288330.2024.2436661"
              className="text-marulho underline decoration-marulho/40 underline-offset-2 hover:decoration-marulho"
            >
              around Aotearoa
            </a>{" "}
            and elsewhere include kelp forest die-off, mass mortality in
            marine life, lower dissolved oxygen, ocean acidification, disrupted
            fisheries and aquaculture, and shifts in where species can
            survive — sometimes compounding with land heatwaves and other
            climate extremes.
          </p>
          <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-slate-300">
            This page reports the data so anyone can see when local conditions
            cross into heatwave territory. Interpretation of what it means for
            any specific ecosystem belongs with marine biologists, not us.
          </p>
        </section>

        <footer className="mt-16 border-t border-dashed border-marulho/30 pt-10 text-ink/70">
          <div className="max-w-2xl">
            <section
              id="methodology"
              aria-labelledby="methodology-heading"
              className="scroll-mt-8"
            >
              <h2
                id="methodology-heading"
                className="font-mono text-xs font-medium tracking-[0.2em] text-marulho uppercase"
              >
                Methodology
              </h2>
              <p className="mt-3 text-sm leading-relaxed">
                <strong>Detection —</strong>{" "}
                <a
                  href="https://www.marineheatwaves.org/mhw-overview.html"
                  className="text-marulho underline decoration-marulho/40 underline-offset-2 hover:decoration-marulho"
                >
                  Hobday et al. (2016)
                </a>
                : a marine heatwave is ≥5 consecutive days when SST exceeds the
                90th percentile of the 30-year local day-of-year baseline.
                Events separated by ≤2 days merge into a single event.
              </p>
              <p className="mt-2 text-sm leading-relaxed">
                <strong>Classification —</strong> Hobday et al. (2018): category
                is the daily anomaly expressed as a multiple of the (threshold
                − climatology) gap,{" "}
                <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] dark:bg-slate-800">
                  floor(1 + (SST − seas) / (thresh − seas))
                </code>
                , capped at 4: Moderate (1×), Strong (2×), Severe (3×), Extreme
                (4×+).
              </p>
              <p className="mt-2 text-sm leading-relaxed">
                Implementation parameters match the{" "}
                <a
                  href="https://github.com/ecjoliver/marineHeatWaves"
                  className="text-marulho underline decoration-marulho/40 underline-offset-2 hover:decoration-marulho"
                >
                  ecjoliver/marineHeatWaves
                </a>{" "}
                reference defaults: ±5-day DOY pool, 31-day moving-average
                smoothing on both climatology and threshold, minimum duration 5
                days, maximum gap 2 days.
              </p>
            </section>

            <div
              className="mt-10 border-t border-dashed border-marulho/20 pt-10"
              aria-hidden="true"
            />

            <section
              id="sources"
              aria-labelledby="sources-heading"
              className="scroll-mt-8"
            >
              <h2
                id="sources-heading"
                className="font-mono text-xs font-medium tracking-[0.2em] text-marulho uppercase"
              >
                Sources
              </h2>
              <p className="mt-3 text-sm leading-relaxed">
                <strong>Live SST —</strong> daily mean from the{" "}
                <a
                  href="https://open-meteo.com/en/docs/marine-weather-api"
                  className="text-marulho underline decoration-marulho/40 underline-offset-2 hover:decoration-marulho"
                >
                  Open-Meteo Marine API
                </a>{" "}
                (free, CC-BY, no API key). One grid cell per region, snapped to
                the nearest marine pixel. Refreshed hourly.
              </p>
              <p className="mt-2 text-sm leading-relaxed">
                <strong>Baseline + threshold —</strong> 30-year seasonal
                climatology and 90th-percentile threshold computed locally from{" "}
                <a
                  href="https://coralreefwatch.noaa.gov/product/5km/index.php"
                  className="text-marulho underline decoration-marulho/40 underline-offset-2 hover:decoration-marulho"
                >
                  NOAA Coral Reef Watch CoralTemp v3.1
                </a>{" "}
                daily SST (5 km, 1991–2020), accessed via{" "}
                <a
                  href="https://oceanwatch.pifsc.noaa.gov/erddap/griddap/CRW_sst_v3_1.html"
                  className="text-marulho underline decoration-marulho/40 underline-offset-2 hover:decoration-marulho"
                >
                  PIFSC ERDDAP
                </a>
                . Build script at{" "}
                <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] dark:bg-slate-800">
                  scripts/build-climatology.ts
                </code>
                .
              </p>
              <p className="mt-2 text-sm leading-relaxed">
                <strong>Region selection —</strong> the five aquaculture-region
                pixels (Coromandel, Bay of Plenty / Ōpōtiki, Marlborough Sounds /
                Pelorus, Golden Bay, Foveaux Strait) use the lat/lon points
                published in{" "}
                <a
                  href="https://doi.org/10.3389/fmars.2025.1607806"
                  className="text-marulho underline decoration-marulho/40 underline-offset-2 hover:decoration-marulho"
                >
                  Fauchereau et al. (2025)
                </a>
                , the multi-model SST forecast paper that underpins NIWA's
                monthly outlook — snapped to the nearest CoralTemp 5 km sea
                pixel where Fauchereau's exact point sits on land (Fauchereau
                used OISST at 25 km, where coastal points fall inside larger
                sea pixels). The remaining seven regions are picked for
                plausible offshore pixels representative of broad public place
                names.
              </p>
              <p className="mt-2 text-sm leading-relaxed">
                <strong>Cross-product calibration —</strong> live SST
                (Open-Meteo) and the climatology (CoralTemp) come from different
                products that can disagree by ~0.0–0.3 °C for the same pixel. A
                per-region scalar offset is computed offline from the most
                recent overlapping ~90-day window and subtracted from live SST
                before classification. Build script at{" "}
                <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] dark:bg-slate-800">
                  scripts/build-calibration.ts
                </code>
                ; per-region offsets in{" "}
                <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] dark:bg-slate-800">
                  data/calibration/
                </code>
                .
              </p>
            </section>

            <div
              className="mt-10 border-t border-dashed border-marulho/20 pt-10"
              aria-hidden="true"
            />

            <section
              id="choices"
              aria-labelledby="choices-heading"
              className="scroll-mt-8"
            >
              <h2
                id="choices-heading"
                className="font-mono text-xs font-medium tracking-[0.2em] text-marulho uppercase"
              >
                Design choices
              </h2>
              <p className="mt-3 text-sm leading-relaxed">
                <strong>Why CoralTemp for the baseline?</strong> We needed a
                consistent 30-year daily SST record with clean programmatic
                access. CoralTemp via PIFSC ERDDAP covers 1985–present at 5 km,
                reliably. NIWA uses NOAA OISST v2.1 (25 km) for their own
                heatwave tracker — a strong first choice, but the CoastWatch and
                PolarWatch ERDDAP endpoints that serve it timed out consistently
                from our infrastructure. Revisiting via the NOAA AWS S3 mirror
                is on the roadmap; if it works we'd retire the calibration step
                entirely.
              </p>
              <p className="mt-2 text-sm leading-relaxed">
                <strong>Why the 1991–2020 baseline?</strong> It's the current{" "}
                <a
                  href="https://community.wmo.int/en/wmo-standard-climatological-normals"
                  className="text-marulho underline decoration-marulho/40 underline-offset-2 hover:decoration-marulho"
                >
                  WMO standard reference period
                </a>
                . Older baselines (1961–1990, 1971–2000) would reclassify some
                of today's "Moderate" events as "Strong" because they normalise
                less recent warming — both are valid framings, and published
                marine-heatwave literature debates fixed vs detrended baselines.
                A baseline-period toggle is queued for v2.
              </p>
              <p className="mt-2 text-sm leading-relaxed">
                <strong>Why single grid cells, not regional averages?</strong>{" "}
                Each region is one 5-km pixel — simple, reproducible, easy to
                audit. The five aquaculture pixels follow Fauchereau et al.
                (2025) so anomalies are directly comparable to the published
                NIWA-aligned forecast paper; the remaining seven are picked for
                plausible offshore locations representative of the public place
                name. For oceanographically mixed regions (Foveaux Strait) a
                single pixel can be non-representative; a 3×3 sea-weighted
                average is a candidate refinement.
              </p>
            </section>

            <div
              className="mt-10 border-t border-dashed border-marulho/20 pt-10"
              aria-hidden="true"
            />

            <section
              id="limitations"
              aria-labelledby="limitations-heading"
              className="scroll-mt-8"
            >
              <h2
                id="limitations-heading"
                className="font-mono text-xs font-medium tracking-[0.2em] text-marulho uppercase"
              >
                Limitations
              </h2>
              <p className="mt-3 text-sm leading-relaxed">
                <strong>Resolution mismatch vs NIWA —</strong>{" "}
                <a
                  href="https://niwa.co.nz/oceans/marine-heatwaves"
                  className="text-marulho underline decoration-marulho/40 underline-offset-2 hover:decoration-marulho"
                >
                  NIWA's marine heatwave programme
                </a>{" "}
                uses NOAA OISST v2.1 at 25 km; we use CoralTemp at 5 km (itself
                built partly on OISST). The Hobday methodology is identical and
                heatwave detections should agree at a daily scale, but precise
                anomaly numbers may drift from NIWA's published figures by
                roughly 0.1–0.3 °C.
              </p>
              <p className="mt-2 text-sm leading-relaxed">
                <strong>Pixel representativeness —</strong> a single 5-km cell
                is a good proxy for a broad coastal region most of the time, but
                a poor proxy during strong upwelling, frontal movement, or
                narrow-channel effects. Treat the number as "the sea near here",
                not "the sea exactly here".
              </p>
              <p className="mt-2 text-sm leading-relaxed">
                <strong>Calibration stationarity —</strong> the Open-Meteo ↔
                CoralTemp offset is applied as a single scalar per region,
                assuming the two products drift in parallel across the year.
                Diagnostics show non-trivial seasonal residuals (&gt;0.4 °C range
                for all 12 regions), so a per-day-of-year calibration is queued
                for v1.2. Today's classification is robust to this; borderline
                events in shoulder seasons may flip category as the refinement
                lands.
              </p>
              <p className="mt-2 text-sm leading-relaxed">
                <strong>Surface only —</strong> SST is a skin temperature. It
                tells you nothing direct about conditions at depth, where much
                marine life actually lives. Subsurface observations from the{" "}
                <a
                  href="https://www.moanaproject.org/"
                  className="text-marulho underline decoration-marulho/40 underline-offset-2 hover:decoration-marulho"
                >
                  Moana Project
                </a>{" "}
                may join a future version.
              </p>
            </section>

            <div
              className="mt-10 border-t border-dashed border-marulho/20 pt-10"
              aria-hidden="true"
            />

            <section
              id="acknowledgements"
              aria-labelledby="acknowledgements-heading"
              className="scroll-mt-8"
            >
              <h2
                id="acknowledgements-heading"
                className="font-mono text-xs font-medium tracking-[0.2em] text-marulho uppercase"
              >
                Acknowledgements
              </h2>
              <p className="mt-3 text-sm leading-relaxed">
                The Hobday detection and classification framework is the work of{" "}
                <a
                  href="https://doi.org/10.1016/j.pocean.2015.12.014"
                  className="text-marulho underline decoration-marulho/40 underline-offset-2 hover:decoration-marulho"
                >
                  Alistair Hobday and colleagues (2016, 2018)
                </a>
                . The reference Python implementation and tracker site are
                maintained by{" "}
                <a
                  href="https://github.com/ecjoliver/marineHeatWaves"
                  className="text-marulho underline decoration-marulho/40 underline-offset-2 hover:decoration-marulho"
                >
                  Eric C. J. Oliver
                </a>{" "}
                and{" "}
                <a
                  href="https://www.marineheatwaves.org/"
                  className="text-marulho underline decoration-marulho/40 underline-offset-2 hover:decoration-marulho"
                >
                  Robert Schlegel
                </a>{" "}
                — our defaults follow theirs.
              </p>
              <p className="mt-2 text-sm leading-relaxed">
                Region pixels for the five aquaculture areas (Coromandel, Bay of
                Plenty, Marlborough Sounds, Golden Bay, Foveaux Strait) follow{" "}
                <a
                  href="https://doi.org/10.3389/fmars.2025.1607806"
                  className="text-marulho underline decoration-marulho/40 underline-offset-2 hover:decoration-marulho"
                >
                  Fauchereau et al. (2025)
                </a>
                , whose multi-model SST forecast underpins NIWA's monthly outlook.
              </p>
              <p className="mt-2 text-sm leading-relaxed">
                Data comes from{" "}
                <a
                  href="https://coralreefwatch.noaa.gov/"
                  className="text-marulho underline decoration-marulho/40 underline-offset-2 hover:decoration-marulho"
                >
                  NOAA Coral Reef Watch
                </a>{" "}
                (CoralTemp v3.1),{" "}
                <a
                  href="https://oceanwatch.pifsc.noaa.gov/erddap/griddap/CRW_sst_v3_1.html"
                  className="text-marulho underline decoration-marulho/40 underline-offset-2 hover:decoration-marulho"
                >
                  NOAA PIFSC OceanWatch ERDDAP
                </a>
                , and{" "}
                <a
                  href="https://open-meteo.com/"
                  className="text-marulho underline decoration-marulho/40 underline-offset-2 hover:decoration-marulho"
                >
                  Open-Meteo
                </a>
                . Cross-referenced against{" "}
                <a
                  href="https://niwa.co.nz/oceans/marine-heatwaves"
                  className="text-marulho underline decoration-marulho/40 underline-offset-2 hover:decoration-marulho"
                >
                  NIWA
                </a>{" "}
                — the authoritative voice on NZ marine heatwaves. This page is
                not affiliated with any of them.
              </p>
            </section>

            <p className="mt-12 font-mono text-xs tracking-wide text-ink/50">
              A{" "}
              <a
                href="https://marulho.co"
                target="_blank"
                rel="noopener noreferrer"
                className="text-marulho underline decoration-marulho/40 underline-offset-2 hover:decoration-marulho"
              >
                Marulho
              </a>{" "}
              experiment in turning hidden data into useful insights.
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
