/**
 * The object contract: every entity in the Brain is addressed as
 * (object_type, object_id). Mirrors the `object_types` registry table
 * (supabase/migrations/0008_object_registry.sql) — when you register a new
 * type there, add it here too (see docs/playbook-new-object-type.md).
 */

export const OBJECT_TYPES = [
  "project",
  "note",
  "prompt",
  "knowledge_item",
  "profile",
  "time_entry",
  "agent",
  "academy_module",
  "academy_outcome",
  "idea",
  "task",
] as const;

export type ObjectType = (typeof OBJECT_TYPES)[number];

export type ObjectRef = {
  type: ObjectType;
  id: string;
};

export function isObjectType(value: string): value is ObjectType {
  return (OBJECT_TYPES as readonly string[]).includes(value);
}

/** Human-readable singular label per type (mirrors object_types.label). */
export const OBJECT_TYPE_LABELS: Record<ObjectType, string> = {
  project: "Project",
  note: "Note",
  prompt: "Prompt",
  knowledge_item: "Knowledge item",
  profile: "Person",
  time_entry: "Time entry",
  agent: "Agent",
  academy_module: "Academy module",
  academy_outcome: "Learning outcome",
  idea: "Idea",
  task: "Task",
};

/**
 * App route per type (mirrors object_types.url_pattern).
 * '{id}' is replaced with the object id; null = no page for this type.
 */
const OBJECT_TYPE_URLS: Record<ObjectType, string | null> = {
  project: "/projects",
  note: "/notes/{id}",
  prompt: "/prompts",
  knowledge_item: "/brain",
  profile: null,
  time_entry: "/time",
  agent: "/agents",
  academy_module: "/academy/{id}",
  academy_outcome: "/academy",
  idea: "/ideas/{id}",
  task: "/tasks",
};

export function urlFor(ref: ObjectRef): string | null {
  const pattern = OBJECT_TYPE_URLS[ref.type];
  return pattern ? pattern.replace("{id}", ref.id) : null;
}

/** Canonical `type:id` key, used as graph node ids and cache keys. */
export function nodeKey(ref: ObjectRef): string {
  return `${ref.type}:${ref.id}`;
}

export function parseNodeKey(key: string): ObjectRef | null {
  const colon = key.indexOf(":");
  if (colon === -1) return null;
  const type = key.slice(0, colon);
  const id = key.slice(colon + 1);
  if (!isObjectType(type) || !id) return null;
  return { type, id };
}
