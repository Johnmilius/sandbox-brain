"use server";

import { revalidatePath } from "next/cache";
import { emitEvent } from "@sandbox-brain/core";
import { createClient } from "@/lib/supabase/server";
import type { ProjectStatus } from "@/lib/database.types";

export type ProjectInput = {
  name: string;
  description?: string;
  status?: ProjectStatus;
};

export async function createProject(
  input: ProjectInput,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      status: input.status ?? "active",
    })
    .select("id, name")
    .single();
  if (error) return { error: error.message };
  await emitEvent(supabase, {
    verb: "created",
    object: { type: "project", id: data.id, label: data.name },
    projectId: data.id,
  });
  revalidatePath("/projects");
  revalidatePath("/time");
  return { error: null };
}

export async function updateProject(
  id: string,
  input: ProjectInput,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      status: input.status,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  await emitEvent(supabase, {
    verb: input.status === "completed" ? "completed" : "updated",
    object: { type: "project", id, label: input.name.trim() },
    projectId: id,
  });
  revalidatePath("/projects");
  revalidatePath("/time");
  return { error: null };
}
