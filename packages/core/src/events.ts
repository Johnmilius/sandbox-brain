/**
 * The events timeline (supabase/migrations/0009_events.sql).
 *
 * Every write path — app server actions and MCP tools — emits one event.
 * The home activity feed, per-object History panels, and brain_timeline are
 * derived from this log; it is never hand-maintained.
 */

import type { MinimalDbClient } from "./db.js";
import type { ObjectType } from "./object-types.js";

/**
 * Verb vocabulary. Free text in the database (growing this list must never
 * need DDL) — this union is the single place to extend it.
 */
export const EVENT_VERBS = [
  "created",
  "updated",
  "deleted",
  "completed",
  "started",
  "stopped",
  "logged_time",
  "linked",
  "rated",
  "favorited",
  "promoted",
  "claimed",
  "ingested",
] as const;

export type EventVerb = (typeof EVENT_VERBS)[number];

export type EventSource = "app" | "mcp" | "connector";

export type EventObject = {
  type: ObjectType;
  id: string;
  /** Denormalized at emit time so the feed renders without joins. */
  label?: string | null;
};

export type EventInput = {
  verb: EventVerb;
  object: EventObject;
  target?: EventObject;
  /** Scopes the "my projects" feed filter. */
  projectId?: string | null;
  source?: EventSource;
  /** Omit to use the DB default (auth.uid()); pass explicitly in MCP service-role mode. */
  actorId?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Append one event to the timeline. Never throws: a failed event write must
 * not break the user action that triggered it — failures are logged to
 * stderr (safe for MCP stdio servers) and swallowed.
 */
export async function emitEvent(
  db: MinimalDbClient,
  input: EventInput,
): Promise<void> {
  try {
    const { error } = await db.from("events").insert({
      verb: input.verb,
      object_type: input.object.type,
      object_id: input.object.id,
      object_label: input.object.label ?? null,
      target_type: input.target?.type ?? null,
      target_id: input.target?.id ?? null,
      target_label: input.target?.label ?? null,
      project_id: input.projectId ?? null,
      source: input.source ?? "app",
      metadata: input.metadata ?? {},
      ...(input.actorId ? { actor_id: input.actorId } : {}),
    });
    if (error) {
      console.error(
        `emitEvent failed (${input.verb} ${input.object.type}:${input.object.id}): ${error.message}`,
      );
    }
  } catch (err) {
    console.error("emitEvent failed:", err);
  }
}
