"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { setTagsForEntity } from "@/lib/tags";

/** Mark a step complete (insert) or not complete (delete) for the current user. */
export async function toggleStepComplete(
  stepId: string,
  done: boolean,
  moduleId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  if (done) {
    const { error } = await supabase
      .from("academy_step_progress")
      .insert({ step_id: stepId, user_id: user.id });
    // 23505 = already complete; treat as success so double-clicks are harmless.
    if (error && error.code !== "23505") return { error: error.message };
  } else {
    const { error } = await supabase
      .from("academy_step_progress")
      .delete()
      .eq("step_id", stepId)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
  }

  revalidatePath("/academy");
  revalidatePath(`/academy/${moduleId}`);
  revalidatePath("/graph");
  return { error: null };
}

export type AssessmentInput = {
  outcomeId: string;
  rating: number; // 1 Novice … 4 Advanced
  confidence?: number | null; // 1–5
  note?: string;
};

/** Upsert the current user's self-assessment for a learning outcome. */
export async function saveOutcomeAssessment(
  input: AssessmentInput,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.from("academy_outcome_assessments").upsert(
    {
      user_id: user.id,
      outcome_id: input.outcomeId,
      rating: input.rating,
      confidence: input.confidence ?? null,
      note: input.note?.trim() || null,
    },
    { onConflict: "user_id,outcome_id" },
  );
  if (error) return { error: error.message };

  revalidatePath("/academy");
  return { error: null };
}

/** Copy a curriculum step into the team prompt database, tagged `academy`. */
export async function saveStepToPrompts(
  stepId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: step, error: stepError } = await supabase
    .from("academy_steps")
    .select("step_no, title, prompt_text, step_type, module_id")
    .eq("id", stepId)
    .maybeSingle();
  if (stepError) return { error: stepError.message };
  if (!step) return { error: "Step not found." };
  if (step.step_type === "video") {
    return { error: "Video sessions don't have a prompt to save." };
  }

  const { data: mod } = await supabase
    .from("academy_modules")
    .select("sort_order")
    .eq("id", step.module_id)
    .maybeSingle();

  const { data: created, error } = await supabase
    .from("prompts")
    .insert({
      title: `Academy M${mod?.sort_order ?? "?"} S${step.step_no}: ${step.title}`,
      prompt_text: step.prompt_text,
      ai_tool: step.step_type === "coding_agent" ? "claude-code" : "chat",
      user_id: user.id,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const tagResult = await setTagsForEntity(supabase, "prompt", created.id, [
    "academy",
  ]);
  if (tagResult.error) return tagResult;

  revalidatePath("/prompts");
  return { error: null };
}
