"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Rocket } from "lucide-react";
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
import { promoteIdeaToProject } from "@/app/ideas/actions";

export function PromoteIdeaButton({ ideaId, title }: { ideaId: string; title: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onPromote() {
    startTransition(async () => {
      const { error } = await promoteIdeaToProject(ideaId);
      if (error) {
        toast.error(error);
      } else {
        toast.success("Promoted to a project.");
        router.push("/projects");
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button size="sm" disabled={pending} />}>
        <Rocket className="size-3.5" />
        Promote to project
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Promote &quot;{title}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            Creates a new project from this idea and marks the idea as
            promoted. The idea stays around as the origin record.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose>Cancel</AlertDialogClose>
          <AlertDialogAction onClick={onPromote}>Promote</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
