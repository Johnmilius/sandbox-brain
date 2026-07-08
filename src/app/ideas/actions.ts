"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { IdeaScores, IdeaStatus, IdeaVerdict } from "@/lib/database.types";

export type IdeaInput = {
  title: string;
  tagline: string;
  problem: string;
  customer: string;
  solution: string;
  revenue_model: string;
  stack_notes: string;
  verdict: IdeaVerdict | null;
  status: IdeaStatus;
  scores: IdeaScores;
  source_url: string;
};

export async function createIdea(
  input: Pick<IdeaInput, "title"> & Partial<IdeaInput>,
): Promise<{ id: string | null; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ideas")
    .insert({
      title: input.title.trim(),
      tagline: input.tagline?.trim() || null,
    })
    .select("id")
    .single();
  if (error) return { id: null, error: error.message };

  revalidatePath("/ideas");
  return { id: data.id, error: null };
}

export async function updateIdea(
  id: string,
  input: IdeaInput,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ideas")
    .update({
      title: input.title.trim(),
      tagline: input.tagline.trim() || null,
      problem: input.problem.trim() || null,
      customer: input.customer.trim() || null,
      solution: input.solution.trim() || null,
      revenue_model: input.revenue_model.trim() || null,
      stack_notes: input.stack_notes.trim() || null,
      verdict: input.verdict,
      status: input.status,
      scores: input.scores,
      source_url: input.source_url.trim() || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/ideas");
  revalidatePath(`/ideas/${id}`);
  revalidatePath("/graph");
  return { error: null };
}

export async function deleteIdea(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("ideas").delete().eq("id", id);
  if (error) return { error: error.message };

  await supabase.from("links").delete().eq("source_type", "idea").eq("source_id", id);
  await supabase.from("links").delete().eq("target_type", "idea").eq("target_id", id);

  revalidatePath("/ideas");
  revalidatePath("/graph");
  return { error: null };
}

/** Link two ideas together as "related" (bidirectional in the graph). */
export async function linkIdeas(
  ideaId: string,
  relatedIdeaId: string,
): Promise<{ error: string | null }> {
  if (ideaId === relatedIdeaId) return { error: "Can't link an idea to itself." };
  const supabase = await createClient();
  const { error } = await supabase.from("links").insert({
    source_type: "idea",
    source_id: ideaId,
    target_type: "idea",
    target_id: relatedIdeaId,
    relationship: "related",
  });
  if (error && error.code !== "23505") return { error: error.message };

  revalidatePath(`/ideas/${ideaId}`);
  revalidatePath("/graph");
  return { error: null };
}

export async function unlinkIdeas(
  ideaId: string,
  relatedIdeaId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("links")
    .delete()
    .eq("source_type", "idea")
    .eq("target_type", "idea")
    .eq("relationship", "related")
    .or(
      `and(source_id.eq.${ideaId},target_id.eq.${relatedIdeaId}),and(source_id.eq.${relatedIdeaId},target_id.eq.${ideaId})`,
    );
  if (error) return { error: error.message };

  revalidatePath(`/ideas/${ideaId}`);
  revalidatePath("/graph");
  return { error: null };
}

/** Turn a validated idea into a real project, keeping the idea as its origin record. */
export async function promoteIdeaToProject(
  ideaId: string,
): Promise<{ projectId: string | null; error: string | null }> {
  const supabase = await createClient();
  const { data: idea, error: fetchError } = await supabase
    .from("ideas")
    .select("*")
    .eq("id", ideaId)
    .single();
  if (fetchError || !idea) {
    return { projectId: null, error: fetchError?.message ?? "Idea not found." };
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({ name: idea.title, description: idea.tagline })
    .select("id")
    .single();
  if (projectError) return { projectId: null, error: projectError.message };

  const { error: updateError } = await supabase
    .from("ideas")
    .update({ status: "promoted", promoted_project_id: project.id })
    .eq("id", ideaId);
  if (updateError) return { projectId: null, error: updateError.message };

  await supabase.from("links").insert({
    source_type: "idea",
    source_id: ideaId,
    target_type: "project",
    target_id: project.id,
    relationship: "promoted_to",
  });

  revalidatePath("/ideas");
  revalidatePath(`/ideas/${ideaId}`);
  revalidatePath("/projects");
  revalidatePath("/graph");
  return { projectId: project.id, error: null };
}
