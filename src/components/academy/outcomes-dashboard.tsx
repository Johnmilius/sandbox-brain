"use client";

import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AssessmentDialog,
  TIER_LABELS,
} from "@/components/academy/assessment-dialog";

export type OutcomeMemberScore = {
  id: string;
  label: string;
  isSelf: boolean;
  rating: number | null;
  confidence: number | null;
};

export type OutcomeRowData = {
  id: string;
  name: string;
  /** % of steps you completed in the modules that train this outcome. */
  trainingPct: number;
  members: OutcomeMemberScore[];
  my: { rating: number; confidence: number | null; note: string | null } | null;
};

export function OutcomesDashboard({ outcomes }: { outcomes: OutcomeRowData[] }) {
  // Your tier distribution across all rated outcomes.
  const tierCounts = [0, 0, 0, 0];
  for (const outcome of outcomes) {
    if (outcome.my) tierCounts[outcome.my.rating - 1] += 1;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {TIER_LABELS.map((label, i) => (
          <Badge key={label} variant={tierCounts[i] > 0 ? "secondary" : "outline"}>
            {label}: {tierCounts[i]}
          </Badge>
        ))}
        <Badge variant="outline">
          Unrated: {outcomes.filter((o) => !o.my).length}
        </Badge>
      </div>

      <div className="overflow-hidden rounded-lg border">
        {outcomes.map((outcome, index) => (
          <div
            key={outcome.id}
            className={
              index > 0
                ? "border-t px-3 py-2.5 sm:px-4"
                : "px-3 py-2.5 sm:px-4"
            }
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {outcome.name}
              </span>
              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                {outcome.members.map((member) => (
                  <Badge
                    key={member.id}
                    variant={member.rating != null ? "secondary" : "outline"}
                    title={
                      member.confidence != null
                        ? `${member.label} · confidence ${member.confidence}/5`
                        : member.label
                    }
                  >
                    {member.label.split(" ")[0]}
                    {member.isSelf && " (you)"}:{" "}
                    {member.rating != null
                      ? TIER_LABELS[member.rating - 1]
                      : "No score"}
                  </Badge>
                ))}
                <AssessmentDialog
                  outcomeId={outcome.id}
                  outcomeName={outcome.name}
                  initial={outcome.my}
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Rate yourself on ${outcome.name}`}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  }
                />
              </div>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/50"
                  style={{ width: `${outcome.trainingPct}%` }}
                />
              </div>
              <span className="w-28 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                {Math.round(outcome.trainingPct)}% trained
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
