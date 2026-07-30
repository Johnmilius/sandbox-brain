/**
 * Obsidian-style [[wiki-link]] handling for note bodies.
 * Links resolve against note titles, case-insensitively.
 *
 * Single source of truth — consumed by both the web app (src/lib/wiki-links.ts
 * re-export, src/app/notes/actions.ts) and the MCP server (mcp/src/helpers.ts).
 */

import type { MinimalDbClient } from "./db.js";

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

/**
 * Rebuild a note's outgoing wiki edges in the links table.
 * Pass `createdBy` when the client has no auth context (MCP service-role
 * mode); otherwise the links.created_by default (auth.uid()) applies.
 */
export async function syncWikiLinks(
  db: MinimalDbClient,
  noteId: string,
  body: string,
  opts: { createdBy?: string } = {},
): Promise<void> {
  await db
    .from("links")
    .delete()
    .eq("source_type", "note")
    .eq("source_id", noteId)
    .eq("relationship", "wiki");

  const titles = extractWikiLinkTitles(body);
  if (titles.length === 0) return;

  const { data: targets } = await db
    .from("notes")
    .select("id, title")
    .neq("id", noteId);
  const idByLower = new Map(
    ((targets ?? []) as { id: string; title: string }[]).map((n) => [
      n.title.toLowerCase(),
      n.id,
    ]),
  );

  const rows = titles
    .map((t) => idByLower.get(t.toLowerCase()))
    .filter((id): id is string => Boolean(id))
    .map((targetId) => ({
      source_type: "note",
      source_id: noteId,
      target_type: "note",
      target_id: targetId,
      relationship: "wiki",
      ...(opts.createdBy ? { created_by: opts.createdBy } : {}),
    }));
  if (rows.length > 0) {
    const { error } = await db.from("links").insert(rows);
    if (error) throw new Error(`Couldn't save wiki links: ${error.message}`);
  }
}
