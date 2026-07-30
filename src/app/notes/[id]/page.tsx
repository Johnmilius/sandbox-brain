import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { NoteEditor } from "@/components/notes/note-editor";
import { HistoryPanel } from "@/components/history-panel";
import { getAuthedUser } from "@/lib/supabase/auth";
import { relativeTime } from "@/lib/home-digest";
import { noteSnippet, noteTagColor } from "@/lib/note-tags";
import { rewriteWikiLinks } from "@/lib/wiki-links";

export default async function NotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const [{ id }, { edit }] = await Promise.all([params, searchParams]);
  const { supabase, user } = await getAuthedUser();
  if (!user) redirect("/login");

  const [noteRes, allNotesRes, backlinksRes, outboundRes, tagRes] =
    await Promise.all([
      supabase.from("notes").select("*").eq("id", id).maybeSingle(),
      supabase.from("notes").select("id, title, body"),
      supabase
        .from("links")
        .select("source_id")
        .eq("relationship", "wiki")
        .eq("target_type", "note")
        .eq("target_id", id),
      supabase
        .from("links")
        .select("target_id")
        .eq("relationship", "wiki")
        .eq("source_type", "note")
        .eq("source_id", id),
      supabase
        .from("taggables")
        .select("tag_id")
        .eq("entity_type", "note")
        .eq("entity_id", id)
        .limit(1)
        .maybeSingle(),
    ]);

  const note = noteRes.data;
  if (!note) notFound();

  const allNotes = allNotesRes.data ?? [];
  const idByLowerTitle = new Map(allNotes.map((n) => [n.title.toLowerCase(), n.id]));
  const noteById = new Map(allNotes.map((n) => [n.id, n]));
  const renderedBody = rewriteWikiLinks(note.body, idByLowerTitle);

  const backlinks = (backlinksRes.data ?? [])
    .map((l) => {
      const source = noteById.get(l.source_id);
      return source
        ? {
            id: source.id,
            title: source.title,
            context: noteSnippet(source.body, 90),
          }
        : null;
    })
    .filter((l): l is { id: string; title: string; context: string } => l !== null);

  const linkCount = (outboundRes.data?.length ?? 0) + backlinks.length;

  let tag: string | null = null;
  if (tagRes.data?.tag_id) {
    const { data: tagRow } = await supabase
      .from("tags")
      .select("name")
      .eq("id", tagRes.data.tag_id)
      .maybeSingle();
    tag = tagRow?.name ?? null;
  }

  const now = new Date();
  const metaLine = `edited ${relativeTime(note.updated_at, now)} · ${linkCount} link${linkCount === 1 ? "" : "s"}`;

  return (
    <>
      {/* editor */}
      <main
        className="min-w-0 max-w-[680px] flex-1"
        style={{ padding: "34px 40px" }}
      >
        {tag && (
          <p
            className="font-mono mb-2.5 text-[10px] tracking-[0.14em] uppercase"
            style={{ color: noteTagColor(tag) }}
          >
            #{tag}
          </p>
        )}
        <NoteEditor
          note={note}
          renderedBody={renderedBody}
          startInEdit={edit === "1"}
          metaLine={metaLine}
        />
      </main>

      {/* backlinks rail */}
      <aside
        className="hidden w-[250px] shrink-0 border-l xl:block"
        style={{
          borderColor: "#f0eeeb",
          backgroundColor: "var(--v2-rail-bg)",
          padding: "34px 22px",
        }}
      >
        <p className="font-mono-label mb-3.5">◍ Linked from</p>
        <div className="flex flex-col gap-[9px]">
          {backlinks.length === 0 ? (
            <p className="text-[12px] leading-normal text-[var(--v2-ink-4)]">
              No other notes link here yet.
            </p>
          ) : (
            backlinks.map((b) => (
              <Link
                key={b.id}
                href={`/notes/${b.id}`}
                className="block rounded-[10px] bg-white transition-colors hover:bg-[#faf9f7]"
                style={{ border: "1px solid #ededeb", padding: "11px 13px" }}
              >
                <div className="text-[12.5px] font-medium text-[var(--v2-ink-1)]">
                  {b.title}
                </div>
                {b.context && (
                  <div className="mt-[3px] line-clamp-2 text-[11px] leading-[1.4] text-[var(--v2-ink-3)]">
                    {b.context}
                  </div>
                )}
              </Link>
            ))
          )}
        </div>

        <p className="font-mono-label mt-6 mb-3">◷ In the graph</p>
        <Link
          href="/graph"
          className="text-[12.5px] hover:underline"
          style={{ color: "var(--v2-accent-purple)" }}
        >
          Open this note in the graph →
        </Link>

        <HistoryPanel objectType="note" objectId={id} />
      </aside>
    </>
  );
}
