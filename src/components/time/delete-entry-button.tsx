"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteTimeEntry } from "@/app/time/actions";

export function DeleteEntryButton({ entryId }: { entryId: string }) {
  const [pending, startTransition] = useTransition();

  function onDelete() {
    startTransition(async () => {
      const { error } = await deleteTimeEntry(entryId);
      if (error) toast.error(error);
      else toast.success("Entry deleted.");
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={onDelete}
      disabled={pending}
      aria-label="Delete entry"
    >
      <Trash2 className="size-3.5 text-muted-foreground" />
    </Button>
  );
}
