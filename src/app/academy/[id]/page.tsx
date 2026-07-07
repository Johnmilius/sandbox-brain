import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AppHeader } from "@/components/app-header";
import {
  ModuleProgressBars,
  type MemberProgress,
} from "@/components/academy/module-progress-bars";
import { StepRow } from "@/components/academy/step-row";
import { createClient } from "@/lib/supabase/server";

export default async function AcademyModulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [moduleRes, stepsRes, profilesRes, moduleOutcomesRes, outcomesRes] =
    await Promise.all([
      supabase.from("academy_modules").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("academy_steps")
        .select("*")
        .eq("module_id", id)
        .order("step_no"),
      supabase.from("profiles").select("*"),
      supabase.from("academy_module_outcomes").select("*").eq("module_id", id),
      supabase.from("academy_outcomes").select("id, name"),
    ]);

  const mod = moduleRes.data;
  if (!mod) notFound();

  const steps = stepsRes.data ?? [];
  const profiles = profilesRes.data ?? [];
  const stepIds = steps.map((s) => s.id);

  const { data: progressRows } =
    stepIds.length > 0
      ? await supabase
          .from("academy_step_progress")
          .select("user_id, step_id")
          .in("step_id", stepIds)
      : { data: [] };
  const progress = progressRows ?? [];

  const members = [...profiles].sort((a, b) => {
    if (a.id === user.id) return -1;
    if (b.id === user.id) return 1;
    return (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email);
  });
  const memberLabel = (p: (typeof profiles)[number]) => p.full_name ?? p.email;
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  const doneByUser = new Map<string, Set<string>>();
  for (const row of progress) {
    const set = doneByUser.get(row.user_id) ?? new Set<string>();
    set.add(row.step_id);
    doneByUser.set(row.user_id, set);
  }
  const myDoneSet = doneByUser.get(user.id) ?? new Set<string>();

  const memberBars: MemberProgress[] = members.map((member) => {
    const set = doneByUser.get(member.id);
    return {
      id: member.id,
      label: memberLabel(member),
      isSelf: member.id === user.id,
      done: set ? stepIds.filter((sid) => set.has(sid)).length : 0,
      total: stepIds.length,
    };
  });

  const outcomeNameById = new Map(
    (outcomesRes.data ?? []).map((o) => [o.id, o.name]),
  );
  const trainedOutcomes = (moduleOutcomesRes.data ?? [])
    .map((mo) => outcomeNameById.get(mo.outcome_id))
    .filter((n): n is string => Boolean(n))
    .sort();

  // Who (besides you) completed each step.
  const othersByStep = new Map<string, string[]>();
  for (const row of progress) {
    if (row.user_id === user.id) continue;
    const profile = profileById.get(row.user_id);
    const label = profile ? memberLabel(profile) : "Teammate";
    const list = othersByStep.get(row.step_id) ?? [];
    list.push(label);
    othersByStep.set(row.step_id, list);
  }

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
      <main className="mx-auto w-full max-w-4xl flex-1 p-4 sm:p-6">
        <Link
          href="/academy"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Academy
        </Link>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">
                  {mod.title}
                </h1>
                {mod.description && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {mod.description}
                  </p>
                )}
              </div>
              <Badge
                variant={mod.kind === "course" ? "default" : "secondary"}
                className="shrink-0"
              >
                {mod.kind}
              </Badge>
            </div>
            {trainedOutcomes.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Trains:</span>
                {trainedOutcomes.map((outcomeName) => (
                  <Badge key={outcomeName} variant="outline">
                    {outcomeName}
                  </Badge>
                ))}
              </div>
            )}
          </CardHeader>
          <CardContent>
            <ModuleProgressBars members={memberBars} />
          </CardContent>
        </Card>

        {steps.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No steps in this module yet.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {steps.map((step) => (
              <StepRow
                key={step.id}
                step={step}
                moduleId={mod.id}
                doneBySelf={myDoneSet.has(step.id)}
                doneByOthers={othersByStep.get(step.id) ?? []}
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
