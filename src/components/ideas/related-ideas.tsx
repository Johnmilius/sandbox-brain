"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Link2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { linkIdeas, unlinkIdeas } from "@/app/ideas/actions";

type IdeaOption = { id: string; title: string };

export function RelatedIdeas({
  ideaId,
  linked,
  options,
}: {
  ideaId: string;
  linked: IdeaOption[];
  options: IdeaOption[];
}) {
  const [selected, setSelected] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const linkedIds = new Set(linked.map((l) => l.id));
  const pickable = options.filter((o) => !linkedIds.has(o.id));

  function onLink() {
    if (!selected) return;
    startTransition(async () => {
      const { error } = await linkIdeas(ideaId, selected);
      if (error) {
        toast.error(error);
      } else {
        toast.success("Linked.");
        setSelected("");
        router.refresh();
      }
    });
  }

  function onUnlink(otherId: string) {
    startTransition(async () => {
      const { error } = await unlinkIdeas(ideaId, otherId);
      if (error) {
        toast.error(error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium text-muted-foreground uppercase">
        Related ideas
      </p>

      {linked.length === 0 ? (
        <p className="text-sm text-muted-foreground">No related ideas linked yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {linked.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2">
              <Link
                href={`/ideas/${l.id}`}
                className="flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <Link2 className="size-3.5" />
                {l.title}
              </Link>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Unlink idea"
                disabled={pending}
                onClick={() => onUnlink(l.id)}
              >
                <X className="size-3.5 text-muted-foreground" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {pickable.length > 0 && (
        <div className="flex items-center gap-2">
          <Select value={selected} onValueChange={(v) => setSelected(v ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Link another idea…" />
            </SelectTrigger>
            <SelectContent>
              {pickable.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" disabled={!selected || pending} onClick={onLink}>
            <Plus className="size-3.5" />
            Link
          </Button>
        </div>
      )}
    </div>
  );
}
