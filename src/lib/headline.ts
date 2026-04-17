/**
 * Build the live headline sentence shared by the home page, the dynamic
 * meta description, and the OG image. Single source of truth so the three
 * surfaces never drift.
 */

import type { RegionState } from "./hobday";

export function buildHeadline(states: RegionState[]): string {
  const active = states.filter((s) => s.activeEvent !== null);

  if (active.length === 0) {
    return "No NZ regions currently meet Hobday marine-heatwave criteria.";
  }

  const longest = active
    .slice()
    .sort((a, b) => b.activeEvent!.duration - a.activeEvent!.duration)[0];

  const head = `${active.length} ${active.length === 1 ? "region" : "regions"} currently in marine heatwave conditions.`;

  if (!longest) return head;

  return `${head} Longest active event: ${longest.activeEvent!.duration} days in ${longest.region.name} (${longest.activeEvent!.category} category).`;
}
