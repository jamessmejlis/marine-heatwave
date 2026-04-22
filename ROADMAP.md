# Marine Heatwave Live NZ — Roadmap

Living planning doc. Tick items as they ship. Keep scope-honest: the app is a FuelClock for the ocean — one page, one answer per region. Resist feature creep that doesn't serve that shape.

See [`CLAUDE.md`](CLAUDE.md) for the strategic brief and the **Task Workflow** (pick → plan → implement → hand off → fix → wrap up). See [`~/Developer/open-data/nz-marine-project-ideas.md`](~/Developer/open-data/nz-marine-project-ideas.md) § Marine Heatwave Live NZ for the full constellation context.

---

## Scorecard

| Milestone | Done / Total | Remaining |
|---|---|---|
| v1.0 (ship) | 9 / 9 | 0 |
| v1.1 (correctness & polish) | 22 / 24 | 2 |
| v1.2 (share & explain) | 2 / 12 | 10 |
| v2.0 (from the brief) | 0 / 5 | 5 |
| Post-launch integration | 0 / 3 | 3 |
| Research / commercial tail | 0 / 3 | 3 |
| **Total tracked** | **33 / 56** | **23** |

Update this table as part of step 6 of the Task Workflow. Excludes "On the bench" (parked) and "Open questions" (decisions, not tasks).

---

## Current task

> The one thing to work on now. Replace this block when the task is done and confirmed by the user.

**v1.1 — Pipeline sanity-check against NOAA CRW** (Cross-check lab, below)

Why this one: v1.1 has two blockers left, and this is the upstream of the pair (the GitHub Action consumes the script's output). It's also the item most likely to expose a bug in the calibration or Hobday pipeline before we invest in v1.2 permalinks.

**Step-by-step**

1. Read [`src/lib/hobday.ts`](src/lib/hobday.ts) `buildSeries` and [`src/lib/calibration.ts`](src/lib/calibration.ts) so the script can call the same comparison logic — don't duplicate it.
2. Find the authoritative NOAA Coral Reef Watch daily heatwave classification endpoint for a single point (likely a separate ERDDAP dataset from CoralTemp v3.1 — the "daily BAA" or "SST anomaly" product). Document the URL and which variable carries the category in a comment at the top of the script.
3. Scaffold `scripts/sanity-check-noaa-crw.ts` — for each region in `src/lib/regions.ts`, fetch the CRW-published classification + anomaly for the last ~60 days at the region's lat/lon, fetch our own classification for the same window via existing `buildSeries`, diff the two.
4. Emit `data/sanity-check/<YYYY-MM-DD>.json` with per-region `{ crw: {category, anomaly}, ours: {category, anomaly}, delta: {category, anomaly} }`, plus a summary `{ regionsWithCategoryDrift, regionsWithAnomalyDriftOver: 0.2 }`.
5. Run it locally. If any region drifts more than one category, stop and investigate before shipping the GitHub Action — that's the signal we've mis-implemented Hobday or mis-applied the calibration scalar.
6. Add a `bun run sanity-check` script to `package.json`.
7. Hand off for testing: user runs `bun run sanity-check`, reviews the emitted JSON, confirms the summary looks right. **Stop here and wait.**
8. On confirmation, move to the GitHub Action item (schedule: weekly, post summary to a gist or issue comment).

Tasks 9–17 remain queued below; this block only owns the current one.

---

## v1.0 — Shipped

What's live on `main` as of 2026-04-17:

- [x] Next.js 16 + TypeScript + Tailwind v4 scaffold, Bun-native
- [x] 12 NZ coastal regions defined with Santana et al. (2025) lat/lons for the five aquaculture pixels (snapped offshore where the 5 km CoralTemp grid hits land), pragmatic offshore picks for the rest, Māori/English display metadata ([`src/lib/regions.ts`](src/lib/regions.ts))
- [x] Live SST from [Open-Meteo Marine API](https://open-meteo.com/en/docs/marine-weather-api) — free, CC-BY, no key, `past_days=92` so the Hobday detector sees the full plausible event window ([`src/lib/sst.ts`](src/lib/sst.ts))
- [x] 30-year Hobday climatology + 90th-percentile threshold per region, computed locally from NOAA Coral Reef Watch CoralTemp v3.1 over 1991–2020 (WMO standard normal) via [`scripts/build-climatology.ts`](scripts/build-climatology.ts). Pre-built CSVs committed in [`data/climatology/`](data/climatology/).
- [x] Hobday (2016) detection + Hobday (2018) categorisation matching the [`ecjoliver/marineHeatWaves`](https://github.com/ecjoliver/marineHeatWaves) reference defaults (±5-day pool, 31-day smoothing, ≥5-day minimum, ≤2-day gap merge, category = `floor(1 + (SST−seas)/(thresh−seas))` capped at 4) ([`src/lib/hobday.ts`](src/lib/hobday.ts))
- [x] Dashboard UI: headline stat, 12 region cards with colour-coded category strip, methodology footer with transparent sourcing ([`src/app/page.tsx`](src/app/page.tsx), [`src/components/RegionCard.tsx`](src/components/RegionCard.tsx))
- [x] Production build passes, static generation with 1h ISR

**Shipped post-v1.0:**

- [x] Pushed to GitHub: [jamessmejlis/marine-heatwave](https://github.com/jamessmejlis/marine-heatwave) (public)
- [x] Deployed to Vercel, live at [heatwave.marulho.co](https://heatwave.marulho.co) (Git-connected, auto-deploys on push to `main`)

---

## Known v1.0 caveats

These are documented in the footer for public transparency but are also our backlog hints:

- **Cross-product anomaly offset.** Live SST comes from Open-Meteo (underlying product likely CMEMS GLORYS or similar), climatology from CoralTemp. Same pixel, different product — estimated 0.0–0.3 °C systematic offset. Risk: borderline heatwaves may be over- or under-reported. Fix queued in v1.1.
- **Resolution mismatch vs NIWA.** NIWA uses OISST v2.1 at 25 km, we use CoralTemp at 5 km. Heatwave detections should agree at a daily scale but precise anomaly numbers may drift by ~0.1–0.3 °C. Acceptable for a consumer dashboard; worth noting on a `/methodology` page when we build one.
- **Pixel placement.** Each region is a single 5-km grid cell picked by us for a plausible sea location. Some regions are dynamic (Cook Strait, Foveaux) where a single pixel can be non-representative. Fix considered: 3×3 regional average per region, weighted to sea pixels only.
- **v1 Hauraki Gulf showed −0.0 °C anomaly** on ship day while NIWA forecast median was +0.75 °C for adjacent Coromandel. Likely product-offset + recent cooling. Re-check after calibration lands. **Update 2026-04-19:** post-calibration anomaly moved to −0.7 °C — *further* from NIWA's forecast, not closer. Now understood as a category mismatch: NIWA's published product is a monthly *forecast* outlook (rolling 6-month, 10-model ensemble), not a current observation. NIWA doesn't publish current-actuals at consumer scale — that's the gap this project fills (see [Scope discipline in CLAUDE.md](CLAUDE.md)). The residual gap is OISST-vs-CoralTemp resolution + product, plus the comparison was never apples-to-apples. Replacement sanity-check against NOAA CRW queued in the Cross-check lab below.

---

## v1.1 — Correctness & polish (the honest v1)

Small changes that close the transparency gap and add one high-signal visual. Target: ship within a week of v1.0.

### Calibration pass _(shipped — closes the offset caveat)_

- [x] Standalone [`scripts/build-calibration.ts`](scripts/build-calibration.ts) (split out from build-climatology because cadence differs — calibration refreshes monthly-ish, climatology is one-shot) fetches the overlapping ~95-day window of both CoralTemp and Open-Meteo SST per region, computes scalar mean offset `Δ = OM − CT`, emits `data/calibration/<region-id>.json`
- [x] At request time, [`src/lib/calibration.ts`](src/lib/calibration.ts) loader returns the offset; [`src/lib/hobday.ts:buildSeries`](src/lib/hobday.ts) subtracts it from raw SST before all comparison to climatology (anomaly, threshold, category, displayed °C)
- [x] Footer copy: dropped the "hybrid sources" caveat paragraph; methodology section now describes the calibration pipeline
- [x] **Diagnostic emitted alongside:** `data/calibration/_diagnostic.json` carries per-region weekly residuals + linear slope of `(OM − CT)` across the window. Build-time only, drives the v1.2 decision on whether scalar correction needs to graduate to per-DOY. On first run all 10 regions flagged with seasonal residual range > 0.4 °C — scalar shipped as the v1.1 minimum-viable improvement; per-DOY upgrade graduated to v1.2.
- ~~Re-run NIWA cross-check — Hauraki Gulf anomaly should move closer to NIWA's forecast (manual)~~ — **closed 2026-04-19**, category mismatch: see Known v1.0 caveats above. Replaced by the NOAA CRW pipeline sanity-check in the Cross-check lab below.

### Visual: 60-day sparkline per card _(shipped)_

- [x] Inline SVG below the heatwave-status line — last 60 days of daily SST with **day-by-day** seas + threshold reference paths (initially shipped as flat medians; fixed same day after autumn climatology drift was misplacing today's baseline by ~1°C). Component at [`src/components/Sparkline.tsx`](src/components/Sparkline.tsx), wired in [`src/components/RegionCard.tsx`](src/components/RegionCard.tsx).
- [x] Orange filled band where SST is above threshold (uses precomputed `DayAssessment.aboveThreshold`); subtle blue tint where SST is below baseline (cool-spell hint at near-zero cost)
- [x] No JS — pure server-rendered SVG, deterministic geometry, dark-mode aware via Tailwind utility classes on `<path>`
- [x] Accessibility: `role="img"` + `aria-labelledby` linking to a `<title>` like *"60-day SST trend for Hauraki Gulf: 2026-02-16 to 2026-04-17. SST ranged from 18.4°C to 21.2°C. 12 days above threshold."*
- [x] Native browser hover tooltips on each reference line via fat invisible hit-zone overlay paths (`stroke="transparent" strokeWidth={8} pointerEvents:"stroke"`) carrying explanatory `<title>` elements — explains what the dashed lines represent on first hover.
- [x] Card footnote legend (`30-yr baseline X° · heatwave threshold Y°`) colour-matched to the dashed-line colours so the visual mapping is obvious without a separate legend.

### Cross-check lab

- ~~Write `scripts/cross-check-niwa.ts` — pulls NIWA's published coastal SST anomaly table and compares to our values, reports per-region deltas~~ — **abandoned 2026-04-19**. NIWA's published product is a monthly forecast outlook, not a real-time anomaly table. No clean source to scrape against; the cross-check premise was a category mismatch from the start.
- [ ] **Pipeline sanity-check against NOAA CRW.** Write `scripts/sanity-check-noaa-crw.ts` that pulls NOAA Coral Reef Watch's official daily heatwave classification (the authoritative use of CoralTemp v3.1, the same product as our climatology) for each region's pixel, compares to our classification + anomaly. Should agree closely — drift indicates a bug in our Hobday implementation or in how the calibration scalar is applied, not a cross-product gap. Stronger signal than the abandoned NIWA check would have provided, since we're testing our own pipeline against the canonical use of the underlying data.
- [ ] Run sanity-check weekly via a GitHub Action, post a summary if any region's classification or anomaly drifts more than ~0.2 °C from CRW's published value.

### Accessibility + polish _(shipped)_

- [x] Active-heatwave category bars carry a diagonal hazard-stripe overlay in addition to colour, so the "ongoing heatwave" signal reads in greyscale and for deuteranopic/protanopic users. Each card also carries an `sr-only` sentence describing the bar state for screen readers.
- [x] Dynamic OG image at [`src/app/opengraph-image.tsx`](src/app/opengraph-image.tsx) via `next/og` `ImageResponse` — slate → cyan → sky gradient with the live headline sentence baked in, 1200×630, revalidated on the same ISR cycle as the page. Favicon at [`src/app/favicon.ico`](src/app/favicon.ico) picked up by Next app-router convention.
- [x] `generateMetadata` in [`src/app/page.tsx`](src/app/page.tsx) pulls the live headline via [`src/lib/headline.ts`](src/lib/headline.ts) so shared links show current conditions, not a generic fallback.
- [x] [`src/app/sitemap.ts`](src/app/sitemap.ts) + [`src/app/robots.ts`](src/app/robots.ts) via Next app-router conventions; both read the base URL from [`src/lib/site.ts`](src/lib/site.ts) (`NEXT_PUBLIC_SITE_URL`, default `https://marine-heatwave.marulho.app`).
- [x] `<html lang="en-NZ">` + `locale: "en_NZ"` in OpenGraph metadata.

### Marine heatwave explainer _(shipped)_

- [x] Two-paragraph "What's a marine heatwave?" block between H1 and headline stat — Hobday definition (5+ days where the sea sits in its warmest 10% for the time of year) + Tasman-Sea scale callout + documented impacts (kelp die-off, mass mortality, lower dissolved oxygen, ocean acidification, fisheries/aquaculture, species shifts, land-heatwave compounding, drawing on NIWA's public framing) + framing-discipline statement ("interpretation belongs with marine biologists, not us"). Anchored to [Hobday et al. (2016)](https://www.marineheatwaves.org/mhw-overview.html) for the definition and the [RSNZ NZ-MHW impacts paper](https://rsnz.onlinelibrary.wiley.com/doi/10.1080/00288330.2024.2436661) for "around Aotearoa". Gives new visitors conceptual scaffolding before the live numbers.

### Editorial design pass _(shipped)_

Originally not a planned milestone — surfaced during a `/frontend-design` review and shipped because the page was reading as "generic Next.js dashboard" rather than "Marulho report". Worth tracking because future work should match this register.

- [x] Typography: dropped Geist (the Vercel-default fingerprint) for **Fraunces** (variable serif, display) + **IBM Plex Sans** (body) + **IBM Plex Mono** (data + labels). Pulled via `next/font/google`.
- [x] Marulho colour system: warm paper `#f6f3ee` / deep midnight `#04101c`, ink navy / bone-warm body, **Marulho teal `#1d6f6a`** as the signature brand accent on links, key numbers, section labels, dashed dividers. Defined as Tailwind v4 design tokens (`text-ink`, `bg-paper`, `text-marulho`).
- [x] Headline stat re-typeset as editorial lead — stripped card chrome, serif sentence at 28px, key numbers in serif-bold-teal, region name underlined in teal.
- [x] Coordinate eyebrow `41°S · MARULHO · MARINE HEATWAVE LIVE NZ` places the report at Cook Strait latitude (nautical-chart signal).
- [x] Dashed teal section dividers (above headline stat, above methodology footer) echo the sparkline's reference lines — visual through-line between chart and chrome.
- [x] Subtle SVG paper-grain overlay (~3% opacity, fixed position, multiply on light / screen on dark) for tactile "printed not rendered" depth.

---

## v1.2 — Share & explain

The artifacts that turn the dashboard from a thing-you-check into a thing-you-link-to.

### Methodology, sources & acknowledgements _(shipped — folded into main page)_

Originally scoped as a separate `/methodology` route. Reconsidered: a data/portfolio piece works better as a single linkable page, and the existing editorial register supports reference material below the fold without it competing with the live numbers. So the content lives in the main page footer, deep-linkable via anchors rather than a new route.

- [x] Expanded footer on [`src/app/page.tsx`](src/app/page.tsx) with five anchored sub-sections (`#methodology`, `#sources`, `#choices`, `#limitations`, `#acknowledgements`), narrow measure and dashed-teal dividers to read as reference material vs the 6xl card grid above
- [x] Hobday definition + category math (`#methodology`), data lineage with calibration (`#sources`), the "why" set — why CoralTemp, why 1991–2020, why single pixels (`#choices`), limitations — resolution vs NIWA, pixel representativeness, calibration stationarity, surface-only (`#limitations`), acknowledgements for Hobday, Oliver, Schlegel, NOAA CRW, PIFSC ERDDAP, Open-Meteo, NIWA (`#acknowledgements`)
- [ ] Embed the cross-check table (regenerated on each build) — blocked on the v1.1 [`scripts/cross-check-niwa.ts`](ROADMAP.md) landing; will slot into `#limitations` or as its own sub-section when it exists

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
- [ ] **Baseline-period toggle.** The 30-year baseline itself drifts as the climate warms — a 1991–2020 reference normalises recent warming away, so today's "moderate" against 1991–2020 might be "severe" against 1961–1990. Pre-build multiple climatology CSVs at the WMO standard normals (1961–1990, 1971–2000, 1981–2010, 1991–2020) plus an early-record window if CoralTemp permits, expose a UI toggle on the dashboard + permalinks, and explain the choice on `/methodology`. Pairs naturally with the historical time slider — both are "see how things have changed" tools. Discipline reminder: present as "different valid choices show different framings", not "the real number is the dramatic one" — published MHW literature has the debate (fixed vs detrended baselines, Hobday 2016 vs Oliver 2021), link it.

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
- **Re-investigate NOAA OISST v2.1 as live + climatology source.** NIWA uses this product, so adopting it directly would eliminate the cross-product calibration entirely. Previously blocked by CoastWatch/PolarWatch ERDDAP timeouts and NCEI's post-2020-only window (CLAUDE.md gotchas). Worth a fresh attempt: try alternate ERDDAP mirrors (NOAA NCEP, ESRL PSL THREDDS, the AWS Open Data registry's `noaa-oisst-avhrr` S3 bucket — daily NetCDF files going back to 1981, no rate limits). If S3 works we get a single-source pipeline and can retire the calibration step entirely. Bigger upside than per-DOY calibration tweaks.

---

## Open questions

Decisions we'd like input on, surfaced so they don't fester:

- [x] ~~**Subdomain**: `marine-heatwave.marulho.app`? `heatwave.marulho.app`? `mhw.marulho.app`?~~ **Resolved 2026-04-19** → `heatwave.marulho.co`. Project-named convention for the Marulho constellation; topic-prefix (`ocean.marulho.co/heatwave`) deferred until ≥3 ocean ships are live and an "ocean hub" landing page earns its keep. Migration path preserved via Vercel 301s on the subdomain if we ever regroup.
- [ ] **v1.1 ship target**: concurrent with v1.0 launch (bundled) or a 1-week follow-up so v1.0 gets its own moment?
- [ ] **NIWA outreach**: should we email NIWA's SST team proactively before public launch, or wait for the tool to ship and let them discover organically? (Relevant to future data partnership and commercial-tier optionality.)
- [ ] **Iwi consultation**: for regions with rohe moana of cultural significance (notably Hauraki Gulf / Tīkapa Moana for Ngāti Whātua; Foveaux / Te Ara-a-Kiwa for Ngāi Tahu), do we proactively reach out before launch, or wait? Probably wait — v1 is observation-only, no claims made — but worth thinking about before v2 interpretation features.

---

## Changelog

- **2026-04-17** — v1.0 built and committed locally (4 commits on `main`). Working tree clean; awaiting push to GitHub + Vercel deploy.
- **2026-04-17** — v1.1 calibration pass: cross-product scalar offset (Open-Meteo − CoralTemp) computed offline per region and applied at request time, closing the v1.0 anomaly-bias caveat. Stationarity diagnostic emitted alongside; all 10 regions flagged with non-trivial seasonal residuals, so per-DOY upgrade is now an explicit v1.2 candidate. NIWA cross-check (manual) still pending.
- **2026-04-17** — v1.1 sparklines: 60-day inline SST sparkline added to each region card. Pure server-rendered SVG (no client JS), reference lines for seas + threshold, orange fill above threshold, blue tint below baseline, accessible `<title>` summary.
- **2026-04-17** — v1.1 accessibility + polish: `lang="en-NZ"`, dynamic OG image + meta description from live headline, sitemap + robots via app-router conventions, non-colour hazard-stripe signal on active-heatwave bars plus `sr-only` state labels. Last v1.1 blocker before the Vercel push.
- **2026-04-19** — sparkline polish: native browser hover tooltips on each reference line via fat invisible hit-zone overlays; card footnote legend colour-matched to the dashed-line colours.
- **2026-04-19** — marine heatwave explainer added between H1 and headline stat — gives new visitors conceptual scaffolding (definition + documented impacts + framing-discipline statement) before the live numbers hit.
- **2026-04-19** — editorial design refresh: Fraunces serif + IBM Plex Sans/Mono typography, Marulho teal signature accent, paper-warm + ink-navy palette, coordinate eyebrow, dashed teal section dividers echoing the sparkline reference lines, subtle SVG paper-grain overlay. Repositions the page from "generic Next.js dashboard" to "published Marulho report".
- **2026-04-19** — CLAUDE.md updated with the new design tokens, the headline single-source pointer (`src/lib/headline.ts`), and five gotchas surfaced this session (Tailwind v4 dark-mode media-query behaviour, Next.js metadata replace-not-merge, Open-Meteo `past_days=92` actually returns 93 days, SVG hover hit-zone pattern, day-by-day chart references for >30-day windows).
- **2026-04-19** — explainer copy: scholarly anchor link to the [RSNZ NZ-MHW impacts paper](https://rsnz.onlinelibrary.wiley.com/doi/10.1080/00288330.2024.2436661) on "around Aotearoa", expanded the impact list (kelp die-off, mass mortality, lower oxygen, ocean acidification, fisheries/aquaculture, species shifts, land-heatwave compounding) drawing on NIWA's public framing, added Tasman-Sea scale callout to the first paragraph.
- **2026-04-19** — NIWA cross-check item closed as a category mismatch; NIWA publishes monthly forecasts, not a real-time anomaly table. Replaced by a queued NOAA CRW pipeline sanity-check (CRW uses the same CoralTemp data we do, so agreement is testable end-to-end). v1.0 caveat annotated to reflect the corrected understanding.
- **2026-04-19** — methodology content folded into the main page footer as five anchored sub-sections (`#methodology`, `#sources`, `#choices`, `#limitations`, `#acknowledgements`) rather than a separate `/methodology` route. Keeps the FuelClock one-page discipline while making the reference material deep-linkable. Cross-check table embed remains pending on the v1.1 `scripts/cross-check-niwa.ts` script.
- **2026-04-19** — plain-language sweep across user-facing chrome (page header, explainer, headline stat, sparkline accessibility titles, card screen-reader labels): `SST` → `sea temperature`, `30-year climatological baseline` → `30-year average for the same time of year`, `≥5 consecutive days` → `at least 5 days in a row`, `90th percentile` → `warmest 10%`, `climatology` → `30-year average`. Methodology footer kept technical (right register for opt-in technical readers). Newcomers can now read above-the-fold without hitting an unexplained acronym or statistical term.
- **2026-04-19** — v2 backlog: **baseline-period toggle** added — pre-build climatologies at multiple WMO standard normals (1961–1990, 1971–2000, 1981–2010, 1991–2020), expose UI toggle on dashboard + permalinks. The 30-year baseline itself drifts as the climate warms, so today's "moderate" against 1991–2020 might read as "severe" against an earlier window. Pairs with the historical time slider; published Hobday-vs-Oliver methodological debate (fixed vs detrended baselines) gives the framing.
- **2026-04-19** — **v1.0 shipped publicly** at [heatwave.marulho.co](https://heatwave.marulho.co). Repo pushed to GitHub ([jamessmejlis/marine-heatwave](https://github.com/jamessmejlis/marine-heatwave), public), imported to Vercel, custom domain attached (DNS auto-handled since `marulho.co` nameservers are already at Vercel). Subdomain open-question resolved: project-named convention (`heatwave.marulho.co`) for the Marulho constellation. First ship of the Marulho marine track — smallest technical surface, strongest virality cadence, pipeline ready to feed Kelp Watch + Underwater Visibility.
- **2026-04-19** — region migration: 10 → 12 regions per the canonical CLAUDE.md spec. Added Coromandel, Marlborough Sounds (Pelorus), Otago; dropped Cook Strait; renamed/relabeled Tasman→Golden Bay, Hawke's Bay→Hawke's Bay/Wairarapa, Kaikōura→Kaikōura/East Coast South. Aquaculture-region pixels (Coromandel, Bay of Plenty, Marlborough Sounds, Golden Bay) sourced from [Santana et al. 2025's open notebook](https://github.com/nicolasfauchereau/SST_forecasting/blob/main/notebooks/SST_obs_correlations.ipynb) — Foveaux Strait absent from their notebook, kept our existing pixel. Discovered a sharp resolution constraint: their lat/lons were chosen for OISST 25 km where coastal points still fall inside large sea pixels, but on CoralTemp 5 km some sit on land. Bay of Plenty needed a small offshore nudge (−38.0123, 177.2871 → −37.975, 177.275) to clear the Ōpōtiki shoreline. Climatology + calibration rebuilt for the 5 affected regions; all 12 cards now render with full data. Methodology footer (`#sources`, `#choices`, `#acknowledgements`) updated to credit Santana et al. and document the offshore-snap caveat. Final pre-deploy state.
