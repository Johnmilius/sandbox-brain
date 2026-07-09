import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProfileForm } from "@/components/profile/profile-form";
import { McpAccess } from "@/components/profile/mcp-access";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const name =
    profile?.full_name ??
    (user.user_metadata.full_name as string | undefined) ??
    (user.user_metadata.name as string | undefined);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-[34px] py-[30px]">
        <Link
          href="/"
          className="mb-5 inline-flex items-center gap-1 text-[12.5px] text-[var(--v2-ink-3)] transition-colors hover:text-[var(--v2-ink-1)]"
        >
          <ArrowLeft className="size-3.5" />
          Back
        </Link>

        <div className="mb-6">
          <h1
            className="font-display text-[26px] text-[var(--v2-ink-1)]"
            style={{ letterSpacing: "-0.01em" }}
          >
            Profile
          </h1>
          <p className="mt-1 text-[13.5px] text-[var(--v2-ink-2)]">
            Set how your name appears to the rest of the team.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your details</CardTitle>
            <CardDescription>
              Used on notes, time entries, and the graph.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm
              initialName={name ?? ""}
              email={user.email ?? ""}
            />
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">MCP access</CardTitle>
            <CardDescription>
              A personal token so Claude&apos;s MCP server acts as you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <McpAccess />
          </CardContent>
        </Card>
    </main>
  );
}
