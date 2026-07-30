import { getAuthedUser } from "@/lib/supabase/auth";
import { relativeTime } from "@/lib/home-digest";
import { noteSnippet, noteTagColor } from "@/lib/note-tags";
import { NotesRail, type NoteRailItem } from "@/components/notes/notes-rail";

/**
 * Notes is the design's single 3-pane screen: this layout keeps the
 * note-list rail persistent while the editor (+ backlinks rail) renders
 * to its right.
 */
export default async function NotesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, user } = await getAuthedUser();

  let items: NoteRailItem[] = [];
  if (user) {
    const [notesRes, taggablesRes, tagsRes] = await Promise.all([
      supabase
        .from("notes")
        .select("id, title, body, updated_at")
        .order("updated_at", { ascending: false }),
      supabase
        .from("taggables")
        .select("entity_id, tag_id")
        .eq("entity_type", "note"),
      supabase.from("tags").select("id, name"),
    ]);

    const tagNameById = new Map((tagsRes.data ?? []).map((t) => [t.id, t.name]));
    const firstTagByNote = new Map<string, string>();
    for (const t of taggablesRes.data ?? []) {
      if (firstTagByNote.has(t.entity_id)) continue;
      const name = tagNameById.get(t.tag_id);
      if (name) firstTagByNote.set(t.entity_id, name);
    }

    const now = new Date();
    items = (notesRes.data ?? []).map((n) => {
      const tag = firstTagByNote.get(n.id) ?? null;
      return {
        id: n.id,
        title: n.title,
        snippet: noteSnippet(n.body),
        editedLabel: relativeTime(n.updated_at, now).replace(" ago", ""),
        tag,
        tagColor: tag ? noteTagColor(tag) : "var(--v2-ink-label)",
      };
    });
  }

  return (
    <div className="flex min-h-0 flex-1">
      <NotesRail notes={items} />
      <div className="flex min-w-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
