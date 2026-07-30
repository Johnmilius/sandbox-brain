/**
 * Maps rows from the `events` timeline (migration 0009) into the home feed's
 * FeedItem shape. Once events exist this is the canonical feed source; the
 * home page falls back to its legacy per-table union until the migration
 * is applied.
 */

import { urlFor, isObjectType, OBJECT_TYPE_LABELS } from "@sandbox-brain/core";
import type { EventRow } from "@/lib/database.types";
import type { FeedItem } from "@/lib/home-digest";

/** Feed chip kind per object type (drives dot/chip colors). */
const KIND_BY_TYPE: Record<string, FeedItem["kind"]> = {
  note: "note",
  prompt: "prompt",
  time_entry: "time",
  idea: "idea",
  task: "task",
  project: "project",
  knowledge_item: "knowledge",
  agent: "agent",
  academy_module: "academy",
  academy_outcome: "academy",
  profile: "project",
};

/** Section name shown as the context chip when the event has no target. */
const SECTION_BY_TYPE: Record<string, string> = {
  note: "notes",
  prompt: "prompt library",
  idea: "ideas",
  task: "tasks",
  project: "projects",
  knowledge_item: "brain",
  agent: "agents",
  academy_module: "academy",
  academy_outcome: "growth",
  time_entry: "time",
};

/** Past-tense feed phrasing per verb. */
const VERB_LABEL: Record<string, string> = {
  created: "created",
  updated: "updated",
  deleted: "deleted",
  completed: "completed",
  started: "started a timer on",
  stopped: "stopped",
  logged_time: "logged time on",
  linked: "linked",
  rated: "rated",
  favorited: "favorited",
  promoted: "promoted",
  claimed: "claimed",
  ingested: "ingested",
};

export function eventToFeedItem(
  e: Pick<
    EventRow,
    | "id"
    | "actor_id"
    | "verb"
    | "object_type"
    | "object_id"
    | "object_label"
    | "target_type"
    | "target_id"
    | "target_label"
    | "occurred_at"
  >,
  actorName: (id: string) => string,
): FeedItem {
  const timeish = e.verb === "logged_time" || e.verb === "started";
  // Time events read better anchored on the project they touched.
  const objectLabel = timeish
    ? e.target_label ?? "a project"
    : e.object_label ??
      OBJECT_TYPE_LABELS[isObjectType(e.object_type) ? e.object_type : "note"];
  const objectUrl = isObjectType(e.object_type)
    ? urlFor({ type: e.object_type, id: e.object_id })
    : null;
  // Deleted objects have no page anymore — link to their section instead.
  const href =
    (timeish
      ? "/time"
      : e.verb === "deleted"
        ? objectUrl?.replace(`/${e.object_id}`, "")
        : objectUrl) ?? "/";
  const context = timeish
    ? "time"
    : e.target_label ?? SECTION_BY_TYPE[e.object_type] ?? e.object_type;

  return {
    key: `event:${e.id}`,
    actorId: e.actor_id ?? "",
    actor: e.actor_id ? actorName(e.actor_id) : "System",
    verb: VERB_LABEL[e.verb] ?? e.verb.replace(/_/g, " "),
    object: objectLabel,
    context,
    href,
    kind: KIND_BY_TYPE[e.object_type] ?? "note",
    at: e.occurred_at,
  };
}

/**
 * Object identities ("<type>:<id>") the timeline already covers.
 *
 * The home feed unions the timeline with the legacy per-table query so history
 * predating migration 0009 (and rows from any client that writes without
 * emitting) still shows. This set is what lets the legacy side skip objects the
 * timeline already reports, instead of listing the same action twice.
 */
export function eventedObjectKeys(
  rows: Pick<EventRow, "object_type" | "object_id">[],
): Set<string> {
  return new Set(rows.map((e) => `${e.object_type}:${e.object_id}`));
}
