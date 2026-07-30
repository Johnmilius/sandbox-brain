/**
 * Obsidian-style [[wiki-link]] handling — single implementation lives in
 * @sandbox-brain/core (packages/core/src/wiki-links.ts); this module re-exports
 * it so existing `@/lib/wiki-links` imports keep working.
 */
export {
  extractWikiLinkTitles,
  rewriteWikiLinks,
  syncWikiLinks,
} from "@sandbox-brain/core";
