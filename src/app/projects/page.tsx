import { redirect } from "next/navigation";
import { FolderKanban, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AppHeader } from "@/components/app-header";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { createClient } from "@/lib/supabase/server";
import type { ProjectStatus } from "@/lib/database.types";

const STATUS_VARIANT: Record<ProjectStatus, "default" | "secondary" | "outline"> = {
  active: "default",
  paused: "secondary",
  completed: "secondary",
  archived: "outline",
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

  const name =
    (user.user_metadata.full_name as string | undefined) ??
    (user.user_metadata.name as string | undefined);

  return (
    <>
      <AppHeader
        email={user.email ?? ""}
        name={name}
        avatarUrl={user.user_metadata.avatar_url as string | undefined}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
            <p className="text-sm text-muted-foreground">
              The companies and projects the team works on.
            </p>
          </div>
          <ProjectFormDialog
            trigger={
              <Button>
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
          <Card className="border-dashed">
            <CardHeader className="items-center text-center">
              <FolderKanban className="mx-auto size-8 text-muted-foreground" />
              <CardTitle>No projects yet</CardTitle>
              <CardDescription>
                Create your first project to start tracking time against it.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects?.map((project) => (
            <Card key={project.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="leading-snug">{project.name}</CardTitle>
                  <div className="flex items-center gap-1">
                    <Badge
                      variant={STATUS_VARIANT[project.status]}
                      className="capitalize"
                    >
                      {project.status}
                    </Badge>
                    <ProjectFormDialog
                      project={project}
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label="Edit project">
                          <Pencil className="size-3.5" />
                        </Button>
                      }
                    />
                  </div>
                </div>
                {project.description && (
                  <CardDescription>{project.description}</CardDescription>
                )}
              </CardHeader>
            </Card>
          ))}
        </div>
      </main>
    </>
  );
}
