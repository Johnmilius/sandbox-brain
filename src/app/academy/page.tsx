import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppHeader } from "@/components/app-header";
import {
  ModuleProgressBars,
  type MemberProgress,
} from "@/components/academy/module-progress-bars";
import {
  OutcomesDashboard,
  type OutcomeRowData,
} from "@/components/academy/outcomes-dashboard";
import { TIER_LABELS } from "@/components/academy/assessment-dialog";
import { createClient } from "@/lib/supabase/server";

export default async function AcademyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    modulesRes,
    stepsRes,
    progressRes,
    profilesRes,
    outcomesRes,
    assessmentsRes,
    moduleOutcomesRes,
  ] = await Promise.all([
    supabase.from("academy_modules").select("*").order("sort_order"),
    supabase.from("academy_steps").select("id, module_id"),
    supabase.from("academy_step_progress").select("user_id, step_id"),
    supabase.from("profiles").select("*"),
    supabase.from("academy_outcomes").select("*").order("sort_order"),
    supabase.from("academy_outcome_assessments").select("*"),
    supabase.from("academy_module_outcomes").select("*"),
  ]);

  const modules = modulesRes.data ?? [];
  const steps = stepsRes.data ?? [];
  const progress = progressRes.data ?? [];
  const profiles = profilesRes.data ?? [];
  const outcomes = outcomesRes.data ?? [];
  const assessments = assessmentsRes.data ?? [];
  const moduleOutcomes = moduleOutcomesRes.data ?? [];

  // Self first, then teammates alphabetically.
  const members = [...profiles].sort((a, b) => {
    if (a.id === user.id) return -1;
    if (b.id === user.id) return 1;
    return (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email);
  });
  const memberLabel = (p: (typeof profiles)[number]) => p.full_name ?? p.email;

  const stepIdsByModule = new Map<string, string[]>();
  for (const step of steps) {
    const list = stepIdsByModule.get(step.module_id) ?? [];
    list.push(step.id);
    stepIdsByModule.set(step.module_id, list);
  }

  const doneByUser = new Map<string, Set<string>>();
  for (const row of progress) {
    const set = doneByUser.get(row.user_id) ?? new Set<string>();
    set.add(row.step_id);
    doneByUser.set(row.user_id, set);
  }
  const myDoneSet = doneByUser.get(user.id) ?? new Set<string>();

  // Overview numbers (yours).
  const totalSteps = steps.length;
  const myDone = myDoneSet.size;
  const myAssessments = assessments.filter((a) => a.user_id === user.id);
  const myRatings = myAssessments.map((a) => a.rating);
  const myConfidences = myAssessments
    .map((a) => a.confidence)
    .filter((c): c is number => c != null);
  const avgRating =
    myRatings.length > 0
      ? myRatings.reduce((sum, r) => sum + r, 0) / myRatings.length
      : null;
  const avgConfidence =
    myConfidences.length > 0
      ? myConfidences.reduce((sum, c) => sum + c, 0) / myConfidences.length
      : null;
  const coveragePct =
    outcomes.length > 0
      ? Math.round((myAssessments.length / outcomes.length) * 100)
      : 0;

  // Per-outcome rows for the dashboard.
  const outcomeRows: OutcomeRowData[] = outcomes.map((outcome) => {
    const mappedModuleIds = moduleOutcomes
      .filter((mo) => mo.outcome_id === outcome.id)
      .map((mo) => mo.module_id);
    const mappedStepIds = mappedModuleIds.flatMap(
      (moduleId) => stepIdsByModule.get(moduleId) ?? [],
    );
    const doneMapped = mappedStepIds.filter((id) => myDoneSet.has(id)).length;
    const mine = myAssessments.find((a) => a.outcome_id === outcome.id) ?? null;

    return {
      id: outcome.id,
      name: outcome.name,
      trainingPct:
        mappedStepIds.length > 0 ? (doneMapped / mappedStepIds.length) * 100 : 0,
      members: members.map((member) => {
        const assessment = assessments.find(
          (a) => a.user_id === member.id && a.outcome_id === outcome.id,
        );
        return {
          id: member.id,
          label: memberLabel(member),
          isSelf: member.id === user.id,
          rating: assessment?.rating ?? null,
          confidence: assessment?.confidence ?? null,
        };
      }),
      my: mine
        ? { rating: mine.rating, confidence: mine.confidence, note: mine.note }
        : null,
    };
  });

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
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Academy</h1>
          <p className="text-sm text-muted-foreground">
            Work through the Sandbox curriculum and track your founder
            competencies. Ask Claude Code for your next step with{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              brain_academy_next
            </code>
            .
          </p>
        </div>

        {modules.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">No curriculum yet</CardTitle>
              <CardDescription>
                Apply migration 0005 and run <code>npm run seed:academy</code>{" "}
                to load the Sandbox Academy modules.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Steps completed</CardTitle>
                  <CardDescription>You, across all modules</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold">
                    {myDone}
                    <span className="text-base font-normal text-muted-foreground">
                      {" "}
                      / {totalSteps}
                    </span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Coverage</CardTitle>
                  <CardDescription>Outcomes you have rated</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold">
                    {coveragePct}
                    <span className="text-base font-normal text-muted-foreground">
                      %
                    </span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Avg level</CardTitle>
                  <CardDescription>Across rated outcomes</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold">
                    {avgRating != null ? avgRating.toFixed(1) : "—"}
                  </div>
                  {avgRating != null && (
                    <p className="text-sm text-muted-foreground">
                      ≈ {TIER_LABELS[Math.min(3, Math.round(avgRating) - 1)]}
                    </p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Avg confidence</CardTitle>
                  <CardDescription>Where you gave one</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold">
                    {avgConfidence != null ? (
                      <>
                        {avgConfidence.toFixed(1)}
                        <span className="text-base font-normal text-muted-foreground">
                          {" "}
                          / 5
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <h2 className="mt-8 mb-3 text-lg font-semibold">Modules</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {modules.map((mod) => {
                const stepIds = stepIdsByModule.get(mod.id) ?? [];
                const memberBars: MemberProgress[] = members.map((member) => {
                  const set = doneByUser.get(member.id);
                  return {
                    id: member.id,
                    label: memberLabel(member),
                    isSelf: member.id === user.id,
                    done: set
                      ? stepIds.filter((id) => set.has(id)).length
                      : 0,
                    total: stepIds.length,
                  };
                });
                return (
                  <Link key={mod.id} href={`/academy/${mod.id}`} className="block">
                    <Card className="h-full transition-colors hover:border-foreground/25">
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base leading-snug">
                            {mod.title}
                          </CardTitle>
                          <Badge
                            variant={mod.kind === "course" ? "default" : "secondary"}
                            className="shrink-0"
                          >
                            {mod.kind}
                          </Badge>
                        </div>
                        {mod.description && (
                          <CardDescription className="line-clamp-2">
                            {mod.description}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent>
                        <ModuleProgressBars members={memberBars} />
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>

            <h2 className="mt-8 mb-3 text-lg font-semibold">Learning outcomes</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              Skills top-tier founders possess. The bar shows how much of the
              related curriculum you have completed; the chips show each
              person&apos;s self-rating.
            </p>
            <OutcomesDashboard outcomes={outcomeRows} />
          </>
        )}
      </main>
    </>
  );
}
