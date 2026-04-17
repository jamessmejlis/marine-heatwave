import { ImageResponse } from "next/og";
import { regions } from "@/lib/regions";
import { fetchAllSst } from "@/lib/sst";
import { loadClimatology } from "@/lib/climatology";
import { loadCalibration } from "@/lib/calibration";
import { classifyRegion } from "@/lib/hobday";
import { buildHeadline } from "@/lib/headline";
import { SITE_URL } from "@/lib/site";

export const runtime = "nodejs";
export const alt = "Marine Heatwave Live NZ — live status for 10 NZ coastal regions";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Dynamic OG image. Same data path as the home page + generateMetadata;
 * Next's fetch cache dedupes, and revalidation is inherited from the
 * page's ISR window.
 */
export default async function OpenGraphImage() {
  const [sstSeries, climos, calibrations] = await Promise.all([
    fetchAllSst(regions),
    Promise.all(regions.map((r) => loadClimatology(r.id))),
    Promise.all(regions.map((r) => loadCalibration(r.id))),
  ]);
  const states = sstSeries.map((sst, i) =>
    classifyRegion(sst, climos[i], calibrations[i]),
  );
  const headline = buildHeadline(states);
  const host = new URL(SITE_URL).host;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          backgroundImage:
            "linear-gradient(180deg, #0f172a 0%, #164e63 60%, #0369a1 100%)",
          color: "#f1f5f9",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 22,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: "#cbd5e1",
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
            fontWeight: 600,
          }}
        >
          Marulho · Marine Heatwave Live NZ
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 58,
            lineHeight: 1.15,
            fontWeight: 600,
            color: "#ffffff",
            letterSpacing: -0.5,
          }}
        >
          {headline}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 22,
            color: "#94a3b8",
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
          }}
        >
          <span>Sea temperature, honestly reported.</span>
          <span>{host}</span>
        </div>
      </div>
    ),
    size,
  );
}
