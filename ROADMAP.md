# Marine Heatwave Live NZ — Roadmap

Living planning doc. Tick items as they ship. Keep scope-honest: the app is a FuelClock for the ocean — one page, one answer per region. Resist feature creep that doesn't serve that shape.

See [`CLAUDE.md`](CLAUDE.md) for the strategic brief. See [`~/Developer/open-data/nz-marine-project-ideas.md`](~/Developer/open-data/nz-marine-project-ideas.md) § Marine Heatwave Live NZ for the full constellation context.

---

## v1.0 — Shipped

What's live on `main` as of 2026-04-17:

- [x] Next.js 16 + TypeScript + Tailwind v4 scaffold, Bun-native
- [x] 10 NZ coastal regions defined with lat/lon aligned to the NOAA OISST 0.25° grid, Māori/English display metadata ([`src/lib/regions.ts`](src/lib/regions.ts))
- [x] Live SST from [Open-Meteo Marine API](https://open-meteo.com/en/docs/marine-weather-api) — free, CC-BY, no key, `past_days=92` so the Hobday detector sees the full plausible event window ([`src/lib/sst.ts`](src/lib/sst.ts))
- [x] 30-year Hobday climatology + 90th-percentile threshold per region, computed locally from NOAA Coral Reef Watch CoralTemp v3.1 over 1991–2020 (WMO standard normal) via [`scripts/build-climatology.ts`](scripts/build-climatology.ts). Pre-built CSVs committed in [`data/climatology/`](data/climatology/).
- [x] Hobday (2016) detection + Hobday (2018) categorisation matching the [`ecjoliver/marineHeatWaves`](https://github.com/ecjoliver/marineHeatWaves) reference defaults (±5-day pool, 31-day smoothing, ≥5-day minimum, ≤2-day gap merge, category = `floor(1 + (SST−seas)/(thresh−seas))` capped at 4) ([`src/lib/hobday.ts`](src/lib/hobday.ts))
- [x] Dashboard UI: headline stat, 10 region cards with colour-coded category strip, methodology footer with transparent sourcing ([`src/app/page.tsx`](src/app/page.tsx), [`src/components/RegionCard.tsx`](src/components/RegionCard.tsx))
- [x] Production build passes, static generation with 1h ISR

**Not yet shipped** (but v1-blocking-ish):

- [ ] Push to GitHub and deploy to Vercel
- [ ] Marulho subdomain wired (e.g. `marine-heatwave.marulho.app`)

---

## Known v1.0 caveats

These are documented in the footer for public transparency but are also our backlog hints:

- **Cross-product anomaly offset.** Live SST comes from Open-Meteo (underlying product likely CMEMS GLORYS or similar), climatology from CoralTemp. Same pixel, different product — estimated 0.0–0.3 °C systematic offset. Risk: borderline heatwaves may be over- or under-reported. Fix queued in v1.1.
- **Resolution mismatch vs NIWA.** NIWA uses OISST v2.1 at 25 km, we use CoralTemp at 5 km. Heatwave detections should agree at a daily scale but precise anomaly numbers may drift by ~0.1–0.3 °C. Acceptable for a consumer dashboard; worth noting on a `/methodology` page when we build one.
- **Pixel placement.** Each region is a single 5-km grid cell picked by us for a plausible sea location. Some regions are dynamic (Cook Strait, Foveaux) where a single pixel can be non-representative. Fix considered: 3×3 regional average per region, weighted to sea pixels only.
- **v1 Hauraki Gulf showed −0.0 °C anomaly** on ship day while NIWA forecast median was +0.75 °C for adjacent Coromandel. Likely product-offset + recent cooling. Re-check after calibration lands.

---

## v1.1 — Correctness & polish (the honest v1)

Small changes that close the transparency gap and add one high-signal visual. Target: ship within a week of v1.0.

### Calibration pass _(highest priority — closes the offset caveat)_

- [ ] In [`scripts/build-climatology.ts`](scripts/build-climatology.ts), add a second pass that fetches the overlapping 90-day window of both CoralTemp and Open-Meteo SST per region, computes mean offset `Δ = OM − CT`, emits `data/calibration/<region-id>.json`
- [ ] At request time, apply `sst_calibrated = sst_openmeteo − Δ` before comparison to climatology
- [ ] Footer copy: drop the caveat paragraph; note calibration in methodology instead
- [ ] Re-run NIWA cross-check — Hauraki Gulf anomaly should move closer to NIWA's forecast

### Visual: 60-day sparkline per card _(highest engagement lift)_

- [ ] Tiny inline SVG below the SST number — 60 days of daily SST with horizontal baseline (seas) and threshold reference lines
- [ ] Colour the fill orange above threshold, grey below
- [ ] No JS — pure SVG from the server component
- [ ] Accessibility: `<title>` with textual summary ("60-day SST trend: rose from X to Y, N days above threshold")

### Cross-check lab

- [ ] Write `scripts/cross-check-niwa.ts` — pulls NIWA's published coastal SST anomaly table and compares to our values, reports per-region deltas
- [ ] Run weekly via a GitHub Action, post a summary comment / Slack / email if any region drifts >0.5 °C

### Accessibility + polish

- [ ] Don't rely on colour alone — category chips already carry text, but verify the top bar has a non-colour signal (icon? pattern?) for colour-blind users
- [ ] OG image + favicon (Marulho ocean gradient, region grid thumbnail)
- [ ] Meta description pulled from headline stat
- [ ] Sitemap + robots.txt (Next.js app-router convention)
- [ ] Add `lang="en-NZ"` to `<html>`

---

## v1.2 — Share & explain

The artifacts that turn the dashboard from a thing-you-check into a thing-you-link-to.

### `/methodology` deep-link page

- [ ] One-page explainer: Hobday definition, category multipliers, data lineage, why CoralTemp, why 1991–2020 baseline, why not NIWA data directly
- [ ] Embed the cross-check table (regenerated on each build)
- [ ] Acknowledge Hobday, Oliver, Schlegel (tracker author), NOAA CRW, Open-Meteo

### Per-region permalinks

- [ ] `/r/<region-id>` — same card but full-page with sparkline, 1-year SST history, event log (last N events with start/end/category)
- [ ] OG image per region (SST + category + headline baked in)
- [ ] These become the social-shareable unit: "Hauraki Gulf right now → URL"

### Engagement plumbing

- [ ] Plausible or simple privacy-preserving analytics (no cookies)
- [ ] `?utm=` passthrough for campaign attribution
- [ ] Auto-refresh on the main page every hour client-side (matches ISR cadence)

### Copy + voice

- [ ] Pass every number through "report data, don't editorialise" check
- [ ] One-line "as of" timestamp with Pacific/Auckland TZ prominently visible
- [ ] Error/outage state copy — what the page says if Open-Meteo is down

---

## v2.0 — From the brief

Items the CLAUDE.md brief explicitly listed as out-of-scope for v1 but planned.

- [ ] **Historical time slider.** Scrub through the last 40 years of CoralTemp, see events pop in/out on each region. Requires pre-computed per-region daily time series + client-side date scrubbing. Biggest UX bet.
- [ ] **Downloadable timeseries** per region (CSV). Trivial once the time slider data exists.
- [ ] **Email/RSS alerts.** "Subscribe to Hauraki Gulf alerts" — cron job detects category changes, sends digest. Email list becomes the top-of-funnel for the broader Marulho constellation.
- [ ] **Embeddable widgets** for NZ news sites and NGO partners (see nonprofit embed licensing in project ideas doc). Single-region iframe or script tag.

---

## Post-launch — Downstream integration

This project exists partly to feed the rest of the marine track. Harvest pattern:

- [ ] **Kelp Watch thermal overlay.** When Kelp Watch ships, our per-region daily SST + threshold series is the input for its "thermal stress exceeded" layer. Expose via a stable internal JSON endpoint.
- [ ] **Underwater Visibility Forecast.** Visibility model needs SST as one input feature. Same endpoint.
- [ ] **Shared climatology module.** Extract `src/lib/{climatology,hobday}.ts` into a `@marulho/marine-baseline` package usable across the constellation.

---

## Research / commercial tail (low priority, track for optionality)

Not building yet. Logging so we don't lose the thread.

- [ ] Moana Project / NIWA partnership exploration — potential for authoritative badge + richer subsurface data. Framing: we publicise their data better than their own portals do.
- [ ] Commercial-tier API (rate-limited alerts, historical backfills, SLA). Only worth pursuing if widgets see pickup.
- [ ] Academic mention: could be a 1-page methods note submittable to _Journal of Open Source Software_ once v1.1 is solid.

---

## On the bench (considered, parked)

Ideas we explored but decided against or deferred:

- **Scripted climatology from the marineheatwaves.org tracker** — abandoned; the tracker has no public API, manual click-through is brittle, and CoralTemp via PIFSC ERDDAP got us a cleaner provenance anyway.
- **Using NIWA OISST v2.1 directly** — CoastWatch / PolarWatch ERDDAP endpoints timed out consistently from this host. Revisit if PIFSC CoralTemp becomes unreliable or if NIWA publishes an authenticated API.
- **Subsurface temperature (Moana Project Mangōpare sensors)** — sparse, irregular, vessel-track data. Not a good fit for a "current SST per region" grid. Potentially useful for v2 as a "depth stratification" side panel.
- **Switching live SST to CoralTemp** — tried during v1. PIFSC ERDDAP strictly serialises requests (429 Too Many Requests), giving 3–10 min first-load latencies. Open-Meteo won on ergonomics; calibration closes the gap.

---

## Open questions

Decisions we'd like input on, surfaced so they don't fester:

- [ ] **Subdomain**: `marine-heatwave.marulho.app`? `heatwave.marulho.app`? `mhw.marulho.app`? Consider shareability and how it reads in a tweet.
- [ ] **v1.1 ship target**: concurrent with v1.0 launch (bundled) or a 1-week follow-up so v1.0 gets its own moment?
- [ ] **NIWA outreach**: should we email NIWA's SST team proactively before public launch, or wait for the tool to ship and let them discover organically? (Relevant to future data partnership and commercial-tier optionality.)
- [ ] **Iwi consultation**: for regions with rohe moana of cultural significance (notably Hauraki Gulf / Tīkapa Moana for Ngāti Whātua; Foveaux / Te Ara-a-Kiwa for Ngāi Tahu), do we proactively reach out before launch, or wait? Probably wait — v1 is observation-only, no claims made — but worth thinking about before v2 interpretation features.

---

## Changelog

- **2026-04-17** — v1.0 built and committed locally (4 commits on `main`). Working tree clean; awaiting push to GitHub + Vercel deploy.
