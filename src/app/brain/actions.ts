"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { setTagsForEntity } from "@/lib/tags";
import type { Json, KnowledgeKind } from "@/lib/database.types";

export type KnowledgeInput = {
  kind: KnowledgeKind;
  title: string;
  description?: string;
  content?: string;
  data?: Record<string, Json>;
  url?: string;
  filePath?: string | null; // set by the client after uploading to storage
  projectId?: string | null;
};

function toRow(input: KnowledgeInput) {
  return {
    kind: input.kind,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    content: input.content || null,
    data: (input.data ?? {}) as Json,
    url: input.url?.trim() || null,
    file_path: input.filePath ?? null,
    project_id: input.projectId || null,
  };
}

export async function createKnowledgeItem(
  input: KnowledgeInput,
  tagNames: string[],
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("knowledge_items")
    .insert(toRow(input))
    .select("id")
    .single();
  if (error) return { error: error.message };

  const tagResult = await setTagsForEntity(
    supabase,
    "knowledge_item",
    data.id,
    tagNames,
  );
  if (tagResult.error) return tagResult;

  revalidatePath("/brain");
  revalidatePath("/graph");
  return { error: null };
}

export async function updateKnowledgeItem(
  id: string,
  input: KnowledgeInput,
  tagNames: string[],
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("knowledge_items")
    .update(toRow(input))
    .eq("id", id);
  if (error) return { error: error.message };

  const tagResult = await setTagsForEntity(supabase, "knowledge_item", id, tagNames);
  if (tagResult.error) return tagResult;

  revalidatePath("/brain");
  revalidatePath("/graph");
  return { error: null };
}

export async function deleteKnowledgeItem(
  id: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("knowledge_items")
    .select("file_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("knowledge_items").delete().eq("id", id);
  if (error) return { error: error.message };

  if (item?.file_path) {
    await supabase.storage.from("files").remove([item.file_path]);
  }
  await supabase
    .from("taggables")
    .delete()
    .eq("entity_type", "knowledge_item")
    .eq("entity_id", id);

  revalidatePath("/brain");
  revalidatePath("/graph");
  return { error: null };
}
