import Link from "next/link";
import { redirect } from "next/navigation";
import { Lightbulb, Plus, Waypoints } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AppHeader } from "@/components/app-header";
import { NewIdeaDialog } from "@/components/ideas/new-idea-dialog";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import type { IdeaStatus, IdeaVerdict } from "@/lib/database.types";

const STATUS_VARIANT: Record<IdeaStatus, "default" | "secondary" | "outline"> = {
  draft: "outline",
  validating: "secondary",
  promoted: "default",
  archived: "outline",
};

const VERDICT_LABEL: Record<IdeaVerdict, string> = {
  strong: "✦ Strong",
  conditional: "~ Conditional",
  pass: "✕ Pass",
};

export default async function IdeasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: ideas, error } = await supabase
    .from("ideas")
    .select("*")
    .order("updated_at", { ascending: false });

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
            <h1 className="text-2xl font-semibold tracking-tight">Ideas</h1>
            <p className="text-sm text-muted-foreground">
              Draft startup ideas — lighter than a project, until one&apos;s
              worth promoting.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/graph" />}
            >
              <Waypoints className="size-4" />
              Graph
            </Button>
            <NewIdeaDialog
              trigger={
                <Button>
                  <Plus className="size-4" />
                  New idea
                </Button>
              }
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive">
            Couldn&apos;t load ideas: {error.message}
          </p>
        )}

        {ideas && ideas.length === 0 && (
          <Card className="border-dashed">
            <CardHeader className="items-center text-center">
              <Lightbulb className="mx-auto size-8 text-muted-foreground" />
              <CardTitle>No ideas yet</CardTitle>
              <CardDescription>
                Jot down the first draft — problem, customer, and solution can
                come later.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ideas?.map((idea) => (
            <Link key={idea.id} href={`/ideas/${idea.id}`} className="block">
              <Card className="h-full transition-colors hover:border-foreground/25">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="leading-snug">{idea.title}</CardTitle>
                    <div className="flex shrink-0 items-center gap-1">
                      {idea.verdict && (
                        <Badge variant="secondary">
                          {VERDICT_LABEL[idea.verdict]}
                        </Badge>
                      )}
                      <Badge variant={STATUS_VARIANT[idea.status]} className="capitalize">
                        {idea.status}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription className="line-clamp-3">
                    {idea.tagline || "No tagline yet."}
                  </CardDescription>
                  <p className="pt-1 text-xs text-muted-foreground">
                    updated {formatDate(idea.updated_at)}
                  </p>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
