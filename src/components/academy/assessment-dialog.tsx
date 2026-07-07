"use client";

import { useState, useTransition, type ReactElement } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { saveOutcomeAssessment } from "@/app/academy/actions";

export const TIER_LABELS = ["Novice", "Developing", "Strong", "Advanced"] as const;

type AssessmentDialogProps = {
  outcomeId: string;
  outcomeName: string;
  initial: { rating: number; confidence: number | null; note: string | null } | null;
  trigger: ReactElement<Record<string, unknown>>;
};

export function AssessmentDialog({
  outcomeId,
  outcomeName,
  initial,
  trigger,
}: AssessmentDialogProps) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<string | null>(
    initial ? String(initial.rating) : null,
  );
  const [confidence, setConfidence] = useState<string | null>(
    initial?.confidence != null ? String(initial.confidence) : null,
  );
  const [note, setNote] = useState(initial?.note ?? "");
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rating) {
      toast.error("Pick a level first.");
      return;
    }
    startTransition(async () => {
      const { error } = await saveOutcomeAssessment({
        outcomeId,
        rating: Number(rating),
        confidence: confidence ? Number(confidence) : null,
        note,
      });
      if (error) {
        toast.error(error);
      } else {
        toast.success("Assessment saved.");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rate yourself: {outcomeName}</DialogTitle>
          <DialogDescription>
            Where are you today? Honest beats optimistic — re-rate any time.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Level</Label>
            <Select value={rating} onValueChange={(v) => setRating(v as string)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: string | null) =>
                    value ? TIER_LABELS[Number(value) - 1] : "Select a level"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {TIER_LABELS.map((label, i) => (
                  <SelectItem key={label} value={String(i + 1)}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Confidence (optional)</Label>
            <Select
              value={confidence}
              onValueChange={(v) => setConfidence(v as string)}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: string | null) =>
                    value ? `${value} / 5` : "How sure are you?"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} / 5
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="assessment-note">Note (optional)</Label>
            <Textarea
              id="assessment-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Evidence, gaps, or what to practice next…"
              rows={3}
            />
          </div>

          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save assessment"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
