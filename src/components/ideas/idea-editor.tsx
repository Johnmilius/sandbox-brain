"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeleteConfirmButton } from "@/components/delete-confirm-button";
import { deleteIdea, updateIdea, type IdeaInput } from "@/app/ideas/actions";
import type { Idea, IdeaScores, IdeaStatus, IdeaVerdict } from "@/lib/database.types";

const STATUSES: IdeaStatus[] = ["draft", "validating", "promoted", "archived"];
const VERDICTS: IdeaVerdict[] = ["strong", "conditional", "pass"];
const SCORE_FIELDS: { key: keyof IdeaScores; label: string }[] = [
  { key: "problem", label: "Problem" },
  { key: "market", label: "Market" },
  { key: "revenue", label: "Revenue" },
  { key: "moat", label: "Moat" },
  { key: "distribution", label: "Distribution" },
  { key: "build", label: "Build" },
  { key: "team_fit", label: "Team fit" },
];

const CANVAS_FIELDS: { key: keyof IdeaInput; label: string; placeholder: string }[] = [
  { key: "problem", label: "Problem", placeholder: "What pain point does this solve?" },
  { key: "customer", label: "Customer", placeholder: "Who has this problem?" },
  { key: "solution", label: "Solution", placeholder: "How does the product solve it?" },
  { key: "revenue_model", label: "Revenue model", placeholder: "How does it make money?" },
  { key: "stack_notes", label: "Stack notes", placeholder: "Anything specific to the build?" },
];

export function IdeaEditor({ idea }: { idea: Idea }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<IdeaInput>({
    title: idea.title,
    tagline: idea.tagline ?? "",
    problem: idea.problem ?? "",
    customer: idea.customer ?? "",
    solution: idea.solution ?? "",
    revenue_model: idea.revenue_model ?? "",
    stack_notes: idea.stack_notes ?? "",
    verdict: idea.verdict,
    status: idea.status,
    scores: idea.scores,
    source_url: idea.source_url ?? "",
  });
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function resetForm() {
    setForm({
      title: idea.title,
      tagline: idea.tagline ?? "",
      problem: idea.problem ?? "",
      customer: idea.customer ?? "",
      solution: idea.solution ?? "",
      revenue_model: idea.revenue_model ?? "",
      stack_notes: idea.stack_notes ?? "",
      verdict: idea.verdict,
      status: idea.status,
      scores: idea.scores,
      source_url: idea.source_url ?? "",
    });
  }

  function onSave() {
    if (!form.title.trim()) {
      toast.error("Title is required.");
      return;
    }
    startTransition(async () => {
      const { error } = await updateIdea(idea.id, form);
      if (error) {
        toast.error(error);
      } else {
        toast.success("Idea saved.");
        setEditing(false);
        router.refresh();
      }
    });
  }

  if (!editing) {
    const verdictStyle: Record<
      IdeaVerdict,
      { dot: string; fg: string; bg: string; border: string }
    > = {
      strong: {
        dot: "#3f9b6c",
        fg: "var(--v2-success-text)",
        bg: "var(--v2-success-bg)",
        border: "var(--v2-success-border)",
      },
      conditional: {
        dot: "var(--v2-amber)",
        fg: "var(--v2-warning-text-deep)",
        bg: "var(--v2-warning-bg)",
        border: "var(--v2-warning-border)",
      },
      pass: {
        dot: "var(--v2-danger)",
        fg: "var(--v2-danger)",
        bg: "var(--v2-warning-bg)",
        border: "var(--v2-warning-border)",
      },
    };
    const verdict = idea.verdict ? verdictStyle[idea.verdict] : null;

    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1
              className="font-display text-[31px] leading-tight text-[var(--v2-ink-1)]"
              style={{ letterSpacing: "-0.01em" }}
            >
              {idea.title}
            </h1>
            {idea.tagline && (
              <p className="mt-1 text-[13.5px] text-[var(--v2-ink-2)]">
                {idea.tagline}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
              className="rounded-full border-[#e2ddd6] bg-white text-[var(--v2-ink-1)] hover:bg-[#f6f4f1]"
            >
              <Pencil className="size-3.5" />
              Edit
            </Button>
            <DeleteConfirmButton
              itemName={`idea "${idea.title}"`}
              ariaLabel="Delete idea"
              successMessage="Idea deleted."
              onDelete={() => deleteIdea(idea.id)}
              onDeleted={() => router.push("/ideas")}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-full px-2.5 py-0.5 text-[10.5px] font-medium capitalize"
            style={
              idea.status === "promoted"
                ? { backgroundColor: "#1c1c1f", color: "#ffffff" }
                : { backgroundColor: "#f4f2ef", color: "var(--v2-ink-2)" }
            }
          >
            {idea.status}
          </span>
          {idea.verdict && verdict && (
            <span
              className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-medium capitalize"
              style={{
                backgroundColor: verdict.bg,
                color: verdict.fg,
                border: `1px solid ${verdict.border}`,
              }}
            >
              <span
                className="size-1.5 rounded-full"
                style={{ backgroundColor: verdict.dot }}
              />
              {idea.verdict}
            </span>
          )}
          {idea.source_url && (
            <a
              href={idea.source_url}
              target="_blank"
              rel="noreferrer"
              className="text-[11.5px] hover:underline"
              style={{ color: "var(--v2-accent-purple)" }}
            >
              ⎘ {(() => {
                try {
                  return new URL(idea.source_url).hostname;
                } catch {
                  return "Source";
                }
              })()}
            </a>
          )}
        </div>

        <div>
          <p className="font-mono-label mb-3">The canvas</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {CANVAS_FIELDS.map(({ key, label, placeholder }) => {
              const value = idea[key as keyof Idea] as string | null;
              return (
                <div
                  key={key}
                  className={key === "solution" ? "sm:col-span-2" : undefined}
                >
                  <p className="font-mono-label">{label}</p>
                  <p className="mt-1 text-[13.5px] whitespace-pre-wrap text-[var(--v2-ink-1)]">
                    {value || (
                      <span className="text-[var(--v2-ink-4)] italic">
                        {placeholder}
                      </span>
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {Object.keys(idea.scores).length > 0 && (
          <div>
            <p className="font-mono-label mb-3">Scoring · 7 dimensions</p>
            <div className="flex flex-col gap-2">
              {SCORE_FIELDS.filter(({ key }) => idea.scores[key] != null).map(
                ({ key, label }) => {
                  const score = idea.scores[key]!;
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-[12px] text-[var(--v2-ink-2)]">
                        {label}
                      </span>
                      <div className="flex flex-1 gap-1">
                        {[1, 2, 3, 4, 5].map((cell) => (
                          <span
                            key={cell}
                            className="h-2 flex-1 rounded-[3px]"
                            style={{
                              backgroundColor:
                                cell <= score
                                  ? "var(--v2-accent-purple)"
                                  : "#f4f2ef",
                            }}
                          />
                        ))}
                      </div>
                      <span className="font-mono w-6 shrink-0 text-right text-[11px] text-[var(--v2-ink-2)] tabular-nums">
                        {score}
                      </span>
                    </div>
                  );
                },
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Input
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          className="font-display border-none px-0 !text-[26px] leading-tight shadow-none focus-visible:ring-0"
        />
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            onClick={onSave}
            disabled={pending}
            className="rounded-full bg-[#1c1c1f] text-white hover:bg-[#1c1c1f]/85"
          >
            <Save className="size-3.5" />
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              resetForm();
              setEditing(false);
            }}
          >
            <X className="size-3.5" />
            Cancel
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Tagline</Label>
        <Input
          value={form.tagline}
          onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
          placeholder="One sentence pitch"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>Status</Label>
          <Select
            value={form.status}
            onValueChange={(v) => setForm((f) => ({ ...f, status: v as IdeaStatus }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Verdict</Label>
          <Select
            value={form.verdict ?? "__none__"}
            onValueChange={(v) =>
              setForm((f) => ({
                ...f,
                verdict: v === "__none__" ? null : (v as IdeaVerdict),
              }))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Not scored</SelectItem>
              {VERDICTS.map((v) => (
                <SelectItem key={v} value={v} className="capitalize">
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {CANVAS_FIELDS.map(({ key, label, placeholder }) => (
        <div key={key} className="flex flex-col gap-2">
          <Label>{label}</Label>
          <Textarea
            value={form[key] as string}
            onChange={(e) =>
              setForm((f) => ({ ...f, [key]: e.target.value }) as IdeaInput)
            }
            placeholder={placeholder}
            rows={3}
          />
        </div>
      ))}

      <div className="flex flex-col gap-2">
        <Label>Source URL</Label>
        <Input
          value={form.source_url}
          onChange={(e) => setForm((f) => ({ ...f, source_url: e.target.value }))}
          placeholder="https://…"
        />
      </div>

      <div>
        <Label className="mb-2 block">Scores (1–5)</Label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SCORE_FIELDS.map(({ key, label }) => (
            <div key={key} className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">{label}</Label>
              <Input
                type="number"
                min={1}
                max={5}
                value={form.scores[key] ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  setForm((f) => ({
                    ...f,
                    scores: {
                      ...f.scores,
                      [key]: raw === "" ? undefined : Number(raw),
                    },
                  }));
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
