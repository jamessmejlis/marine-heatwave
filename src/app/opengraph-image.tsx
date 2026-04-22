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
          backgroundColor: "#04101c",
          color: "#f5efe4",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 22,
            letterSpacing: 4,
            textTransform: "uppercase",
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
            fontWeight: 600,
          }}
        >
          <span style={{ color: "#4eb5af" }}>Marine Heatwave Live NZ</span>
          <span style={{ color: "#94a3b8" }}>Built by Marulho</span>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 64,
            lineHeight: 1.05,
            fontWeight: 500,
            color: "#f5efe4",
            letterSpacing: -0.5,
            fontFamily: "ui-serif, Georgia, 'Times New Roman', serif",
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
          <span style={{ color: "#4eb5af" }}>How warm is the sea today?</span>
          <span>{host}</span>
        </div>
      </div>
    ),
    size,
  );
}
