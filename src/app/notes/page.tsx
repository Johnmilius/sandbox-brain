import Link from "next/link";
import { redirect } from "next/navigation";
import { NotebookPen, Plus, Waypoints } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
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

  const newNoteTrigger = (
    <NewNoteDialog
      trigger={
        <Button className="rounded-full bg-[#1c1c1f] px-4 text-white hover:bg-[#1c1c1f]/85">
          <Plus className="size-4" />
          New note
        </Button>
      }
    />
  );

  return (
    <main className="mx-auto w-full max-w-[840px] flex-1 px-[34px] py-[30px]">
      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
          <h1
            className="font-display text-[26px] text-[var(--v2-ink-1)]"
            style={{ letterSpacing: "-0.01em" }}
          >
            Notes
          </h1>
          <p className="mt-1 text-[13.5px] text-[var(--v2-ink-2)]">
            Linked markdown notes — use [[wiki-links]] to connect ideas.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/graph" />}
            className="rounded-full border-[#e2ddd6] bg-white px-4 text-[var(--v2-ink-1)] hover:bg-[#f6f4f1]"
          >
            <Waypoints className="size-4" />
            Graph
          </Button>
          {newNoteTrigger}
        </div>
      </div>

      {notes.length === 0 ? (
        <EmptyState
          icon={NotebookPen}
          title="No notes yet"
          description="Start the team wiki — meeting notes, ideas, research, anything."
          action={newNoteTrigger}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {notes.map((note) => {
            const author = profileById.get(note.author_id);
            const snippet = note.body.replaceAll("[[", "").replaceAll("]]", "");
            return (
              <Link
                key={note.id}
                href={`/notes/${note.id}`}
                className="block rounded-[9px] bg-white transition-shadow hover:shadow-[0_4px_14px_-4px_rgba(0,0,0,0.16)]"
                style={{ border: "1px solid #ededeb", padding: "12px 16px" }}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[13px] font-medium text-[var(--v2-ink-1)]">
                    {note.title}
                  </span>
                  <span className="font-mono shrink-0 text-[10.5px] text-[var(--v2-ink-3)]">
                    edited {formatDate(note.updated_at)}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-[12.5px] text-[var(--v2-ink-2)]">
                  {snippet.trim() === "" ? "Empty note" : snippet.slice(0, 240)}
                </p>
                <p className="font-mono mt-1.5 text-[10px] text-[var(--v2-ink-label)]">
                  {author?.full_name ?? author?.email ?? "Unknown"}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
