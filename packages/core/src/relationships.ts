/**
 * Typed-relationship vocabulary for the `links` table.
 *
 * Today only 'wiki' (materialized from [[wiki-links]]) and 'related' (the
 * column default) are written. The rest are the planned vocabulary from
 * docs/vision/ROADMAP.md Phase 2 — defined here so all packages share one
 * list; Phase 2 moves it into a `relationship_types` registry table.
 */

export const RELATIONSHIPS = [
  "related",
  "wiki",
  "promoted_to",
  "references",
  "implements",
  "blocks",
  "duplicates",
  "inspired_by",
  "discussed_in",
  "decided_in",
  "affects",
  "produced",
  "owns",
  "touches",
  "belongs_to",
] as const;

export type Relationship = (typeof RELATIONSHIPS)[number];
