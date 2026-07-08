import { redirect } from "next/navigation";
import { LayoutGrid, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { createClient } from "@/lib/supabase/server";
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

export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: projects, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  const activeCount = projects?.filter((p) => p.status === "active").length ?? 0;

  return (
    <main className="mx-auto w-full max-w-[840px] flex-1 px-[34px] py-[30px]">
      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
          <h1
            className="font-display text-[26px] text-[var(--v2-ink-1)]"
            style={{ letterSpacing: "-0.01em" }}
          >
            Projects
          </h1>
          <p className="mt-1 text-[13.5px] text-[var(--v2-ink-2)]">
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
          return (
            <div
              key={project.id}
              className="rounded-[13px] bg-white"
              style={{ border: "1px solid #ededeb", padding: "20px 22px" }}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-[9px] text-[var(--v2-ink-2)]"
                  style={{ backgroundColor: "#f4f2ef" }}
                  aria-hidden
                >
                  <LayoutGrid className="size-4" />
                </span>
                <div className="flex items-center gap-1">
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                    style={{ backgroundColor: statusStyle.bg, color: statusStyle.fg }}
                  >
                    {STATUS_LABEL[project.status]}
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

              <h2 className="font-display mt-3 text-[16px] text-[var(--v2-ink-1)]">
                {project.name}
              </h2>
              {project.description && (
                <p className="mt-1 line-clamp-2 text-[13px] text-[var(--v2-ink-2)]">
                  {project.description}
                </p>
              )}

              <p className="font-mono mt-3 text-[10.5px] text-[var(--v2-ink-3)]">
                created{" "}
                {new Date(project.created_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          );
        })}
      </div>
    </main>
  );
}
