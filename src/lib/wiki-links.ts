/**
 * Obsidian-style [[wiki-link]] handling for note bodies.
 * Links resolve against note titles, case-insensitively.
 */

const WIKI_LINK_RE = /\[\[([^\[\]|]+)(?:\|([^\[\]]+))?\]\]/g;

/** Distinct link target titles found in a markdown body. */
export function extractWikiLinkTitles(body: string): string[] {
  const titles = new Set<string>();
  for (const match of body.matchAll(WIKI_LINK_RE)) {
    const title = match[1].trim();
    if (title) titles.add(title);
  }
  return [...titles];
}

/**
 * Rewrite [[Title]] / [[Title|label]] into markdown links to /notes/<id>
 * using the provided lowercase-title -> id map. Unresolved links become
 * plain emphasized text so they read as "not written yet".
 */
export function rewriteWikiLinks(
  body: string,
  idByLowerTitle: Map<string, string>,
): string {
  return body.replace(WIKI_LINK_RE, (_match, rawTitle: string, rawLabel?: string) => {
    const title = rawTitle.trim();
    const label = rawLabel?.trim() || title;
    const id = idByLowerTitle.get(title.toLowerCase());
    return id ? `[${label}](/notes/${id})` : `*${label}*`;
  });
}
