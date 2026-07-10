import { redirect } from "next/navigation";
import { NotebookPen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { NewNoteDialog } from "@/components/notes/new-note-dialog";
import { createClient } from "@/lib/supabase/server";

/**
 * Notes index — the design is a 3-pane screen with a note always open, so
 * this route jumps straight to the most recently edited note. The empty
 * state renders in the editor pane when there's nothing yet.
 */
export default async function NotesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: latest } = await supabase
    .from("notes")
    .select("id")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest) redirect(`/notes/${latest.id}`);

  return (
    <main className="flex flex-1 items-center justify-center p-10">
      <EmptyState
        icon={NotebookPen}
        title="No notes yet"
        description="Start the team wiki — meeting notes, ideas, research, anything. Use [[wiki-links]] to connect them."
        action={
          <NewNoteDialog
            trigger={
              <Button className="rounded-full bg-[#1c1c1f] px-4 text-white hover:bg-[#1c1c1f]/85">
                <Plus className="size-4" />
                New note
              </Button>
            }
          />
        }
      />
    </main>
  );
}
