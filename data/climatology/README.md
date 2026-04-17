# Climatology CSVs

Drop Hobday climatology + 90th-percentile threshold CSVs here, one per region.

## How to get them

1. Open [marineheatwaves.org/tracker](https://tracker.marineheatwaves.org/MHW/)
2. Enter each region's lat/lon (see table below) in the pixel control panel
3. Click **"Download climatology & threshold data (CSV)"**
4. Rename the downloaded file to `<region-id>.csv` and drop it here

## Expected format

The tracker exports these columns, one row per day-of-year (1–366):

```csv
lon,lat,doy,seas,thresh,thresh_MCS
174.875,-36.375,1,20.31,22.05,17.80
174.875,-36.375,2,20.33,22.07,17.82
...
```

Only `doy`, `seas`, and `thresh` are used. The parser ignores extra columns.

## Regions

| Region ID | Lat | Lon |
|---|---|---|
| `northland` | −35.125 | 174.125 |
| `hauraki-gulf` | −36.375 | 174.875 |
| `bay-of-plenty` | −37.625 | 176.375 |
| `east-cape` | −37.625 | 178.625 |
| `hawkes-bay` | −39.625 | 177.625 |
| `cook-strait` | −41.375 | 174.625 |
| `tasman-bay` | −40.625 | 172.875 |
| `kaikoura` | −42.625 | 173.875 |
| `fiordland` | −45.625 | 166.125 |
| `foveaux-strait` | −46.625 | 168.125 |

Baseline period in the tracker defaults to 1982–2011 (NOAA OISST v2.1).
Smoothing parameters (±5-day window pool, 31-day moving-average) are applied
upstream by the tracker — the exported values are drop-in ready.
