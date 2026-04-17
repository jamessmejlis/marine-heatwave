import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Only the home page ships in v1.1. Per-region permalinks (/r/<id>) are a
 * v1.2 item; when they land, loop regions from `@/lib/regions` and append
 * one `{ url: `${SITE_URL}/r/${region.id}`, changeFrequency: "hourly" }`
 * entry per region.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1,
    },
  ];
}
