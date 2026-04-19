/**
 * Single source of truth for the deployed site's base URL.
 *
 * Read by `metadataBase` in layout.tsx (for absolute OG / Twitter URLs),
 * by sitemap.ts, and by robots.ts. Override via `NEXT_PUBLIC_SITE_URL`
 * for preview deploys or local-prod testing.
 */

export const SITE_URL: string =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://heatwave.marulho.co";
