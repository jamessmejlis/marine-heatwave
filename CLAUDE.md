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

| Source | Purpose | Access |
|---|---|---|
| [Open-Meteo Marine API](https://open-meteo.com/en/docs/marine-weather-api) | Current SST per region | Free, CC-BY, no key |
| [NOAA Coral Reef Watch](https://coralreefwatch.noaa.gov/) | Marine heatwave classification methodology (Hobday et al. 2016) | Free reference |
| NOAA OISST | 30+ year daily SST baseline | Free |
| [NIWA Moana Backbone](https://marinedata.niwa.co.nz/) | Authoritative NZ SST (optional, v2) | Portal |
| [Moana Project](https://www.moanaproject.org/) | NZ-scale SST observations (optional, v2) | Open-access |

## NZ coastal regions (v1)

Target ~10 regions. Starting list (refine as needed):
- Northland
- Hauraki Gulf
- Bay of Plenty
- East Cape
- Hawke's Bay / Wairarapa
- Cook Strait
- Tasman / Golden Bay
- Kaikōura / East Coast South
- Fiordland
- Foveaux Strait

## Hobday scale (the classification)

Marine heatwave = SST above the 90th percentile of the 30-year baseline for ≥5 consecutive days.

Category by multiplier of the (90th percentile − climatology) anomaly:
- **Moderate** — 1–2×
- **Strong** — 2–3×
- **Severe** — 3–4×
- **Extreme** — 4×+

## Framing discipline

- Report data; don't editorialise. "SST 2.8°C above average" is a fact. "Disaster unfolding" is a claim.
- Ecological interpretation needs context — partner with a marine biologist before stating what a heatwave "means" for species. V1 stays in the observation lane.
- Be transparent about SST source and resolution per region. Confidence intervals on baselines.
- Footer: *"A Marulho experiment in turning hidden NZ data into single useful answers."* Constellation link to sibling projects as they ship.

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

**Dev:** `bun run dev` · `bun run build` · `bun run scripts/build-climatology.ts` (only when regions or reference period change — takes 35–60 min, pass `--force` to rebuild existing CSVs)

**Architecture:** `src/lib/` data layer · `src/app/` routes · `src/components/` UI · `scripts/` offline tools · `data/climatology/*.csv` pre-built Hobday baselines (committed artifacts, don't regenerate casually). Server components throughout; 1h ISR via `export const revalidate = 3600`.

**Plan tracking:** [`ROADMAP.md`](ROADMAP.md) is the single source of truth — update its changelog when shipping.

**TypeScript:** no `esModuleInterop` — use `import * as fs from "node:fs/promises"`, never `import fs from ...`.

## Data sources — what works

- **Live SST → Open-Meteo Marine API.** Free, CC-BY, no key, parallel-friendly.
- **30-year climatology → NOAA CoralTemp v3.1 via [PIFSC ERDDAP](https://oceanwatch.pifsc.noaa.gov/erddap/griddap/CRW_sst_v3_1.html).** Strictly serial — returns 429 on parallel requests. Use 10-year chunks (~110s each) with retry-and-backoff.
- **Known-broken (don't retry these without cause):** CoastWatch PFEG / PolarWatch ERDDAP (timeout from this host), NCEI `ncdc_oisst_v2_avhrr_*` ERDDAP (only goes back to 2020), marineheatwaves.org tracker (UI-only CSV download, no API), Open-Meteo archive-api SST (nulls at coastal NZ pixels pre-2023).

## Gotchas

- `src/lib/climatology.ts` caches in a module-level `Map` — **restart the dev server** after dropping/changing climatology CSVs; HMR alone won't clear it.
- Live SST and climatology come from different products → ~0–0.3 °C anomaly offset. Documented in the footer; calibration pass is the v1.1 priority.
- `AbortSignal.timeout(N)` covers response time only — Undici's default **connect timeout is 10s** and is separate. ERDDAP connects can exceed that under load.
- Scaffolding Next.js into the repo root required moving `CLAUDE.md` aside temporarily (`create-next-app` refuses to scaffold into a non-empty dir).
