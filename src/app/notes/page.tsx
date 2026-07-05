import Link from "next/link";
import { redirect } from "next/navigation";
import { NotebookPen, Plus, Waypoints } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AppHeader } from "@/components/app-header";
import { NewNoteDialog } from "@/components/notes/new-note-dialog";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

export default async function NotesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [notesRes, profilesRes] = await Promise.all([
    supabase.from("notes").select("*").order("updated_at", { ascending: false }),
    supabase.from("profiles").select("*"),
  ]);
  const notes = notesRes.data ?? [];
  const profileById = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));

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
            <h1 className="text-2xl font-semibold tracking-tight">Notes</h1>
            <p className="text-sm text-muted-foreground">
              Linked markdown notes — use [[wiki-links]] to connect ideas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" render={<Link href="/graph" />}>
              <Waypoints className="size-4" />
              Graph
            </Button>
            <NewNoteDialog
              trigger={
                <Button>
                  <Plus className="size-4" />
                  New note
                </Button>
              }
            />
          </div>
        </div>

        {notes.length === 0 ? (
          <Card className="border-dashed">
            <CardHeader className="items-center text-center">
              <NotebookPen className="mx-auto size-8 text-muted-foreground" />
              <CardTitle>No notes yet</CardTitle>
              <CardDescription>
                Start the team wiki — meeting notes, ideas, research, anything.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {notes.map((note) => {
              const author = profileById.get(note.author_id);
              return (
                <Link key={note.id} href={`/notes/${note.id}`} className="block">
                  <Card className="h-full transition-colors hover:border-foreground/25">
                    <CardHeader>
                      <CardTitle className="leading-snug">{note.title}</CardTitle>
                      <CardDescription className="line-clamp-3">
                        {note.body.trim() === ""
                          ? "Empty note"
                          : note.body.slice(0, 240)}
                      </CardDescription>
                      <p className="pt-1 text-xs text-muted-foreground">
                        {author?.full_name ?? author?.email ?? "Unknown"} ·{" "}
                        updated {formatDate(note.updated_at)}
                      </p>
                    </CardHeader>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
