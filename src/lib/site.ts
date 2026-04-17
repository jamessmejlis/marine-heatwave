/**
 * Single source of truth for the deployed site's base URL.
 *
 * Read by `metadataBase` in layout.tsx (for absolute OG / Twitter URLs),
 * by sitemap.ts, and by robots.ts. In dev and absent an env var, this
 * resolves to the ROADMAP Open-Question candidate subdomain — swap via
 * `NEXT_PUBLIC_SITE_URL` once the actual domain is picked.
 */

export const SITE_URL: string =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://marine-heatwave.marulho.app";
