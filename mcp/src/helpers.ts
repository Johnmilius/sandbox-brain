/**
 * Shared helpers for tools: tagging, wiki-link sync, and formatting.
 * Tag + wiki-link logic mirrors the web app (src/lib/tags.ts and
 * src/lib/wiki-links.ts) — keep them in sync if either changes.
 */

import { getActor, supabase } from "./context.js";

export const CHARACTER_LIMIT = 25000;

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export function normalizeTagNames(names: string[]): string[] {
  return [...new Set(names.map((n) => n.trim().toLowerCase()).filter(Boolean))];
}

export async function setTagsForEntity(
  entityType: string,
  entityId: string,
  tagNames: string[],
): Promise<void> {
  const names = normalizeTagNames(tagNames);
  const db = supabase();

  await db
    .from("taggables")
    .delete()
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);
  if (names.length === 0) return;

  const { data: existing, error } = await db
    .from("tags")
    .select("id, name")
    .in("name", names);
  if (error) throw new Error(`Couldn't load tags: ${error.message}`);

  const idByName = new Map(
    (existing ?? []).map((t: { id: string; name: string }) => [t.name, t.id]),
  );
  const missing = names.filter((n) => !idByName.has(n));
  if (missing.length > 0) {
    const { data: created, error: createError } = await db
      .from("tags")
      .insert(missing.map((name) => ({ name })))
      .select("id, name");
    if (createError && createError.code !== "23505") {
      throw new Error(`Couldn't create tags: ${createError.message}`);
    }
    for (const t of created ?? []) idByName.set(t.name, t.id);
    if (createError) {
      // Lost a race with a concurrent insert — the tags exist now, re-read them.
      const { data: refetched } = await db
        .from("tags")
        .select("id, name")
        .in("name", names);
      for (const t of refetched ?? []) idByName.set(t.name, t.id);
    }
  }

  const { error: attachError } = await db.from("taggables").insert(
    names.map((name) => ({
      tag_id: idByName.get(name)!,
      entity_type: entityType,
      entity_id: entityId,
    })),
  );
  if (attachError) throw new Error(`Couldn't attach tags: ${attachError.message}`);
}

// ---------------------------------------------------------------------------
// Wiki-links (mirrors src/lib/wiki-links.ts in the web app)
// ---------------------------------------------------------------------------

const WIKI_LINK_RE = /\[\[([^\[\]|]+)(?:\|([^\[\]]+))?\]\]/g;

export function extractWikiLinkTitles(body: string): string[] {
  const titles = new Set<string>();
  for (const match of body.matchAll(WIKI_LINK_RE)) {
    const title = match[1].trim();
    if (title) titles.add(title);
  }
  return [...titles];
}

/** Rebuild a note's outgoing wiki edges in the links table. */
export async function syncWikiLinks(noteId: string, body: string): Promise<void> {
  const db = supabase();
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
    (targets ?? []).map((n: { id: string; title: string }) => [
      n.title.toLowerCase(),
      n.id,
    ]),
  );

  const actor = await getActor();
  const rows = titles
    .map((t) => idByLower.get(t.toLowerCase()))
    .filter((id): id is string => Boolean(id))
    .map((targetId) => ({
      source_type: "note",
      source_id: noteId,
      target_type: "note",
      target_id: targetId,
      relationship: "wiki",
      created_by: actor.id,
    }));
  if (rows.length > 0) {
    const { error } = await db.from("links").insert(rows);
    if (error) throw new Error(`Couldn't save wiki links: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Formatting + tool result helpers
// ---------------------------------------------------------------------------

export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

export function ok(text: string): ToolResult {
  const truncated =
    text.length > CHARACTER_LIMIT
      ? text.slice(0, CHARACTER_LIMIT) +
        "\n\n[Truncated — narrow the query or lower the limit for full results.]"
      : text;
  return { content: [{ type: "text", text: truncated }] };
}

export function fail(message: string): ToolResult {
  return { isError: true, content: [{ type: "text", text: `Error: ${message}` }] };
}

/** Wrap a handler so thrown errors become actionable tool errors. */
export function guarded<A extends unknown[]>(
  fn: (...args: A) => Promise<ToolResult>,
): (...args: A) => Promise<ToolResult> {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }
  };
}
