"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emitEvent } from "@sandbox-brain/core";
import { createClient } from "@/lib/supabase/server";
import { setTagsForEntity } from "@/lib/tags";
import type { AgentStatus, Database } from "@/lib/database.types";

export type AgentInput = {
  name: string;
  description?: string;
  systemPrompt?: string;
  model?: string;
  tools: string[];
  status: AgentStatus;
  projectId?: string | null;
};

function toRow(input: AgentInput) {
  return {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    system_prompt: input.systemPrompt?.trim() || null,
    model: input.model?.trim() || null,
    tools: input.tools.map((t) => t.trim()).filter(Boolean),
    status: input.status,
    project_id: input.projectId || null,
  };
}

/** Rewrite an agent's outgoing "uses" edges to the given prompts. */
async function setAgentPrompts(
  supabase: SupabaseClient<Database>,
  agentId: string,
  promptIds: string[],
): Promise<{ error: string | null }> {
  const { error: clearError } = await supabase
    .from("links")
    .delete()
    .eq("source_type", "agent")
    .eq("source_id", agentId)
    .eq("relationship", "uses");
  if (clearError) return { error: clearError.message };

  const ids = [...new Set(promptIds)].filter(Boolean);
  if (ids.length === 0) return { error: null };

  const { error } = await supabase.from("links").insert(
    ids.map((pid) => ({
      source_type: "agent" as const,
      source_id: agentId,
      target_type: "prompt" as const,
      target_id: pid,
      relationship: "uses",
    })),
  );
  return { error: error?.message ?? null };
}

export async function createAgent(
  input: AgentInput,
  tagNames: string[],
  promptIds: string[],
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agents")
    .insert(toRow(input))
    .select("id")
    .single();
  if (error) return { error: error.message };

  const tagResult = await setTagsForEntity(supabase, "agent", data.id, tagNames);
  if (tagResult.error) return tagResult;
  const linkResult = await setAgentPrompts(supabase, data.id, promptIds);
  if (linkResult.error) return linkResult;

  await emitEvent(supabase, {
    verb: "created",
    object: { type: "agent", id: data.id, label: input.name.trim() },
    projectId: input.projectId || null,
  });
  revalidatePath("/agents");
  revalidatePath("/graph");
  return { error: null };
}

export async function updateAgent(
  id: string,
  input: AgentInput,
  tagNames: string[],
  promptIds: string[],
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("agents").update(toRow(input)).eq("id", id);
  if (error) return { error: error.message };

  const tagResult = await setTagsForEntity(supabase, "agent", id, tagNames);
  if (tagResult.error) return tagResult;
  const linkResult = await setAgentPrompts(supabase, id, promptIds);
  if (linkResult.error) return linkResult;

  await emitEvent(supabase, {
    verb: "updated",
    object: { type: "agent", id, label: input.name.trim() },
    projectId: input.projectId || null,
  });
  revalidatePath("/agents");
  revalidatePath("/graph");
  return { error: null };
}

export async function deleteAgent(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: agent } = await supabase
    .from("agents")
    .select("name")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from("agents").delete().eq("id", id);
  if (error) return { error: error.message };

  await emitEvent(supabase, {
    verb: "deleted",
    object: { type: "agent", id, label: agent?.name },
  });

  await supabase
    .from("taggables")
    .delete()
    .eq("entity_type", "agent")
    .eq("entity_id", id);
  await supabase.from("links").delete().eq("source_type", "agent").eq("source_id", id);
  await supabase.from("links").delete().eq("target_type", "agent").eq("target_id", id);

  revalidatePath("/agents");
  revalidatePath("/graph");
  return { error: null };
}
