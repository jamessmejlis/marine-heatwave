import type { DayAssessment } from "@/lib/hobday";

/**
 * 60-day SST sparkline. Pure server-rendered SVG, no client JS.
 *
 * Layers (bottom → top):
 *   1. Below-baseline tint     — subtle blue band between SST and seas where sst < seas
 *   2. Above-threshold fill    — orange band between SST and thresh on aboveThreshold days
 *   3. Seas reference path     — dashed slate, day-by-day climatological mean
 *   4. Threshold reference     — dashed orange, day-by-day 90th percentile
 *   5. SST line                — solid slate, the actual data
 *
 * The reference lines are drawn day-by-day rather than flat. NZ coastal
 * climatology drifts ~1–2 °C over a 60-day window in shoulder seasons
 * (autumn especially), so a flat line at the median would put today's
 * actual baseline visibly off-axis. A drawn-out climatology curve also
 * tells a story: "the bar is moving, here's how my SST tracks it."
 *
 * Above-threshold fills use the precomputed DayAssessment.aboveThreshold
 * — the same flag the Hobday detector uses — so the visual matches what
 * the card's category strip shows.
 *
 * Null SSTs break the path (produces a gap rather than a 0-anchored line).
 */

type Props = {
  series: DayAssessment[];
  regionName: string;
  regionId: string;
};

const W = 240;
const H = 44;
const PAD_TOP = 2;
const PAD_BOTTOM = 4;

export function Sparkline({ series, regionName, regionId }: Props) {
  const allVals: number[] = [];
  for (const d of series) {
    if (d.sst !== null) allVals.push(d.sst);
    if (d.seas !== null) allVals.push(d.seas);
    if (d.thresh !== null) allVals.push(d.thresh);
  }
  if (allVals.length === 0) return null;

  const dataMin = Math.min(...allVals);
  const dataMax = Math.max(...allVals);
  const span = Math.max(dataMax - dataMin, 0.5);
  const yMin = dataMin - span * 0.08;
  const yMax = dataMax + span * 0.08;

  const n = series.length;
  const xAt = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const yAt = (v: number) =>
    H - PAD_BOTTOM - ((v - yMin) / (yMax - yMin)) * (H - PAD_TOP - PAD_BOTTOM);

  const sstPath = buildValuePath(series, xAt, yAt, (d) => d.sst);
  const seasPath = buildValuePath(series, xAt, yAt, (d) => d.seas);
  const threshPath = buildValuePath(series, xAt, yAt, (d) => d.thresh);
  const aboveFills = buildBandFills(series, xAt, yAt, "above");
  const belowFills = buildBandFills(series, xAt, yAt, "below");

  const titleId = `sparkline-title-${regionId}`;
  const summary = buildSummary(series, regionName);

  return (
    <svg
      role="img"
      aria-labelledby={titleId}
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      preserveAspectRatio="none"
      className="block"
    >
      <title id={titleId}>{summary}</title>

      {belowFills.map((d, i) => (
        <path
          key={`below-${i}`}
          d={d}
          className="fill-sky-200/50 dark:fill-sky-700/25"
        />
      ))}
      {aboveFills.map((d, i) => (
        <path
          key={`above-${i}`}
          d={d}
          className="fill-orange-300/70 dark:fill-orange-500/35"
        />
      ))}

      <path
        d={seasPath}
        fill="none"
        strokeWidth={1}
        strokeDasharray="2 2"
        className="stroke-slate-400 dark:stroke-slate-500"
      />
      <path
        d={threshPath}
        fill="none"
        strokeWidth={1}
        strokeDasharray="2 2"
        className="stroke-orange-400 dark:stroke-orange-500"
      />

      <path
        d={sstPath}
        fill="none"
        strokeWidth={1.25}
        strokeLinejoin="round"
        strokeLinecap="round"
        className="stroke-slate-700 dark:stroke-slate-200"
      />

      {/* Invisible fat hit zones for hover tooltips. Native <title> only
          fires on painted pixels, and the visible 1 px strokes are nearly
          impossible to land on under preserveAspectRatio="none". These
          stroke="transparent" paths sit on top, are 8 viewBox-units wide
          (~6 px after stretch), and carry the per-line tooltip text. */}
      <path
        d={seasPath}
        fill="none"
        stroke="transparent"
        strokeWidth={8}
        style={{ pointerEvents: "stroke" }}
      >
        <title>
          30-year seasonal climatology (1991–2020 NOAA CoralTemp): the
          historical mean SST for each day-of-year. The line slopes with
          the season.
        </title>
      </path>
      <path
        d={threshPath}
        fill="none"
        stroke="transparent"
        strokeWidth={8}
        style={{ pointerEvents: "stroke" }}
      >
        <title>
          Marine heatwave threshold: the 90th percentile of historical SST
          for each day-of-year (Hobday et al. 2016, 1991–2020 baseline).
          SST above this line for ≥5 consecutive days is a heatwave.
        </title>
      </path>
      <path
        d={sstPath}
        fill="none"
        stroke="transparent"
        strokeWidth={8}
        style={{ pointerEvents: "stroke" }}
      >
        <title>Daily mean sea-surface temperature, last {n} days.</title>
      </path>
    </svg>
  );
}

function buildValuePath(
  series: DayAssessment[],
  xAt: (i: number) => number,
  yAt: (v: number) => number,
  pick: (d: DayAssessment) => number | null,
): string {
  let d = "";
  let pen = false;
  for (let i = 0; i < series.length; i++) {
    const v = pick(series[i]);
    if (v === null) {
      pen = false;
      continue;
    }
    const cmd = pen ? "L" : "M";
    d += `${cmd}${xAt(i).toFixed(2)} ${yAt(v).toFixed(2)} `;
    pen = true;
  }
  return d.trim();
}

/**
 * Polygons between the SST line and the day-by-day reference line (seas
 * for "below", thresh for "above"), one polygon per contiguous run.
 *
 * "above" runs are days where DayAssessment.aboveThreshold is true — the
 * same flag the Hobday detector uses, so the visual matches the card.
 * "below" runs are days where sst < seas.
 */
function buildBandFills(
  series: DayAssessment[],
  xAt: (i: number) => number,
  yAt: (v: number) => number,
  side: "above" | "below",
): string[] {
  const out: string[] = [];
  let runStart = -1;

  const refOf = (d: DayAssessment): number | null =>
    side === "above" ? d.thresh : d.seas;
  const matches = (d: DayAssessment): boolean => {
    if (d.sst === null) return false;
    const ref = refOf(d);
    if (ref === null) return false;
    return side === "above" ? d.aboveThreshold : d.sst < ref;
  };

  const flush = (endIdx: number) => {
    if (runStart < 0) return;
    let top = "";
    let bottom = "";
    for (let j = runStart; j <= endIdx; j++) {
      const v = series[j].sst;
      const ref = refOf(series[j]);
      if (v === null || ref === null) continue;
      const cmd = top ? "L" : "M";
      top += `${cmd}${xAt(j).toFixed(2)} ${yAt(v).toFixed(2)} `;
      bottom = `L${xAt(j).toFixed(2)} ${yAt(ref).toFixed(2)} ${bottom}`;
    }
    if (top) out.push((top + bottom + "Z").trim());
    runStart = -1;
  };

  for (let i = 0; i < series.length; i++) {
    if (matches(series[i])) {
      if (runStart < 0) runStart = i;
    } else {
      flush(i - 1);
    }
  }
  flush(series.length - 1);
  return out;
}

function buildSummary(series: DayAssessment[], regionName: string): string {
  const valid = series.filter(
    (d): d is DayAssessment & { sst: number } => d.sst !== null,
  );
  if (valid.length === 0) return `${regionName}: no SST data in window.`;
  const minV = Math.min(...valid.map((d) => d.sst));
  const maxV = Math.max(...valid.map((d) => d.sst));
  const aboveCount = valid.filter((d) => d.aboveThreshold).length;
  const startDate = series[0].date;
  const endDate = series[series.length - 1].date;
  const aboveSentence =
    aboveCount > 0
      ? ` ${aboveCount} ${aboveCount === 1 ? "day" : "days"} above threshold.`
      : "";
  return `${series.length}-day SST trend for ${regionName}: ${startDate} to ${endDate}. SST ranged from ${minV.toFixed(1)}°C to ${maxV.toFixed(1)}°C.${aboveSentence}`;
}
