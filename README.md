# Marine Heatwave Live NZ

Live sea surface temperature vs 30-year baseline for 12 NZ coastal regions, with [Hobday et al. 2016](https://doi.org/10.1016/j.pocean.2015.12.014) marine heatwave classification.

**Live:** [heatwave.marulho.co](https://heatwave.marulho.co)

The gap this fills: NIWA publishes a monthly SST *forecast*. Nobody publishes a live consumer-facing view of what the NZ ocean is actually doing **right now** and over the last 30 days. This is that view.

## What it shows

- Current SST per region, coloured by anomaly vs 1991–2020 climatology
- Hobday MHW category (Moderate / Strong / Severe / Extreme) when a region is in heatwave conditions
- 60-day sparkline per region with the 90th-percentile threshold drawn day-by-day
- One headline sentence: *"X regions currently in marine heatwave conditions. Longest active event: Y days, Z region, Strong category."*

## Stack

- Next.js 16 · TypeScript · Tailwind CSS v4
- Bun runtime
- Deployed on Vercel with 1h ISR

## Data sources

| Source | Purpose |
|---|---|
| [Open-Meteo Marine API](https://open-meteo.com/en/docs/marine-weather-api) | Live daily SST per region (CC-BY, no key) |
| [NOAA CoralTemp v3.1](https://coralreefwatch.noaa.gov/product/5km/index_5km_sst.php) via [PIFSC ERDDAP](https://oceanwatch.pifsc.noaa.gov/erddap/griddap/CRW_sst_v3_1.html) | 30-year daily climatology baseline |

Per-region calibration offsets (`data/calibration/*.json`) correct the ~0–0.3 °C systematic difference between the two products.

## Local dev

```bash
bun install
bun run dev       # http://localhost:3000
bun run build     # production build
```

Baseline artifacts are committed, so local dev works immediately. Rebuild only when regions or the reference period change:

```bash
bun run build-climatology   # 35–60 min, pulls 30y of CoralTemp via ERDDAP
bun run build-calibration   # ~1–2 min, re-derives Open-Meteo↔CoralTemp offsets
```

## Scope

This is an **observational** dashboard — live + recent historical, not a forecast. For NZ SST outlooks, see [NIWA's monthly SST Update](https://niwa.co.nz/climate-and-weather/sea-surface-temperature-update).

## Credits

- MHW methodology: Hobday et al. 2016
- NZ region selection: [Santana et al. 2025](https://doi.org/10.3389/fmars.2025.1607806) (NIWA / Earth Sciences NZ)
- Data: NOAA OISST/CoralTemp, Open-Meteo

A [Marulho](https://marulho.co) experiment in turning hidden NZ data into single useful answers.
