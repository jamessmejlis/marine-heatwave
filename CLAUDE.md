# CLAUDE.md — Marine Heatwave Live NZ

**Full strategic brief:** `~/Developer/open-data/nz-marine-project-ideas.md` § Marine Heatwave Live NZ

## The brief

A one-page dashboard showing sea surface temperature vs 30-year baseline for ~10 NZ coastal regions, with Hobday marine heatwave classification. The FuelClock-for-the-ocean shape: one colour-coded number per region, one headline stat, plain-English framing.

**Example output:** *"Hauraki Gulf: 21.4°C — 2.8°C above average. 18th day of marine heatwave (Strong category). Kelp thermal-stress threshold exceeded."*

**One-line headline:** *"X regions currently in marine heatwave conditions. Longest active event: Y days, Z region, Strong category."*

## Why this project

- Part of the Marulho marine constellation (see `~/Developer/open-data/nz-marine-project-ideas.md` for full context)
- First ship of the marine track — smallest technical surface, strongest virality cadence
- Pipeline feeds downstream projects (Kelp Watch thermal overlay, Underwater Visibility SST input) — "build once, use thrice"
- 1-day prototype target

## Data sources

**Primary (v1):**

| Source | Purpose | Access |
|---|---|---|
| [Open-Meteo Marine API](https://open-meteo.com/en/docs/marine-weather-api) | Current SST per region | Free, CC-BY, no key |
| [NOAA Coral Reef Watch](https://coralreefwatch.noaa.gov/) | Marine heatwave classification methodology (Hobday et al. 2016) | Free reference |
| NOAA OISST | 30+ year daily SST baseline | Free |

**Authoritative NZ (v2 upgrade path):**

| Source | Purpose | Access |
|---|---|---|
| [NIWA Moana Backbone](https://marinedata.niwa.co.nz/) | Authoritative NZ SST products | Portal |
| [Moana Project](https://www.moanaproject.org/) | NZ-scale SST observations, 1M+ measurements/month from EEZ sensor network | Open-access |
| NIWA-SCENZ Satellite Maps | GIS image service of satellite water quality products, timeseries from July 2002 | ArcGIS portal (via NEDC) |
| NIWA Climatology gridded data | Long-term climate parameter averages — NZ-specific baseline alternative to NOAA OISST | External gridded products (via NEDC) |
| NIWA Climate station normals | 30-year climate statistics | External data products (via NEDC) |
| NIWA Geospatial Data Platform | ArcGIS open data, multi-category | Open data portal (via NEDC) |

**Data discovery:**

- [NEDC — National Environmental Data Centre](https://nedc.nz) — meta-directory of environmental data from 7 NZ CRIs. Use `/categories/ocean/` and `/categories/climate/` for sibling-dataset discovery.
- [Earth Sciences New Zealand](https://earthsciences.nz) — umbrella org (NIWA + GNS Science merged 1 July 2025). Data still lives on the founding orgs' sites.

**Related overlays (post-v1):**

| Source | Purpose |
|---|---|
| Ocean Acidification Network (NZOA-ON) | Second overlay showing cumulative ocean stress |
| NIWA Coastal Cameras | Qualitative real-time context for highlighted regions |
| Reef Life Survey kelp abundance | Cross-reference SST anomaly against ecological impact |

## NZ coastal regions (current list — 12)

Twelve regions covering the full NZ coastline. Public-facing labels are broad, well-known place names. Where the region overlaps with one of Fauchereau et al. 2025's five aquaculture regions, the **measurement point** is the aquaculture site — scientifically meaningful, closest to where MHW impact lives — while the **public label** stays recognisable.

**Coordinate provenance:** the five aquaculture pixels (Coromandel, Bay of Plenty/Ōpōtiki, Marlborough Sounds/Pelorus, Golden Bay, Foveaux Strait) use the lat/lon points published in Fauchereau et al. 2025's [`SST_obs_correlations.ipynb`](https://github.com/nicolasfauchereau/SST_forecasting/blob/main/notebooks/SST_obs_correlations.ipynb) (Foveaux not in their notebook — kept our existing pixel). Fauchereau used OISST 0.25° (~25 km), so coastal points fall inside larger sea pixels; on CoralTemp 5 km some of those exact points sit on land and need a small offshore nudge (Bay of Plenty: nudged from −38.0123, 177.2871 to −37.975, 177.275 to clear the Ōpōtiki shoreline). Other seven regions are picked offshore-pragmatic.

| # | Public label | Measurement point / notes |
|---|---|---|
| 1 | Northland | Northland coast |
| 2 | Hauraki Gulf | Hauraki Gulf. Long-record reference: **Leigh station** (1953→) |
| 3 | Coromandel | Coromandel (aquaculture region, paper) |
| 4 | Bay of Plenty | **Ōpōtiki coast** (aquaculture region, paper) |
| 5 | East Cape | East Cape |
| 6 | Hawke's Bay / Wairarapa | Hawke's Bay / Wairarapa |
| 7 | Marlborough Sounds | **Pelorus Sound** (aquaculture region, paper) |
| 8 | Golden Bay | Golden Bay (aquaculture region, paper — harder to forecast per paper due to riverine influence) |
| 9 | Kaikōura / East Coast South | Kaikōura coast |
| 10 | Otago | Otago coast. Long-record reference: **Portobello station** (1953→) |
| 11 | Fiordland | Fiordland |
| 12 | Foveaux Strait | Foveaux Strait (aquaculture region, paper) |

**On the dashboard:** show the public label prominently. Measurement-point detail (e.g. "measured at Ōpōtiki coast, Bay of Plenty") lives in the per-region methodology footer or tooltip.

**Long-record stations (Leigh, Portobello):** surfaced as historical context on their parent region pages, not as separate map tiles. Example treatment: *"SST here today: X°C. Long-term station average at Leigh for this date: Y°C."*

**Prioritisation if 12 proves too dense:** the 5 aquaculture regions (3, 4, 7, 8, 12) + Hauraki Gulf + Fiordland = a defensible 7-region MVP covering scientific rigour + population reach + news-memory salience.

### Roadmap history

- **v0 (initial spec)** — 10 arbitrary coastline regions. Pre-research, before Fauchereau et al. 2025 was surfaced.
- **v0.5** — expanded to 15 after merging Fauchereau's 5 aquaculture regions + Leigh/Portobello as separate entries. Too many overlaps.
- **v1 (current, 12 regions)** — overlaps resolved by using broader public labels with aquaculture sites as measurement points. Leigh/Portobello demoted to reference-station annotations on their parent regions. Tasman dropped as redundant with Golden Bay and Marlborough Sounds neighbours. Cook Strait replaced by Marlborough Sounds (more meaningful coastal label for consumer dashboard).

## Marine heatwave classification

**Definition (Hobday et al. 2016):**
- MHW = daily SST above the 90th percentile of the 30-year baseline for **≥5 consecutive days**
- Category by multiplier of the (90th percentile − climatology) anomaly:
  - **Moderate** — 1–2×
  - **Strong** — 2–3×
  - **Severe** — 3–4×
  - **Extreme** — 4×+

**Baseline:** NOAA OISST v2.1 at 0.25°, 30-year climatology window — likely 1991–2020 (align with NIWA/Fauchereau convention where reasonable). Document the exact window visibly on the methodology page.

**Note on monthly definition:** Fauchereau et al. 2025 uses a monthly-averaged variant because their forecast models output monthly data. For observational daily data, we use the standard daily Hobday definition.

## Scope discipline: we show actuals, not forecasts

**This is an observational dashboard. Live + recent historical SST and anomaly, not a forecast.**

The distinction matters:
- **NIWA's SST Update** is a monthly *forecast* product (rolling 6-month outlook using a 10-model ensemble). Their gap is not UX — they have a forecast product.
- **Our gap is different:** nobody publishes a live consumer-facing view of *what the NZ ocean is actually doing right now and over the last 30 days*. That's the wedge.
- **Positioning:** complementary to NIWA, not competitive. Link to their forecast prominently: *"Here's what the sea is doing now. Here's what NIWA expects next month →"*

Forecasts are a v2+ consideration. If we ever add them, we'd use NIWA's published outlook by scraping/linking, not by running our own ensemble — that's their job, not ours.

## Framing discipline

- **Defer to the science, don't invent it.** MHW classification follows Hobday et al. 2016 (daily threshold, 5-day persistence) applied to observations. Cite Fauchereau et al. 2025 for the NZ-specific monthly definition variant and for the aquaculture-region selection rationale.
- Report data; don't editorialise. "SST 2.8°C above average" is a fact. "Disaster unfolding" is a claim.
- Ecological interpretation needs context — partner with a marine biologist before stating what a heatwave "means" for species. V1 stays in the observation lane.
- Be transparent about SST source, resolution, and climatology window per region. Confidence intervals on baselines.
- Credit prominently: *"Data: NOAA OISST v2.1, Open-Meteo Marine. MHW methodology: Hobday et al. 2016. NZ region selection: Fauchereau et al. 2025 (NIWA / Earth Sciences NZ). For forecast outlook, see NIWA's SST Update →"*
- Footer: *"A Marulho experiment in turning hidden NZ data into single useful answers."* Constellation link to sibling projects as they ship.

## Key references

- **Fauchereau et al. 2025** — *Multi-model ensemble forecasts of sea surface temperatures and marine heatwaves for Aotearoa New Zealand*, Frontiers in Marine Science. [DOI](https://doi.org/10.3389/fmars.2025.1607806). Peer-reviewed NZ MHW methodology. Open code: [github.com/nicolasfauchereau/SST_forecasting](https://github.com/nicolasfauchereau/SST_forecasting) (check licence before reuse).
- **NIWA SST Update (Earth Sciences NZ)** — [monthly forecast service](https://niwa.co.nz/climate-and-weather/sea-surface-temperature-update). 10-model ensemble, rolling 6-month horizon, static web reports. **The UX gap this project fills.**
- **Hobday et al. 2016** — foundational paper defining the daily MHW categorisation (Moderate/Strong/Severe/Extreme).

## Stack (default — adjust to taste)

- Next.js + TypeScript + Tailwind
- Bun (`bun install`, `bun run dev`)
- Deploy on Vercel under a Marulho subdomain
- SST fetch runs server-side, cached aggressively (heatwave status doesn't change minute-to-minute)

## Out of scope for v1

- Historical time slider (nice-to-have v2)
- Downloadable timeseries (v2)
- Email alerts (v2)
- Embeddable widgets for news sites (post-launch)
- Commercial tiers — this is portfolio-first, see catalogue

## Success criteria

- Page loads in under 1s with current SST + anomaly + category per region
- Honest, screenshot-able on mobile
- Correct Hobday classification cross-checked against at least one published NIWA heatwave alert
- Survives the next heat spike as a linkable artifact

## Working in this repo

**Dev:** `bun run dev` · `bun run build` · `bun run build-climatology` (only when regions or reference period change — takes 35–60 min, pass `--force` to rebuild existing CSVs) · `bun run build-calibration` (re-run any time to refresh cross-product offsets — takes ~1–2 min, always overwrites)

**Architecture:** `src/lib/` data layer · `src/app/` routes · `src/components/` UI · `scripts/` offline tools · `data/climatology/*.csv` pre-built Hobday baselines · `data/calibration/*.json` per-region Open-Meteo↔CoralTemp scalar offsets (both committed artifacts, don't regenerate casually). Server components throughout; 1h ISR via `export const revalidate = 3600`.

**Plan tracking:** [`ROADMAP.md`](ROADMAP.md) is the single source of truth — update its changelog when shipping.

**TypeScript:** no `esModuleInterop` — use `import * as fs from "node:fs/promises"`, never `import fs from ...`.

**Design tokens:** `text-ink` / `bg-paper` / `text-marulho` / `text-marulho-soft` (NOT `text-slate-*`). Fonts: `font-serif` (Fraunces, display) · `font-sans` (IBM Plex Sans, default body) · `font-mono` (IBM Plex Mono, labels + tabular numbers). Visual register matches editorial framing: restrained, no playful chrome, no gradients, no animations.

**Headline sentence:** [`src/lib/headline.ts`](src/lib/headline.ts) `buildHeadline()` is the single source — consumed by `src/app/page.tsx`, its `generateMetadata`, and `src/app/opengraph-image.tsx`. Edit there, not inline.

## Data sources — what works

- **Live SST → Open-Meteo Marine API.** Free, CC-BY, no key, parallel-friendly.
- **30-year climatology → NOAA CoralTemp v3.1 via [PIFSC ERDDAP](https://oceanwatch.pifsc.noaa.gov/erddap/griddap/CRW_sst_v3_1.html).** Strictly serial — returns 429 on parallel requests. Use 10-year chunks (~110s each) with retry-and-backoff.
- **Known-broken (don't retry these without cause):** CoastWatch PFEG / PolarWatch ERDDAP (timeout from this host), NCEI `ncdc_oisst_v2_avhrr_*` ERDDAP (only goes back to 2020), marineheatwaves.org tracker (UI-only CSV download, no API), Open-Meteo archive-api SST (nulls at coastal NZ pixels pre-2023).

## Gotchas

- `src/lib/climatology.ts` and `src/lib/calibration.ts` both cache in module-level `Map`s — **restart the dev server** after dropping/changing climatology CSVs or calibration JSONs; HMR alone won't clear them.
- Live SST and climatology come from different products → ~0–0.3 °C systematic offset. Corrected at request time via the per-region scalar in `data/calibration/<region-id>.json`, applied in `src/lib/hobday.ts:buildSeries`.
- `AbortSignal.timeout(N)` covers response time only — Undici's default **connect timeout is 10s** and is separate. ERDDAP connects can exceed that under load.
- Scaffolding Next.js into the repo root required moving `CLAUDE.md` aside temporarily (`create-next-app` refuses to scaffold into a non-empty dir).
- **Tailwind v4 dark mode is media-query driven** — `documentElement.classList.add('dark')` does nothing. Test dark mode via OS preference or `preview_resize colorScheme: "dark"`.
- **Next.js page-level `openGraph` / `twitter` metadata REPLACE the layout's**, they don't deep-merge. `generateMetadata` must return the full structure (siteName, locale, type, etc.) or those fields drop.
- **Open-Meteo `past_days=92` returns 93 daily entries** — the last is today/forecast, not strictly past. CoralTemp via PIFSC ERDDAP lags real-time ~1–2 days, so for overlap windows use `endDate = today − 2`.
- **SVG hover tooltips on chart strokes need fat invisible hit-zone overlays** — `<title>` only fires on painted pixels, and 1px strokes under `preserveAspectRatio="none"` are nearly impossible to land. Pattern: duplicate path with `stroke="transparent" strokeWidth={8} style={{ pointerEvents: "stroke" }}` carrying the title.
- **For SST visualisations spanning >30 days, draw seas/thresh references day-by-day, not as flat medians.** NZ coastal climatology drifts 1–2°C in shoulder seasons; a flat median line misplaces today's actual baseline by ~1°C in autumn — see [`src/components/Sparkline.tsx`](src/components/Sparkline.tsx) for the day-by-day pattern.
