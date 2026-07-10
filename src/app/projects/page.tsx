import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutGrid, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { createClient } from "@/lib/supabase/server";
import { entryDurationMs } from "@/lib/format";
import type { ProjectStatus } from "@/lib/database.types";

const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  archived: "Archived",
};

const STATUS_STYLE: Record<ProjectStatus, { bg: string; fg: string }> = {
  active: { bg: "#1c1c1f", fg: "#ffffff" },
  paused: { bg: "var(--v2-warning-bg)", fg: "var(--v2-warning-text-deep)" },
  completed: { bg: "var(--v2-success-bg)", fg: "var(--v2-success-text)" },
  archived: { bg: "#f4f2ef", fg: "var(--v2-ink-2)" },
};

function initialsFor(label: string): string {
  return label
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [projectsRes, entriesRes, tasksRes, profilesRes] = await Promise.all([
    supabase.from("projects").select("*").order("created_at", { ascending: false }),
    supabase
      .from("time_entries")
      .select("project_id, started_at, ended_at")
      .not("ended_at", "is", null),
    // Pre-0007 the table is missing — cards degrade to "no tickets yet".
    supabase.from("tasks").select("project_id, status, assignee"),
    supabase.from("profiles").select("id, full_name, email"),
  ]);

  const projects = projectsRes.data;
  const error = projectsRes.error;

  // Hours logged per project (all time, completed sessions).
  const msByProject = new Map<string, number>();
  for (const e of entriesRes.data ?? []) {
    msByProject.set(
      e.project_id,
      (msByProject.get(e.project_id) ?? 0) +
        entryDurationMs(e.started_at, e.ended_at),
    );
  }

  // Ticket completion + people per project.
  const profileById = new Map(
    (profilesRes.data ?? []).map((p) => [p.id, p.full_name ?? p.email]),
  );
  const tally = new Map<
    string,
    { done: number; total: number; people: Set<string> }
  >();
  if (!tasksRes.error) {
    for (const t of tasksRes.data ?? []) {
      const row =
        tally.get(t.project_id) ?? { done: 0, total: 0, people: new Set() };
      row.total += 1;
      if (t.status === "done") row.done += 1;
      if (t.assignee) {
        const label = profileById.get(t.assignee);
        if (label) row.people.add(initialsFor(label));
      }
      tally.set(t.project_id, row);
    }
  }

  const activeCount = projects?.filter((p) => p.status === "active").length ?? 0;

  return (
    <main className="mx-auto w-full max-w-[840px] flex-1 px-[34px] py-[30px]">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1
            className="font-display text-[26px] text-[var(--v2-ink-1)]"
            style={{ letterSpacing: "-0.01em" }}
          >
            Projects
          </h1>
          <p className="mt-0.5 text-[13px] text-[var(--v2-ink-2)]">
            {activeCount} active · click a project to open its tasks.
          </p>
        </div>
        <ProjectFormDialog
          trigger={
            <Button className="rounded-full bg-[#1c1c1f] px-4 text-white hover:bg-[#1c1c1f]/85">
              <Plus className="size-4" />
              New project
            </Button>
          }
        />
      </div>

      {error && (
        <p className="text-sm text-destructive">
          Couldn&apos;t load projects: {error.message}
        </p>
      )}

      {projects && projects.length === 0 && (
        <EmptyState
          icon={LayoutGrid}
          title="No projects yet"
          description="Create the first project the team will rally around."
          action={
            <ProjectFormDialog
              trigger={
                <Button className="rounded-full bg-[#1c1c1f] px-4 text-white hover:bg-[#1c1c1f]/85">
                  <Plus className="size-4" />
                  New project
                </Button>
              }
            />
          }
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {projects?.map((project) => {
          const statusStyle = STATUS_STYLE[project.status];
          const hours = (msByProject.get(project.id) ?? 0) / 3_600_000;
          const t = tally.get(project.id);
          const pct = t && t.total > 0 ? Math.round((t.done / t.total) * 100) : 0;
          const people = t ? [...t.people].slice(0, 3).join(" · ") : "";
          return (
            <div
              key={project.id}
              className="relative rounded-[13px] bg-white transition-colors hover:bg-[#faf9f7]"
              style={{ border: "1px solid #ededeb", padding: "20px 22px" }}
            >
              {/* Whole card deep-links into Tasks scoped to this project. */}
              <Link
                href={`/tasks?project=${project.id}`}
                className="absolute inset-0 rounded-[13px]"
                aria-label={`Open ${project.name} tasks`}
              />

              <div className="mb-3.5 flex items-center justify-between gap-2">
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-[9px] text-[var(--v2-ink-2)]"
                  style={{ backgroundColor: "#f4f2ef" }}
                  aria-hidden
                >
                  <LayoutGrid className="size-4" />
                </span>
                <div className="relative z-10 flex items-center gap-1.5">
                  {project.status !== "active" && (
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                      style={{
                        backgroundColor: statusStyle.bg,
                        color: statusStyle.fg,
                      }}
                    >
                      {STATUS_LABEL[project.status]}
                    </span>
                  )}
                  <span className="font-mono text-[11px] text-[var(--v2-ink-3)] tabular-nums">
                    {hours > 0 ? `${hours.toFixed(1)}h` : ""}
                  </span>
                  <ProjectFormDialog
                    project={project}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Edit project"
                        className="text-[var(--v2-ink-3)] hover:bg-[#efece7] hover:text-[var(--v2-ink-1)]"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    }
                  />
                </div>
              </div>

              <h2 className="text-[15px] font-semibold text-[var(--v2-ink-1)]">
                {project.name}
              </h2>
              <p
                className="line-clamp-2 text-[12.5px] text-[var(--v2-ink-2)]"
                style={{ margin: "3px 0 14px" }}
              >
                {project.description ?? ""}
              </p>

              <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[11.5px]">
                <span className="font-mono text-[var(--v2-ink-3)] tabular-nums">
                  {t && t.total > 0
                    ? `${pct}% · ${t.done}/${t.total} tasks done`
                    : "no tickets yet"}
                </span>
                <span className="text-[var(--v2-ink-3)]">{people}</span>
              </div>
              <div
                className="h-[6px] w-full overflow-hidden rounded-[3px]"
                style={{ backgroundColor: "#efece7" }}
              >
                <div
                  className="h-full rounded-[3px] bg-[#1c1c1f]"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
