import type { RegionState } from "@/lib/hobday";

/**
 * Category → Tailwind colour tokens.
 * Using arbitrary-value classes for ringing the top bar; the card body stays
 * neutral so the data doesn't scream. Colour logic:
 *   - Below climatology: cool slate blue
 *   - Above climatology but below threshold: warm but not alarming
 *   - Moderate → Extreme: graduated warm scale
 */
const categoryStyles: Record<
  string,
  { bar: string; chip: string; label: string }
> = {
  Moderate: {
    bar: "bg-amber-400",
    chip: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
    label: "Moderate",
  },
  Strong: {
    bar: "bg-orange-500",
    chip: "bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-200",
    label: "Strong",
  },
  Severe: {
    bar: "bg-red-600",
    chip: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200",
    label: "Severe",
  },
  Extreme: {
    bar: "bg-fuchsia-700",
    chip: "bg-fuchsia-100 text-fuchsia-900 dark:bg-fuchsia-900/40 dark:text-fuchsia-200",
    label: "Extreme",
  },
};

export function RegionCard({ state }: { state: RegionState }) {
  const { region, latest, activeEvent, hasClimatology } = state;

  const sstStr = latest?.sst?.toFixed(1) ?? "—";
  const anomaly = latest?.anomaly;
  const aboveThresh = latest?.aboveThreshold ?? false;

  const barStyle = activeEvent
    ? categoryStyles[activeEvent.category].bar
    : aboveThresh
      ? "bg-amber-300"
      : anomaly !== null && anomaly !== undefined && anomaly > 0
        ? "bg-yellow-200"
        : "bg-sky-300";

  return (
    <article className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className={`h-1.5 ${barStyle}`} />
      <div className="p-5">
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              {region.name}
            </h3>
            {region.altName && (
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {region.altName}
              </p>
            )}
          </div>
          {activeEvent && (
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${categoryStyles[activeEvent.category].chip}`}
            >
              {activeEvent.category}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
          {region.locator}
        </p>

        <div className="mt-4 flex items-baseline gap-1.5">
          <span className="font-mono text-4xl font-light tabular-nums tracking-tight text-slate-900 dark:text-slate-50">
            {sstStr}
          </span>
          <span className="text-base text-slate-500 dark:text-slate-400">
            °C
          </span>
        </div>

        <div className="mt-2 space-y-1 text-sm">
          {hasClimatology && anomaly !== null && anomaly !== undefined ? (
            <p
              className={
                anomaly >= 0
                  ? "text-orange-700 dark:text-orange-300"
                  : "text-sky-700 dark:text-sky-300"
              }
            >
              <span className="font-mono tabular-nums">
                {anomaly >= 0 ? "+" : ""}
                {anomaly.toFixed(1)}°C
              </span>{" "}
              <span className="text-slate-500 dark:text-slate-400">
                vs baseline
              </span>
            </p>
          ) : !hasClimatology ? (
            <p className="text-xs text-slate-400 italic dark:text-slate-500">
              Baseline CSV not loaded
            </p>
          ) : null}

          {activeEvent ? (
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Day <span className="font-semibold">{activeEvent.duration}</span>{" "}
              of heatwave · peak{" "}
              <span className="font-mono tabular-nums">
                +{activeEvent.peakAnomaly.toFixed(1)}°C
              </span>
            </p>
          ) : aboveThresh ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Above threshold — not yet ≥5 days
            </p>
          ) : hasClimatology ? (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              No active heatwave
            </p>
          ) : null}
        </div>

        {latest?.thresh !== null && latest?.thresh !== undefined && latest.seas !== null && latest.seas !== undefined && (
          <div className="mt-3 border-t border-slate-100 pt-2 font-mono text-[10px] tabular-nums text-slate-400 dark:border-slate-800 dark:text-slate-600">
            baseline {latest.seas.toFixed(1)}° · threshold{" "}
            {latest.thresh.toFixed(1)}°
          </div>
        )}
      </div>
    </article>
  );
}
