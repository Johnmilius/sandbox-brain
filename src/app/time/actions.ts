"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function startTimer(
  projectId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("time_entries").insert({
    project_id: projectId,
    started_at: new Date().toISOString(),
    source: "timer",
  });
  if (error) {
    // Unique partial index: one running timer per person.
    if (error.code === "23505") {
      return { error: "You already have a running timer. Stop it first." };
    }
    return { error: error.message };
  }
  revalidatePath("/time");
  return { error: null };
}

export async function stopTimer(
  entryId: string,
  notes?: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("time_entries")
    .update({
      ended_at: new Date().toISOString(),
      notes: notes?.trim() || null,
    })
    .eq("id", entryId)
    .is("ended_at", null);
  if (error) return { error: error.message };
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
  const { error } = await supabase.from("time_entries").insert({
    project_id: input.projectId,
    started_at: input.startedAt,
    ended_at: input.endedAt,
    notes: input.notes?.trim() || null,
    source: "manual",
  });
  if (error) return { error: error.message };
  revalidatePath("/time");
  return { error: null };
}

export async function deleteTimeEntry(
  entryId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("time_entries")
    .delete()
    .eq("id", entryId);
  if (error) return { error: error.message };
  revalidatePath("/time");
  return { error: null };
}
