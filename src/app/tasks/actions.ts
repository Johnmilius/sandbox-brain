"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { deriveTicketPrefix } from "@/lib/tasks";
import type {
  Database,
  TaskArea,
  TaskChecklistItem,
  TaskPriority,
  TaskStatus,
} from "@/lib/database.types";

type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];

export type TaskInput = {
  project_id: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  area?: TaskArea;
  assignee?: string | null;
};

export async function createTask(
  input: TaskInput,
): Promise<{ id: string | null; error: string | null }> {
  const supabase = await createClient();

  // Per-project ticket numbering: next = max + 1.
  const { data: maxRow, error: maxError } = await supabase
    .from("tasks")
    .select("ticket_num")
    .eq("project_id", input.project_id)
    .order("ticket_num", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (maxError) return { id: null, error: maxError.message };
  const ticketNum = (maxRow?.ticket_num ?? 0) + 1;

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      project_id: input.project_id,
      ticket_num: ticketNum,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      priority: input.priority ?? "med",
      area: input.area ?? "frontend",
      assignee: input.assignee ?? null,
    })
    .select("id")
    .single();
  if (error) return { id: null, error: error.message };

  // Store a derived ticket prefix on the project the first time it's needed.
  const { data: project } = await supabase
    .from("projects")
    .select("name, ticket_prefix")
    .eq("id", input.project_id)
    .maybeSingle();
  if (project && !project.ticket_prefix) {
    await supabase
      .from("projects")
      .update({ ticket_prefix: deriveTicketPrefix(project.name) })
      .eq("id", input.project_id);
  }

  revalidatePath("/tasks");
  return { id: data.id, error: null };
}

export async function updateTaskStatus(
  id: string,
  status: TaskStatus,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ status })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/tasks");
  return { error: null };
}

export async function claimTask(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: task, error: readError } = await supabase
    .from("tasks")
    .select("claimed_by")
    .eq("id", id)
    .maybeSingle();
  if (readError) return { error: readError.message };
  if (!task) return { error: "Ticket not found." };
  if (task.claimed_by && task.claimed_by !== user.id) {
    return { error: "Ticket is locked by someone else." };
  }

  const { error } = await supabase
    .from("tasks")
    .update({ claimed_by: user.id })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/tasks");
  return { error: null };
}

export async function releaseTask(
  id: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: task, error: readError } = await supabase
    .from("tasks")
    .select("claimed_by")
    .eq("id", id)
    .maybeSingle();
  if (readError) return { error: readError.message };
  if (!task) return { error: "Ticket not found." };
  if (task.claimed_by !== user.id) {
    return { error: "Only the claimer can release a ticket." };
  }

  const { error } = await supabase
    .from("tasks")
    .update({ claimed_by: null })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/tasks");
  return { error: null };
}

export async function toggleChecklistItem(
  id: string,
  index: number,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: task, error: readError } = await supabase
    .from("tasks")
    .select("checklist")
    .eq("id", id)
    .maybeSingle();
  if (readError) return { error: readError.message };
  if (!task) return { error: "Ticket not found." };

  const checklist = task.checklist as TaskChecklistItem[];
  if (index < 0 || index >= checklist.length) {
    return { error: "Checklist item not found." };
  }
  const next = checklist.map((item, i) =>
    i === index ? { ...item, done: !item.done } : item,
  );

  const { error } = await supabase
    .from("tasks")
    .update({ checklist: next })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/tasks");
  return { error: null };
}

export async function updateTask(
  id: string,
  input: Partial<Pick<TaskInput, "title" | "description" | "priority" | "area" | "assignee">>,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const patch: TaskUpdate = {};
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.description !== undefined) {
    patch.description = input.description.trim() || null;
  }
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.area !== undefined) patch.area = input.area;
  if (input.assignee !== undefined) patch.assignee = input.assignee;

  const { error } = await supabase.from("tasks").update(patch).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/tasks");
  return { error: null };
}

export async function deleteTask(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) return { error: error.message };

  await supabase.from("links").delete().eq("source_type", "task").eq("source_id", id);
  await supabase.from("links").delete().eq("target_type", "task").eq("target_id", id);

  revalidatePath("/tasks");
  return { error: null };
}
