import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

/** Tags are stored lowercase so the unique index doubles as case-insensitive dedupe. */
export function normalizeTagNames(names: string[]): string[] {
  return [...new Set(names.map((n) => n.trim().toLowerCase()).filter(Boolean))];
}

/**
 * Replace the tag set on an entity: upserts missing tags by name, then
 * rewrites the entity's taggables rows. Shared by prompts, notes, and
 * knowledge items.
 */
export async function setTagsForEntity(
  supabase: Client,
  entityType: string,
  entityId: string,
  tagNames: string[],
): Promise<{ error: string | null }> {
  const names = normalizeTagNames(tagNames);

  const { error: clearError } = await supabase
    .from("taggables")
    .delete()
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);
  if (clearError) return { error: clearError.message };

  if (names.length === 0) return { error: null };

  const { data: existing, error: findError } = await supabase
    .from("tags")
    .select("id, name")
    .in("name", names);
  if (findError) return { error: findError.message };

  const existingByName = new Map(existing.map((t) => [t.name, t.id]));
  const missing = names.filter((n) => !existingByName.has(n));

  if (missing.length > 0) {
    const { data: created, error: createError } = await supabase
      .from("tags")
      .insert(missing.map((name) => ({ name })))
      .select("id, name");
    if (createError && createError.code !== "23505") {
      return { error: createError.message };
    }
    for (const t of created ?? []) existingByName.set(t.name, t.id);
    if (createError) {
      // Lost a race with a concurrent insert — the tags exist now, re-read them.
      const { data: refetched } = await supabase
        .from("tags")
        .select("id, name")
        .in("name", names);
      for (const t of refetched ?? []) existingByName.set(t.name, t.id);
    }
  }

  const { error: attachError } = await supabase.from("taggables").insert(
    names.map((name) => ({
      tag_id: existingByName.get(name)!,
      entity_type: entityType,
      entity_id: entityId,
    })),
  );
  if (attachError) return { error: attachError.message };

  return { error: null };
}

/** Map of entity_id -> tag names for one entity type. */
export async function getTagsByEntity(
  supabase: Client,
  entityType: string,
): Promise<Map<string, string[]>> {
  const { data } = await supabase
    .from("taggables")
    .select("entity_id, tag_id")
    .eq("entity_type", entityType);
  const { data: tags } = await supabase.from("tags").select("id, name");

  const tagName = new Map((tags ?? []).map((t) => [t.id, t.name]));
  const result = new Map<string, string[]>();
  for (const row of data ?? []) {
    const name = tagName.get(row.tag_id);
    if (!name) continue;
    const list = result.get(row.entity_id) ?? [];
    list.push(name);
    result.set(row.entity_id, list);
  }
  return result;
}
