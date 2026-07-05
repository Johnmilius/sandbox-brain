"use client";

import { DeleteConfirmButton } from "@/components/delete-confirm-button";
import { deleteTimeEntry } from "@/app/time/actions";

export function DeleteEntryButton({ entryId }: { entryId: string }) {
  return (
    <DeleteConfirmButton
      itemName="this time entry"
      ariaLabel="Delete entry"
      successMessage="Entry deleted."
      onDelete={() => deleteTimeEntry(entryId)}
    />
  );
}
