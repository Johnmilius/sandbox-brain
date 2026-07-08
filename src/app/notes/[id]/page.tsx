import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { NoteEditor } from "@/components/notes/note-editor";
import { createClient } from "@/lib/supabase/server";
import { rewriteWikiLinks } from "@/lib/wiki-links";

export default async function NotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const [{ id }, { edit }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [noteRes, allNotesRes, backlinksRes] = await Promise.all([
    supabase.from("notes").select("*").eq("id", id).maybeSingle(),
    supabase.from("notes").select("id, title"),
    supabase
      .from("links")
      .select("source_id")
      .eq("relationship", "wiki")
      .eq("target_type", "note")
      .eq("target_id", id),
  ]);

  const note = noteRes.data;
  if (!note) notFound();

  const idByLowerTitle = new Map(
    (allNotesRes.data ?? []).map((n) => [n.title.toLowerCase(), n.id]),
  );
  const titleById = new Map(
    (allNotesRes.data ?? []).map((n) => [n.id, n.title]),
  );
  const renderedBody = rewriteWikiLinks(note.body, idByLowerTitle);

  const backlinks = (backlinksRes.data ?? [])
    .map((l) => ({ id: l.source_id, title: titleById.get(l.source_id) }))
    .filter((l): l is { id: string; title: string } => Boolean(l.title));

  return (
    <main
      className="mx-auto w-full max-w-[680px] flex-1"
      style={{ padding: "34px 40px" }}
    >
      <Link
        href="/notes"
        className="mb-5 inline-flex items-center gap-1 text-[12.5px] text-[var(--v2-ink-3)] transition-colors hover:text-[var(--v2-ink-1)]"
      >
        <ArrowLeft className="size-3.5" />
        All notes
      </Link>

      <NoteEditor
        note={note}
        renderedBody={renderedBody}
        startInEdit={edit === "1"}
      />

      <div className="mt-10 border-t pt-5" style={{ borderColor: "#ededeb" }}>
        <p className="font-mono-label mb-3">◍ Linked from</p>
        {backlinks.length === 0 ? (
          <p className="text-[12.5px] text-[var(--v2-ink-4)]">
            No other notes link here yet.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {backlinks.map((b) => (
              <Link
                key={b.id}
                href={`/notes/${b.id}`}
                className="block rounded-[10px] bg-[var(--v2-rail-bg)] px-3.5 py-2.5 text-[12.5px] font-medium text-[var(--v2-ink-1)] transition-colors hover:bg-[#f6f4f1]"
                style={{ border: "1px solid #ededeb" }}
              >
                {b.title}
              </Link>
            ))}
          </div>
        )}
        <p className="mt-5">
          <Link
            href="/graph"
            className="text-[12.5px] transition-colors"
            style={{ color: "var(--v2-accent-purple)" }}
          >
            Open this note in the graph →
          </Link>
        </p>
      </div>
    </main>
  );
}
