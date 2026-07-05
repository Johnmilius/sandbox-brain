import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/app-header";
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
      <main className="mx-auto w-full max-w-3xl flex-1 p-4 sm:p-6">
        <Link
          href="/notes"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          All notes
        </Link>

        <NoteEditor
          note={note}
          renderedBody={renderedBody}
          startInEdit={edit === "1"}
        />

        {backlinks.length > 0 && (
          <div className="mt-10 border-t pt-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground uppercase">
              Linked from
            </p>
            <ul className="flex flex-col gap-1">
              {backlinks.map((b) => (
                <li key={b.id}>
                  <Link
                    href={`/notes/${b.id}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {b.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </>
  );
}
