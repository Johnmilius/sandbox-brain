"use server";

import { revalidatePath } from "next/cache";
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

  revalidatePath("/prompts");
  return { error: null };
}

export async function deletePrompt(
  id: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("prompts").delete().eq("id", id);
  if (error) return { error: error.message };
  await supabase
    .from("taggables")
    .delete()
    .eq("entity_type", "prompt")
    .eq("entity_id", id);
  revalidatePath("/prompts");
  return { error: null };
}
