"use server";

import { revalidatePath } from "next/cache";
import { emitEvent } from "@sandbox-brain/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

async function projectName(
  supabase: SupabaseClient<Database>,
  projectId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .maybeSingle();
  return data?.name ?? null;
}

export async function startTimer(
  projectId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("time_entries")
    .insert({
      project_id: projectId,
      started_at: new Date().toISOString(),
      source: "timer",
    })
    .select("id")
    .single();
  if (error) {
    // Unique partial index: one running timer per person.
    if (error.code === "23505") {
      return { error: "You already have a running timer. Stop it first." };
    }
    return { error: error.message };
  }
  await emitEvent(supabase, {
    verb: "started",
    object: { type: "time_entry", id: data.id },
    target: {
      type: "project",
      id: projectId,
      label: await projectName(supabase, projectId),
    },
    projectId,
  });
  revalidatePath("/time");
  return { error: null };
}

export async function stopTimer(
  entryId: string,
  notes?: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("time_entries")
    .update({
      ended_at: new Date().toISOString(),
      notes: notes?.trim() || null,
    })
    .eq("id", entryId)
    .is("ended_at", null)
    .select("id, project_id, started_at, ended_at")
    .single();
  if (error) return { error: error.message };
  await emitEvent(supabase, {
    verb: "logged_time",
    object: { type: "time_entry", id: data.id },
    target: {
      type: "project",
      id: data.project_id,
      label: await projectName(supabase, data.project_id),
    },
    projectId: data.project_id,
    metadata: { started_at: data.started_at, ended_at: data.ended_at },
  });
  revalidatePath("/time");
  return { error: null };
}

export async function addManualEntry(input: {
  projectId: string;
  startedAt: string; // ISO, computed on the client in local time
  endedAt: string;
  notes?: string;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("time_entries")
    .insert({
      project_id: input.projectId,
      started_at: input.startedAt,
      ended_at: input.endedAt,
      notes: input.notes?.trim() || null,
      source: "manual",
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  await emitEvent(supabase, {
    verb: "logged_time",
    object: { type: "time_entry", id: data.id },
    target: {
      type: "project",
      id: input.projectId,
      label: await projectName(supabase, input.projectId),
    },
    projectId: input.projectId,
    metadata: { started_at: input.startedAt, ended_at: input.endedAt },
  });
  revalidatePath("/time");
  return { error: null };
}

export async function deleteTimeEntry(
  entryId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: entry } = await supabase
    .from("time_entries")
    .select("project_id")
    .eq("id", entryId)
    .maybeSingle();
  const { error } = await supabase
    .from("time_entries")
    .delete()
    .eq("id", entryId);
  if (error) return { error: error.message };

  await emitEvent(supabase, {
    verb: "deleted",
    object: { type: "time_entry", id: entryId },
    target: entry
      ? {
          type: "project",
          id: entry.project_id,
          label: await projectName(supabase, entry.project_id),
        }
      : undefined,
    projectId: entry?.project_id ?? null,
  });
  revalidatePath("/time");
  return { error: null };
}
