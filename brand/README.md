# Brand snapshot

**Snapshots:** [Marulho Brand System](../../marulho-ventures/brand/brand-system.md) **v1.0** (2026-04-19)
**Register:** Report (paper-first, flips in dark mode)
**Applied in:** [`src/app/globals.css`](../src/app/globals.css) · [`src/app/layout.tsx`](../src/app/layout.tsx)

This ship is the origin of the brand system — the typography, palette, and patterns were extracted from this project's editorial design pass and promoted to canonical. See the brand-system changelog entry for v1.0.

## When to re-sync

If `marulho-ventures/brand/` bumps to a new version with changes relevant to this ship, decide deliberately whether to re-sync now or later. Process:

1. Diff this ship's `src/app/globals.css` against the current [`report.globals.css`](../../marulho-ventures/brand/report.globals.css)
2. Apply relevant changes
3. Update the version pointer at the top of this file
4. Test in dev, then push
