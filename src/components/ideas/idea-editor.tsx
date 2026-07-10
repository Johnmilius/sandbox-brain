"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DeleteConfirmButton } from "@/components/delete-confirm-button";
import { deleteIdea, updateIdea, type IdeaInput } from "@/app/ideas/actions";
import type { Idea } from "@/lib/database.types";

/**
 * Detail canvas — title/tagline header with edit toggle, then the design's
 * Lean-Canvas 2-col field grid (Solution full-width, italic placeholder
 * hints on `#faf9f7` cards). Verdict / lifecycle / scores live in the
 * always-interactive meta strip and scoring blocks (passed in as slots).
 */

const CANVAS_FIELDS: {
  key: "problem" | "customer" | "solution" | "revenue_model" | "stack_notes";
  label: string;
  hint: string;
  wide: boolean;
}[] = [
  { key: "problem", label: "Problem", hint: "What is broken today?", wide: false },
  { key: "customer", label: "Customer", hint: "Who feels it most?", wide: false },
  { key: "solution", label: "Solution", hint: "Your approach — how it works", wide: true },
  { key: "revenue_model", label: "Revenue model", hint: "How it makes money", wide: false },
  { key: "stack_notes", label: "Stack notes", hint: "How you would build it", wide: false },
];

type IdeaEditorProps = {
  idea: Idea;
  /** Verdict pills + lifecycle stepper strip (rendered under the header). */
  metaSlot?: React.ReactNode;
  /** Promote banner (rendered under the meta strip). */
  bannerSlot?: React.ReactNode;
  /** Scoring radar + bars (rendered under the canvas). */
  scoringSlot?: React.ReactNode;
};

export function IdeaEditor({
  idea,
  metaSlot,
  bannerSlot,
  scoringSlot,
}: IdeaEditorProps) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => textForm(idea));
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function textForm(source: Idea) {
    return {
      title: source.title,
      tagline: source.tagline ?? "",
      problem: source.problem ?? "",
      customer: source.customer ?? "",
      solution: source.solution ?? "",
      revenue_model: source.revenue_model ?? "",
      stack_notes: source.stack_notes ?? "",
      source_url: source.source_url ?? "",
    };
  }

  function onSave() {
    if (!form.title.trim()) {
      toast.error("Title is required.");
      return;
    }
    startTransition(async () => {
      // Verdict/status/scores are managed inline (pills, stepper, score
      // bars) — always pass the current values through untouched.
      const payload: IdeaInput = {
        ...form,
        verdict: idea.verdict,
        status: idea.status,
        scores: idea.scores,
      };
      const { error } = await updateIdea(idea.id, payload);
      if (error) {
        toast.error(error);
      } else {
        toast.success("Idea saved.");
        setEditing(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col">
      {/* header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {editing ? (
            <>
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                className="font-display h-auto border-none px-0 !text-[30px] leading-tight shadow-none focus-visible:ring-0"
              />
              <Input
                value={form.tagline}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tagline: e.target.value }))
                }
                placeholder="Add a one-line pitch"
                className="mt-1 h-auto border-none px-0 text-[14.5px] shadow-none focus-visible:ring-0"
              />
            </>
          ) : (
            <>
              <h1
                className="font-display text-[31px] leading-[1.15] text-[var(--v2-ink-1)]"
                style={{ letterSpacing: "-0.01em" }}
              >
                {idea.title}
              </h1>
              <p className="mt-[5px] min-h-[20px] text-[14.5px] text-[var(--v2-ink-2)]">
                {idea.tagline || (
                  <span className="text-[var(--v2-ink-4)] italic">
                    Add a one-line pitch
                  </span>
                )}
              </p>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {editing ? (
            <>
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
                  setForm(textForm(idea));
                  setEditing(false);
                }}
              >
                <X className="size-3.5" />
                Cancel
              </Button>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>

      {metaSlot}
      {bannerSlot}

      {/* lean canvas */}
      <p className="font-mono-label mb-3">The canvas</p>
      <div className="mb-[30px] grid gap-[13px] sm:grid-cols-2">
        {CANVAS_FIELDS.map(({ key, label, hint, wide }) => {
          const value = idea[key];
          return (
            <div
              key={key}
              className={wide ? "sm:col-span-2" : undefined}
              style={{
                backgroundColor: editing ? "#fff" : "#faf9f7",
                border: `1px solid ${editing ? "#e2ddd4" : "#f0eeeb"}`,
                borderRadius: 11,
                padding: "13px 15px",
              }}
            >
              <p className="font-mono mb-[7px] text-[9.5px] tracking-[0.1em] text-[var(--v2-ink-label)] uppercase">
                {label}
              </p>
              {editing ? (
                <Textarea
                  value={form[key]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [key]: e.target.value }))
                  }
                  placeholder={hint}
                  rows={wide ? 3 : 2}
                  className="min-h-0 resize-none border-none bg-transparent p-0 !text-[13px] leading-[1.55] shadow-none focus-visible:ring-0"
                />
              ) : value ? (
                <p
                  className="text-[13px] leading-[1.55] whitespace-pre-wrap"
                  style={{
                    color: "#33312e",
                    minHeight: wide ? 46 : 32,
                  }}
                >
                  {value}
                </p>
              ) : (
                <p
                  className="text-[12.5px] italic"
                  style={{ color: "#c9c4bc", minHeight: wide ? 46 : 32 }}
                >
                  {hint}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {editing && (
        <div className="mb-8 flex max-w-sm flex-col gap-2">
          <Label>Source URL</Label>
          <Input
            value={form.source_url}
            onChange={(e) =>
              setForm((f) => ({ ...f, source_url: e.target.value }))
            }
            placeholder="https://…"
          />
        </div>
      )}

      {scoringSlot}
    </div>
  );
}
