"use client";

import { Copy, Download, ExternalLink, Pencil } from "lucide-react";
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
import {
  KIND_LABELS,
  KnowledgeFormDialog,
} from "@/components/brain/knowledge-form-dialog";
import { DeleteConfirmButton } from "@/components/delete-confirm-button";
import { deleteKnowledgeItem } from "@/app/brain/actions";
import { createClient } from "@/lib/supabase/client";
import { formatBytes, readManifest } from "@/lib/knowledge-files";
import { formatDate } from "@/lib/format";
import type { KnowledgeItem, Project } from "@/lib/database.types";

const OUTCOME_STYLES: Record<string, React.CSSProperties> = {
  worked: {
    backgroundColor: "var(--v2-success-bg)",
    color: "var(--v2-success-text)",
    border: "1px solid var(--v2-success-border)",
  },
  failed: {
    backgroundColor: "var(--v2-warning-bg)",
    color: "var(--v2-danger)",
    border: "1px solid var(--v2-warning-border)",
  },
  mixed: {
    backgroundColor: "var(--v2-warning-bg)",
    color: "var(--v2-warning-text-deep)",
    border: "1px solid var(--v2-warning-border)",
  },
};

type KnowledgeCardProps = {
  item: KnowledgeItem;
  tags: string[];
  projectName: string | null;
  projects: Project[];
  tagSuggestions: string[];
  /** true = green "current", false = amber "needs review" (design freshness). */
  fresh?: boolean;
  /** e.g. "from 3 notes · 2 tickets" — null hides the purple provenance stat. */
  provenance?: string | null;
  ownerInitials?: string | null;
  ownerName?: string | null;
  /** e.g. "updated 3d ago". */
  reviewedLabel?: string;
};

export function KnowledgeCard({
  item,
  tags,
  projectName,
  projects,
  tagSuggestions,
  fresh = true,
  provenance = null,
  ownerInitials = null,
  ownerName = null,
  reviewedLabel,
}: KnowledgeCardProps) {
  const data = (item.data ?? {}) as Record<string, string>;
  const freshColor = fresh ? "#3f9b6c" : "#e0a53f";
  const freshLabel = fresh ? "current" : "needs review";
  const files = readManifest(item.data);

  function copyContent() {
    if (!item.content) return;
    navigator.clipboard.writeText(item.content).then(
      () => toast.success("Copied to clipboard."),
      () => toast.error("Couldn't copy."),
    );
  }

  function downloadPath(path: string) {
    const supabase = createClient();
    supabase.storage
      .from("files")
      .createSignedUrl(path, 60)
      .then(({ data: signed, error }) => {
        if (error || !signed) toast.error("Couldn't create a download link.");
        else window.open(signed.signedUrl, "_blank");
      });
  }

  return (
    <div
      className="flex flex-col rounded-[12px] bg-white transition-colors hover:bg-[#faf9f7]"
      style={{ border: "1px solid #ededeb", padding: "15px 17px" }}
    >
      <div className="flex-1">
        <div className="mb-[7px] flex items-start justify-between gap-[9px]">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <Dialog>
              <DialogTrigger
                render={
                  <button
                    type="button"
                    className="text-left text-[13.5px] font-semibold leading-[1.35] text-[var(--v2-ink-1)] hover:underline"
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
                      className="w-fit rounded-full px-2 py-0.5 text-xs font-medium capitalize"
                      style={OUTCOME_STYLES[data.outcome]}
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
                  {files.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase">
                        Files ({files.length})
                      </p>
                      {files.map((f) => (
                        <button
                          key={f.path}
                          type="button"
                          onClick={() => downloadPath(f.path)}
                          className="flex items-center gap-2 text-left text-sm hover:underline"
                        >
                          <Download className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="flex-1 truncate">{f.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                            {formatBytes(f.size)}
                          </span>
                        </button>
                      ))}
                    </div>
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
                    <Button
                      variant="outline"
                      onClick={() => downloadPath(item.file_path!)}
                    >
                      <Download className="size-4" />
                      Download file
                    </Button>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {/* freshness indicator (design: green current / amber needs review) */}
          <span
            className="flex flex-none items-center gap-[5px] text-[10px] whitespace-nowrap"
            style={{ color: freshColor }}
          >
            <span
              className="size-1.5 rounded-full"
              style={{ backgroundColor: freshColor }}
            />
            {freshLabel}
          </span>
        </div>
        {item.description && (
          <p className="mb-3 line-clamp-2 text-[12px] leading-normal text-[var(--v2-ink-2)]">
            {item.description}
          </p>
        )}
      </div>
      <div className="mt-auto flex items-center gap-2">
        <span
          className="font-mono min-w-0 truncate text-[10.5px]"
          style={{
            color: provenance ? "var(--v2-accent-purple)" : "var(--v2-ink-label)",
          }}
          title={tags.length > 0 ? tags.map((t) => `#${t}`).join(" ") : undefined}
        >
          {provenance
            ? `◍ ${provenance}`
            : [KIND_LABELS[item.kind], projectName].filter(Boolean).join(" · ")}
        </span>
        <span className="ml-auto flex flex-none items-center gap-1.5 text-[11px] text-[var(--v2-ink-3)]">
          {ownerInitials && (
            <span
              className="flex size-5 items-center justify-center rounded-full text-[8.5px] font-semibold"
              style={{ backgroundColor: "#e7e5e0", color: "#57534e" }}
              title={ownerName ?? undefined}
            >
              {ownerInitials}
            </span>
          )}
          {reviewedLabel}
        </span>
        <div className="flex shrink-0 items-center">
          <KnowledgeFormDialog
            item={item}
            initialTags={tags}
            projects={projects}
            tagSuggestions={tagSuggestions}
            trigger={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Edit item"
                className="text-[var(--v2-ink-3)] hover:bg-[#efece7] hover:text-[var(--v2-ink-1)]"
              >
                <Pencil className="size-3.5" />
              </Button>
            }
          />
          <DeleteConfirmButton
            itemName={`"${item.title}" from the brain`}
            ariaLabel="Delete item"
            onDelete={() => deleteKnowledgeItem(item.id)}
          />
        </div>
      </div>
    </div>
  );
}
