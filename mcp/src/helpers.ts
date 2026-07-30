/**
 * Shared helpers for tools: tagging, wiki-link sync, and formatting.
 * Wiki-link logic lives in @sandbox-brain/core (shared with the web app).
 * Tag logic still mirrors src/lib/tags.ts — keep in sync until it moves
 * to core too.
 */

import {
  emitEvent,
  extractWikiLinkTitles,
  syncWikiLinks as coreSyncWikiLinks,
  type EventInput,
} from "@sandbox-brain/core";
import { getActor, supabase } from "./context.js";

export { extractWikiLinkTitles };

/**
 * Emit a timeline event attributed to the configured actor with
 * source='mcp'. Never throws (see @sandbox-brain/core emitEvent).
 */
export async function emitMcpEvent(
  input: Omit<EventInput, "source" | "actorId">,
): Promise<void> {
  const actor = await getActor();
  await emitEvent(supabase(), { ...input, source: "mcp", actorId: actor.id });
}

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
// Wiki-links (implementation in @sandbox-brain/core, shared with the web app)
// ---------------------------------------------------------------------------

/** Rebuild a note's outgoing wiki edges in the links table. */
export async function syncWikiLinks(noteId: string, body: string): Promise<void> {
  const actor = await getActor();
  await coreSyncWikiLinks(supabase(), noteId, body, { createdBy: actor.id });
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
