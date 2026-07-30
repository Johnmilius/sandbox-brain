"use server";

import { revalidatePath } from "next/cache";
import { emitEvent } from "@sandbox-brain/core";
import { createClient } from "@/lib/supabase/server";
import { setTagsForEntity } from "@/lib/tags";

export type PromptInput = {
  title: string;
  promptText: string;
  responseNotes?: string;
  aiTool?: string;
  rating?: number | null;
  projectId?: string | null;
};

export async function createPrompt(
  input: PromptInput,
  tagNames: string[],
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prompts")
    .insert({
      title: input.title.trim(),
      prompt_text: input.promptText,
      response_notes: input.responseNotes?.trim() || null,
      ai_tool: input.aiTool?.trim().toLowerCase() || null,
      rating: input.rating ?? null,
      project_id: input.projectId || null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const tagResult = await setTagsForEntity(supabase, "prompt", data.id, tagNames);
  if (tagResult.error) return tagResult;

  await emitEvent(supabase, {
    verb: "created",
    object: { type: "prompt", id: data.id, label: input.title.trim() },
    projectId: input.projectId || null,
  });
  revalidatePath("/prompts");
  return { error: null };
}

export async function updatePrompt(
  id: string,
  input: PromptInput,
  tagNames: string[],
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("prompts")
    .update({
      title: input.title.trim(),
      prompt_text: input.promptText,
      response_notes: input.responseNotes?.trim() || null,
      ai_tool: input.aiTool?.trim().toLowerCase() || null,
      rating: input.rating ?? null,
      project_id: input.projectId || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  const tagResult = await setTagsForEntity(supabase, "prompt", id, tagNames);
  if (tagResult.error) return tagResult;

  await emitEvent(supabase, {
    verb: "updated",
    object: { type: "prompt", id, label: input.title.trim() },
    projectId: input.projectId || null,
  });
  revalidatePath("/prompts");
  return { error: null };
}

export async function togglePromptFavorite(
  id: string,
  value: boolean,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prompts")
    .update({ is_favorite: value })
    .eq("id", id)
    .select("id, title, project_id")
    .single();
  if (error) return { error: error.message };
  // Only favoriting is a signal; un-favoriting is feed noise.
  if (value) {
    await emitEvent(supabase, {
      verb: "favorited",
      object: { type: "prompt", id: data.id, label: data.title },
      projectId: data.project_id,
    });
  }
  revalidatePath("/prompts");
  return { error: null };
}

export async function deletePrompt(
  id: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: prompt } = await supabase
    .from("prompts")
    .select("title")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from("prompts").delete().eq("id", id);
  if (error) return { error: error.message };

  await emitEvent(supabase, {
    verb: "deleted",
    object: { type: "prompt", id, label: prompt?.title },
  });
  await supabase
    .from("taggables")
    .delete()
    .eq("entity_type", "prompt")
    .eq("entity_id", id);
  revalidatePath("/prompts");
  return { error: null };
}
