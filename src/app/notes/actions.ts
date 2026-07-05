"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { extractWikiLinkTitles } from "@/lib/wiki-links";
import type { Database } from "@/lib/database.types";

/** Rebuild this note's outgoing wiki edges in the links table. */
async function syncWikiLinks(
  supabase: SupabaseClient<Database>,
  noteId: string,
  body: string,
) {
  await supabase
    .from("links")
    .delete()
    .eq("source_type", "note")
    .eq("source_id", noteId)
    .eq("relationship", "wiki");

  const titles = extractWikiLinkTitles(body);
  if (titles.length === 0) return;

  const { data: targets } = await supabase
    .from("notes")
    .select("id, title")
    .neq("id", noteId);
  const idByLower = new Map(
    (targets ?? []).map((n) => [n.title.toLowerCase(), n.id]),
  );

  const rows = titles
    .map((t) => idByLower.get(t.toLowerCase()))
    .filter((id): id is string => Boolean(id))
    .map((targetId) => ({
      source_type: "note" as const,
      source_id: noteId,
      target_type: "note" as const,
      target_id: targetId,
      relationship: "wiki",
    }));
  if (rows.length > 0) await supabase.from("links").insert(rows);
}

export async function createNote(
  title: string,
  body = "",
): Promise<{ id: string | null; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notes")
    .insert({ title: title.trim(), body })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") {
      return { id: null, error: "A note with that title already exists." };
    }
    return { id: null, error: error.message };
  }

  // Body may already contain [[wiki-links]] — wire up graph edges on create.
  if (body.trim() !== "") await syncWikiLinks(supabase, data.id, body);

  revalidatePath("/notes");
  revalidatePath("/graph");
  return { id: data.id, error: null };
}

export async function updateNote(
  id: string,
  input: { title: string; body: string },
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notes")
    .update({ title: input.title.trim(), body: input.body })
    .eq("id", id);
  if (error) {
    if (error.code === "23505") {
      return { error: "A note with that title already exists." };
    }
    return { error: error.message };
  }

  await syncWikiLinks(supabase, id, input.body);

  revalidatePath("/notes");
  revalidatePath(`/notes/${id}`);
  revalidatePath("/graph");
  return { error: null };
}

export async function deleteNote(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) return { error: error.message };

  // Remove graph edges touching this note.
  await supabase
    .from("links")
    .delete()
    .eq("source_type", "note")
    .eq("source_id", id);
  await supabase
    .from("links")
    .delete()
    .eq("target_type", "note")
    .eq("target_id", id);

  revalidatePath("/notes");
  revalidatePath("/graph");
  return { error: null };
}
