import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Boxes,
  FolderKanban,
  MessageSquareText,
  NotebookPen,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader } from "@/components/ui/card";
import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/server";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const trimmed = q?.trim();

  const [projects, notes, prompts, knowledge] = trimmed
    ? await Promise.all([
        supabase
          .from("projects")
          .select("id, name, description")
          .textSearch("search_document", trimmed, { type: "websearch" })
          .limit(20),
        supabase
          .from("notes")
          .select("id, title, body")
          .textSearch("search_document", trimmed, { type: "websearch" })
          .limit(20),
        supabase
          .from("prompts")
          .select("id, title, prompt_text")
          .textSearch("search_document", trimmed, { type: "websearch" })
          .limit(20),
        supabase
          .from("knowledge_items")
          .select("id, title, description, kind")
          .textSearch("search_document", trimmed, { type: "websearch" })
          .limit(20),
      ])
    : [null, null, null, null];

  const groups = trimmed
    ? [
        {
          label: "Projects",
          icon: FolderKanban,
          items: (projects?.data ?? []).map((p) => ({
            key: p.id,
            title: p.name,
            excerpt: p.description ?? "",
            href: "/projects",
            badge: null as string | null,
          })),
        },
        {
          label: "Notes",
          icon: NotebookPen,
          items: (notes?.data ?? []).map((n) => ({
            key: n.id,
            title: n.title,
            excerpt: n.body.slice(0, 160),
            href: `/notes/${n.id}`,
            badge: null,
          })),
        },
        {
          label: "Prompts",
          icon: MessageSquareText,
          items: (prompts?.data ?? []).map((p) => ({
            key: p.id,
            title: p.title,
            excerpt: p.prompt_text.slice(0, 160),
            href: "/prompts",
            badge: null,
          })),
        },
        {
          label: "Brain",
          icon: Boxes,
          items: (knowledge?.data ?? []).map((k) => ({
            key: k.id,
            title: k.title,
            excerpt: k.description ?? "",
            href: `/brain?kind=${k.kind}`,
            badge: k.kind.replace("_", " "),
          })),
        },
      ]
    : [];

  const totalHits = groups.reduce((n, g) => n + g.items.length, 0);

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
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">Search</h1>
        <form method="GET" className="relative mb-6">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={trimmed ?? ""}
            placeholder="Search everything — projects, notes, prompts, the brain…"
            className="h-11 pl-9"
            autoFocus
          />
        </form>

        {trimmed && totalHits === 0 && (
          <p className="text-sm text-muted-foreground">
            No results for &quot;{trimmed}&quot;.
          </p>
        )}

        {groups
          .filter((g) => g.items.length > 0)
          .map((group) => (
            <section key={group.label} className="mb-6">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <group.icon className="size-4" />
                {group.label}
                <span className="text-xs">({group.items.length})</span>
              </h2>
              <div className="flex flex-col gap-2">
                {group.items.map((item) => (
                  <Link key={item.key} href={item.href} className="block">
                    <Card className="transition-colors hover:border-foreground/25">
                      <CardHeader className="py-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{item.title}</span>
                          {item.badge && (
                            <Badge variant="outline" className="capitalize">
                              {item.badge}
                            </Badge>
                          )}
                        </div>
                        {item.excerpt && (
                          <CardDescription className="line-clamp-2">
                            {item.excerpt}
                          </CardDescription>
                        )}
                      </CardHeader>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          ))}
      </main>
    </>
  );
}
