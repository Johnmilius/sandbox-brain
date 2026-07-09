import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deriveTicketPrefix, findConflicts, formatTicketId } from "@/lib/tasks";
import { TasksView } from "@/components/tasks/tasks-view";
import type {
  PersonOption,
  ProjectOption,
  TaskLink,
  TaskVM,
} from "@/components/tasks/types";
import type { Task } from "@/lib/database.types";

function initialsFor(label: string): string {
  return label
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Demo dataset behind ?demo=1 — a harmless review aid that shows the board,
 * conflicts, claiming, and checklists with seed-like data (read-only).
 */
function demoData(currentUserId: string, currentUserName: string) {
  const people: PersonOption[] = [
    { id: currentUserId, label: currentUserName, initials: initialsFor(currentUserName) },
    { id: "demo-sam", label: "Sam Marlow", initials: "SM" },
    { id: "demo-alex", label: "Alex Liu", initials: "AL" },
  ];
  const projects: ProjectOption[] = [
    { id: "demo-ramp", name: "Ramp landing", prefix: "RL" },
    { id: "demo-side", name: "Sidequest v2", prefix: "SV" },
    { id: "demo-ware", name: "Warehouse sim", prefix: "WS" },
  ];
  const t = (
    n: number,
    projectIndex: number,
    title: string,
    status: TaskVM["status"],
    priority: TaskVM["priority"],
    area: TaskVM["area"],
    assignee: PersonOption | null,
    claimedBy: PersonOption | null,
    checklist: TaskVM["checklist"] = [],
    links: TaskLink[] = [],
  ): TaskVM => {
    const project = projects[projectIndex];
    return {
      id: `demo-${project.prefix}-${n}`,
      ticketId: formatTicketId(project.prefix, n),
      projectId: project.id,
      projectName: project.name,
      title,
      description: null,
      priority,
      area,
      status,
      assignee,
      claimedBy,
      checklist,
      links,
      conflictsWith: [],
    };
  };

  const tasks: TaskVM[] = [
    t(14, 0, "Hero section responsive layout", "inprogress", "high", "frontend", people[0], people[0], [
      { text: "Desktop grid", done: true },
      { text: "Tablet fallback", done: true },
      { text: "Copy pass", done: false },
    ]),
    t(15, 0, "Signup form validation states", "inprogress", "med", "frontend", people[1], people[1]),
    t(16, 0, "Pricing table copy", "todo", "med", "copy", people[2], null),
    t(11, 0, "OG image + favicon set", "review", "low", "design", people[1], null),
    t(9, 0, "Waitlist API endpoint", "done", "med", "backend", people[0], null),
    t(31, 1, "Quest editor drag handles", "inprogress", "high", "frontend", people[2], people[2]),
    t(28, 1, "Save-slot schema migration", "todo", "high", "backend", null, null, [
      { text: "Design schema", done: false },
      { text: "Write migration", done: false },
    ]),
    t(25, 1, "Onboarding flow narrative", "backlog", "low", "copy", null, null),
    t(11, 2, "Forklift pathfinding tuning", "inprogress", "med", "backend", people[0], null),
    t(12, 2, "Bin-packing visualizer", "backlog", "med", "design", null, null),
  ];

  // Give the demo a visible conflict pair (RL-14 vs RL-15 are both frontend+inprogress).
  const conflicts = findConflicts(
    tasks.map((task) => ({
      id: task.id,
      project_id: task.projectId,
      area: task.area,
      status: task.status,
    })),
  );
  const byId = new Map(tasks.map((task) => [task.id, task]));
  for (const [id, otherIds] of conflicts) {
    const task = byId.get(id);
    if (!task) continue;
    task.conflictsWith = otherIds.map((otherId) => {
      const other = byId.get(otherId)!;
      return {
        ticketId: other.ticketId,
        name: (other.claimedBy ?? other.assignee)?.label.split(/\s+/)[0] ?? "a teammate",
      };
    });
  }

  return { tasks, projects, people };
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const { demo } = await searchParams;
  const isDemo = demo === "1";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: selfProfile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();
  const currentUserName =
    selfProfile?.full_name ?? selfProfile?.email ?? user.email ?? "You";

  let tasks: TaskVM[] = [];
  let projects: ProjectOption[] = [];
  let people: PersonOption[] = [];
  let migrationMissing = false;

  if (isDemo) {
    ({ tasks, projects, people } = demoData(user.id, currentUserName));
  } else {
    const [tasksRes, projectsRes, profilesRes] = await Promise.all([
      supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("projects").select("id, name, ticket_prefix").order("name"),
      supabase.from("profiles").select("id, full_name, email"),
    ]);

    if (tasksRes.error) {
      // Table missing until migration 0007 is applied — render the notice
      // instead of crashing. Any other error surfaces the same designed card.
      migrationMissing = true;
    } else {
      const taskRows = (tasksRes.data ?? []) as Task[];
      const projectRows = projectsRes.data ?? [];
      const profileRows = profilesRes.data ?? [];

      people = profileRows.map((p) => {
        const label = p.full_name ?? p.email;
        return { id: p.id, label, initials: initialsFor(label) };
      });
      const personById = new Map(people.map((p) => [p.id, p]));

      const prefixByProject = new Map(
        projectRows.map((p) => [
          p.id,
          p.ticket_prefix ?? deriveTicketPrefix(p.name),
        ]),
      );
      const nameByProject = new Map(projectRows.map((p) => [p.id, p.name]));
      // Filter pills show only projects that have tickets.
      const projectIdsWithTasks = new Set(taskRows.map((t) => t.project_id));
      projects = projectRows
        .filter((p) => projectIdsWithTasks.has(p.id))
        .map((p) => ({
          id: p.id,
          name: p.name,
          prefix: p.ticket_prefix ?? deriveTicketPrefix(p.name),
        }));
      const allProjects: ProjectOption[] = projectRows.map((p) => ({
        id: p.id,
        name: p.name,
        prefix: p.ticket_prefix ?? deriveTicketPrefix(p.name),
      }));
      // The dialog needs every project, the pills only active ones — pass the
      // full list when nothing has tickets yet so creation still works.
      if (projects.length === 0) projects = allProjects;

      // Links out of tickets → "LINKED IN THE BRAIN" rows.
      const taskIds = taskRows.map((t) => t.id);
      const linksByTask = new Map<string, TaskLink[]>();
      if (taskIds.length > 0) {
        const { data: linkRows } = await supabase
          .from("links")
          .select("source_type, source_id, target_type, target_id")
          .or(
            `and(source_type.eq.task,source_id.in.(${taskIds.join(",")})),and(target_type.eq.task,target_id.in.(${taskIds.join(",")}))`,
          );
        const wanted = { note: new Set<string>(), prompt: new Set<string>() };
        const rawByTask = new Map<string, { kind: string; id: string }[]>();
        for (const l of linkRows ?? []) {
          const [taskId, otherType, otherId] =
            l.source_type === "task"
              ? [l.source_id, l.target_type, l.target_id]
              : [l.target_id, l.source_type, l.source_id];
          const list = rawByTask.get(taskId) ?? [];
          list.push({ kind: otherType, id: otherId });
          rawByTask.set(taskId, list);
          if (otherType === "note") wanted.note.add(otherId);
          if (otherType === "prompt") wanted.prompt.add(otherId);
        }
        const [notesRes, promptsRes] = await Promise.all([
          wanted.note.size > 0
            ? supabase.from("notes").select("id, title").in("id", [...wanted.note])
            : Promise.resolve({ data: [] }),
          wanted.prompt.size > 0
            ? supabase.from("prompts").select("id, title").in("id", [...wanted.prompt])
            : Promise.resolve({ data: [] }),
        ]);
        const noteTitle = new Map((notesRes.data ?? []).map((n) => [n.id, n.title]));
        const promptTitle = new Map((promptsRes.data ?? []).map((p) => [p.id, p.title]));
        for (const [taskId, raw] of rawByTask) {
          linksByTask.set(
            taskId,
            raw.map(({ kind, id }) => ({
              kind,
              label:
                kind === "note"
                  ? (noteTitle.get(id) ?? "Note")
                  : kind === "prompt"
                    ? (promptTitle.get(id) ?? "Prompt")
                    : kind,
              href: kind === "note" ? `/notes/${id}` : kind === "prompt" ? "/prompts" : "/graph",
            })),
          );
        }
      }

      const conflicts = findConflicts(taskRows);
      const ticketIdOf = (t: Task) =>
        formatTicketId(prefixByProject.get(t.project_id) ?? "TSK", t.ticket_num);
      const taskById = new Map(taskRows.map((t) => [t.id, t]));

      tasks = taskRows.map((t) => ({
        id: t.id,
        ticketId: ticketIdOf(t),
        projectId: t.project_id,
        projectName: nameByProject.get(t.project_id) ?? "Unknown project",
        title: t.title,
        description: t.description,
        priority: t.priority,
        area: t.area,
        status: t.status,
        assignee: t.assignee ? (personById.get(t.assignee) ?? null) : null,
        claimedBy: t.claimed_by ? (personById.get(t.claimed_by) ?? null) : null,
        checklist: t.checklist,
        links: linksByTask.get(t.id) ?? [],
        conflictsWith: (conflicts.get(t.id) ?? []).map((otherId) => {
          const other = taskById.get(otherId)!;
          const person = other.claimed_by
            ? personById.get(other.claimed_by)
            : other.assignee
              ? personById.get(other.assignee)
              : null;
          return {
            ticketId: ticketIdOf(other),
            name: person?.label.split(/\s+/)[0] ?? "a teammate",
          };
        }),
      }));
    }
  }

  return (
    <main className="w-full flex-1 px-[34px] py-[30px]">
      <div className="mb-6">
        <h1
          className="font-display text-[26px] text-[var(--v2-ink-1)]"
          style={{ letterSpacing: "-0.01em" }}
        >
          Tasks
        </h1>
        <p className="mt-1 text-[13.5px] text-[var(--v2-ink-2)]">
          Claim a ticket to lock it to you · overlaps are flagged before they
          become conflicts.
          {isDemo && (
            <span
              className="font-mono ml-2 rounded-full px-2 py-0.5 text-[10px]"
              style={{
                backgroundColor: "var(--v2-warning-bg)",
                color: "var(--v2-warning-text-deep)",
              }}
            >
              DEMO DATA
            </span>
          )}
        </p>
      </div>

      {migrationMissing ? (
        <div
          className="mx-auto max-w-md rounded-[13px] bg-white px-6 py-10 text-center"
          style={{ border: "1px dashed #d6d3cd" }}
        >
          <p className="font-mono-label mb-3">Migration pending</p>
          <h2 className="font-display text-[20px] text-[var(--v2-ink-1)]">
            Tasks is waiting on migration 0007
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-[13px] text-[var(--v2-ink-2)]">
            Apply{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11.5px]">
              supabase/migrations/0007_tasks.sql
            </code>{" "}
            to the project (dashboard SQL editor or{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11.5px]">
              npm run db:push
            </code>
            ), then reload. Meanwhile,{" "}
            <a
              href="/tasks?demo=1"
              className="underline underline-offset-2"
              style={{ color: "var(--v2-accent-purple)" }}
            >
              preview with demo data
            </a>
            .
          </p>
        </div>
      ) : (
        <TasksView
          tasks={tasks}
          projects={projects}
          people={people}
          currentUserId={user.id}
          currentUserName={currentUserName}
          demo={isDemo}
        />
      )}
    </main>
  );
}
