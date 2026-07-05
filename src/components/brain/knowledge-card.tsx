"use client";

import { useTransition } from "react";
import {
  Archive,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Lightbulb,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  KIND_LABELS,
  KnowledgeFormDialog,
} from "@/components/brain/knowledge-form-dialog";
import { deleteKnowledgeItem } from "@/app/brain/actions";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/format";
import type {
  KnowledgeItem,
  KnowledgeKind,
  Project,
} from "@/lib/database.types";

const KIND_ICONS: Record<KnowledgeKind, typeof Code2> = {
  code_snippet: Code2,
  decision: Lightbulb,
  document: FileText,
  contact: Users,
  project_archive: Archive,
};

const OUTCOME_STYLES: Record<string, string> = {
  worked: "bg-green-500/15 text-green-700 dark:text-green-400",
  failed: "bg-red-500/15 text-red-700 dark:text-red-400",
  mixed: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
};

type KnowledgeCardProps = {
  item: KnowledgeItem;
  tags: string[];
  projectName: string | null;
  projects: Project[];
  tagSuggestions: string[];
};

export function KnowledgeCard({
  item,
  tags,
  projectName,
  projects,
  tagSuggestions,
}: KnowledgeCardProps) {
  const [pending, startTransition] = useTransition();
  const Icon = KIND_ICONS[item.kind];
  const data = (item.data ?? {}) as Record<string, string>;

  function copyContent() {
    if (!item.content) return;
    navigator.clipboard.writeText(item.content).then(
      () => toast.success("Copied to clipboard."),
      () => toast.error("Couldn't copy."),
    );
  }

  function downloadFile() {
    if (!item.file_path) return;
    const supabase = createClient();
    supabase.storage
      .from("files")
      .createSignedUrl(item.file_path, 60)
      .then(({ data: signed, error }) => {
        if (error || !signed) toast.error("Couldn't create a download link.");
        else window.open(signed.signedUrl, "_blank");
      });
  }

  function onDelete() {
    if (!confirm(`Delete "${item.title}" from the brain?`)) return;
    startTransition(async () => {
      const { error } = await deleteKnowledgeItem(item.id);
      if (error) toast.error(error);
      else toast.success("Deleted.");
    });
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
              <Icon className="size-3.5" />
            </span>
            <Dialog>
              <DialogTrigger
                render={
                  <button
                    type="button"
                    className="truncate text-left font-medium leading-snug hover:underline"
                  />
                }
              >
                {item.title}
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>{item.title}</DialogTitle>
                  <DialogDescription>
                    {[
                      KIND_LABELS[item.kind],
                      data.language,
                      data.contact_type,
                      projectName,
                      formatDate(item.created_at),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </DialogDescription>
                </DialogHeader>
                <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
                  {item.description && (
                    <p className="text-sm">{item.description}</p>
                  )}
                  {data.outcome && (
                    <span
                      className={`w-fit rounded-md px-2 py-0.5 text-xs font-medium capitalize ${OUTCOME_STYLES[data.outcome] ?? ""}`}
                    >
                      {data.outcome}
                    </span>
                  )}
                  {data.contact_info && (
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                      {data.contact_info}
                    </p>
                  )}
                  {item.content && (
                    <pre className="rounded-lg bg-muted p-3 font-mono text-xs whitespace-pre-wrap break-words">
                      {item.content}
                    </pre>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.content && item.kind === "code_snippet" && (
                    <Button variant="outline" onClick={copyContent}>
                      <Copy className="size-4" />
                      Copy code
                    </Button>
                  )}
                  {item.url && (
                    <Button
                      variant="outline"
                      onClick={() => window.open(item.url!, "_blank")}
                    >
                      <ExternalLink className="size-4" />
                      Open link
                    </Button>
                  )}
                  {item.file_path && (
                    <Button variant="outline" onClick={downloadFile}>
                      <Download className="size-4" />
                      Download file
                    </Button>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {data.outcome && (
            <span
              className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium capitalize ${OUTCOME_STYLES[data.outcome] ?? ""}`}
            >
              {data.outcome}
            </span>
          )}
        </div>
        {item.description && (
          <CardDescription className="line-clamp-2">
            {item.description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-2 pt-0">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Badge variant="outline">{KIND_LABELS[item.kind]}</Badge>
          {projectName && <Badge variant="outline">{projectName}</Badge>}
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
        <div className="flex shrink-0 items-center">
          <KnowledgeFormDialog
            item={item}
            initialTags={tags}
            projects={projects}
            tagSuggestions={tagSuggestions}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label="Edit item">
                <Pencil className="size-3.5" />
              </Button>
            }
          />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            disabled={pending}
            aria-label="Delete item"
          >
            <Trash2 className="size-3.5 text-muted-foreground" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
