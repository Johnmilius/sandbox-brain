"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{idea.title}</h1>
            {idea.tagline && (
              <p className="mt-1 text-sm text-muted-foreground">{idea.tagline}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
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
          <Badge variant="outline" className="capitalize">
            {idea.status}
          </Badge>
          {idea.verdict && <Badge variant="secondary">{idea.verdict}</Badge>}
          {idea.source_url && (
            <a
              href={idea.source_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary hover:underline"
            >
              Source
            </a>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {CANVAS_FIELDS.map(({ key, label }) => {
            const value = idea[key as keyof Idea] as string | null;
            return (
              <div key={key}>
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  {label}
                </p>
                <p className="mt-1 text-sm whitespace-pre-wrap">
                  {value || <span className="text-muted-foreground">Not set</span>}
                </p>
              </div>
            );
          })}
        </div>

        {Object.keys(idea.scores).length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground uppercase">
              Scores
            </p>
            <div className="flex flex-wrap gap-2">
              {SCORE_FIELDS.filter(({ key }) => idea.scores[key] != null).map(
                ({ key, label }) => (
                  <Badge key={key} variant="outline">
                    {label} {idea.scores[key]}
                  </Badge>
                ),
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
          className="text-lg font-semibold"
        />
        <div className="flex shrink-0 items-center gap-1">
          <Button size="sm" onClick={onSave} disabled={pending}>
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
