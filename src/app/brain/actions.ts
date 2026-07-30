"use server";

import { revalidatePath } from "next/cache";
import { emitEvent } from "@sandbox-brain/core";
import { createClient } from "@/lib/supabase/server";
import { setTagsForEntity } from "@/lib/tags";
import { readManifest } from "@/lib/knowledge-files";
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

  await emitEvent(supabase, {
    verb: "created",
    object: { type: "knowledge_item", id: data.id, label: input.title.trim() },
    projectId: input.projectId || null,
    metadata: { kind: input.kind },
  });
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

  await emitEvent(supabase, {
    verb: "updated",
    object: { type: "knowledge_item", id, label: input.title.trim() },
    projectId: input.projectId || null,
    metadata: { kind: input.kind },
  });
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
    .select("title, kind, project_id, file_path, data")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("knowledge_items").delete().eq("id", id);
  if (error) return { error: error.message };

  await emitEvent(supabase, {
    verb: "deleted",
    object: { type: "knowledge_item", id, label: item?.title },
    projectId: item?.project_id ?? null,
    metadata: item?.kind ? { kind: item.kind } : undefined,
  });

  // Clean up storage: the legacy single file and every manifest file.
  const paths = [
    ...(item?.file_path ? [item.file_path] : []),
    ...readManifest(item?.data).map((f) => f.path),
  ];
  if (paths.length > 0) {
    await supabase.storage.from("files").remove(paths);
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
