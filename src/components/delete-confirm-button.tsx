"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type DeleteConfirmButtonProps = {
  itemName: string;
  ariaLabel: string;
  onDelete: () => Promise<{ error?: string | null }>;
  onDeleted?: () => void;
  successMessage?: string;
};

export function DeleteConfirmButton({
  itemName,
  ariaLabel,
  onDelete,
  onDeleted,
  successMessage = "Deleted.",
}: DeleteConfirmButtonProps) {
  const [pending, startTransition] = useTransition();

  function confirmDelete() {
    startTransition(async () => {
      const { error } = await onDelete();
      if (error) {
        toast.error(error);
      } else {
        toast.success(successMessage);
        onDeleted?.();
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={pending}
            aria-label={ariaLabel}
          />
        }
      >
        <Trash2 className="size-3.5 text-muted-foreground" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {itemName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose>Cancel</AlertDialogClose>
          <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
