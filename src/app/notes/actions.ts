"use server";

import { revalidatePath } from "next/cache";
import { emitEvent } from "@sandbox-brain/core";
import { createClient } from "@/lib/supabase/server";
import { syncWikiLinks } from "@/lib/wiki-links";

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

  await emitEvent(supabase, {
    verb: "created",
    object: { type: "note", id: data.id, label: title.trim() },
  });
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

  await emitEvent(supabase, {
    verb: "updated",
    object: { type: "note", id, label: input.title.trim() },
  });
  revalidatePath("/notes");
  revalidatePath(`/notes/${id}`);
  revalidatePath("/graph");
  return { error: null };
}

export async function deleteNote(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  // Grab the title before the row disappears — the timeline keeps the label.
  const { data: note } = await supabase
    .from("notes")
    .select("title")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) return { error: error.message };

  await emitEvent(supabase, {
    verb: "deleted",
    object: { type: "note", id, label: note?.title },
  });

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
