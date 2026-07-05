import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Clock,
  MessageSquareText,
  NotebookPen,
  Boxes,
  FolderKanban,
} from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/server";

const SECTIONS = [
  {
    title: "Projects",
    description: "The companies and projects the team works on.",
    icon: FolderKanban,
    href: "/projects",
  },
  {
    title: "Time Tracking",
    description: "Start a timer or log hours against a project.",
    icon: Clock,
    href: "/time",
  },
  {
    title: "Prompt Database",
    description: "Save, tag, and search the prompts you send to AI tools.",
    icon: MessageSquareText,
    href: "/prompts",
  },
  {
    title: "Notes & Graph",
    description: "Linked markdown notes with an Obsidian-style graph view.",
    icon: NotebookPen,
    href: "/notes",
  },
  {
    title: "The Brain",
    description: "Reusable code, decisions, docs, contacts, and past projects.",
    icon: Boxes,
    href: null,
  },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const name =
    (user.user_metadata.full_name as string | undefined) ??
    (user.user_metadata.name as string | undefined);
  const avatarUrl = user.user_metadata.avatar_url as string | undefined;
  const firstName = name?.split(" ")[0] ?? "there";

  return (
    <>
      <AppHeader email={user.email ?? ""} name={name} avatarUrl={avatarUrl} />
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back, {firstName}
          </h1>
          <p className="text-sm text-muted-foreground">
            The team hub is live. Features unlock as each phase ships.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {SECTIONS.map(({ title, description, icon: Icon, href }) => {
            const card = (
              <Card
                key={title}
                className={
                  href
                    ? "h-full transition-colors hover:border-foreground/25"
                    : "h-full opacity-70"
                }
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
                      <Icon className="size-4.5" />
                    </span>
                    {!href && <Badge variant="secondary">Coming soon</Badge>}
                  </div>
                  <CardTitle className="pt-2">{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
              </Card>
            );
            return href ? (
              <Link key={title} href={href} className="block">
                {card}
              </Link>
            ) : (
              card
            );
          })}
        </div>
      </main>
    </>
  );
}
