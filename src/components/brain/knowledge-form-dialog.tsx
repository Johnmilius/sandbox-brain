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
import { TagInput } from "@/components/tag-input";
import { createKnowledgeItem, updateKnowledgeItem } from "@/app/brain/actions";
import { createClient } from "@/lib/supabase/client";
import type {
  Json,
  KnowledgeItem,
  KnowledgeKind,
  Project,
} from "@/lib/database.types";

const NONE = "__none__";

export const KIND_LABELS: Record<KnowledgeKind, string> = {
  code_snippet: "Code snippet",
  decision: "Decision / learning",
  document: "Document",
  contact: "Contact / resource",
  project_archive: "Project archive",
};

type KnowledgeFormDialogProps = {
  item?: KnowledgeItem; // present = edit mode
  initialTags?: string[];
  projects: Project[];
  tagSuggestions: string[];
  trigger: ReactElement<Record<string, unknown>>;
};

export function KnowledgeFormDialog({
  item,
  initialTags = [],
  projects,
  tagSuggestions,
  trigger,
}: KnowledgeFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<KnowledgeKind>(item?.kind ?? "code_snippet");
  const [tags, setTags] = useState<string[]>(initialTags);
  const [projectId, setProjectId] = useState<string>(item?.project_id ?? NONE);
  const [outcome, setOutcome] = useState<string>(
    ((item?.data as Record<string, string> | null)?.outcome as string) ?? "worked",
  );
  const [contactType, setContactType] = useState<string>(
    ((item?.data as Record<string, string> | null)?.contact_type as string) ??
      "person",
  );
  const [pending, startTransition] = useTransition();

  const itemData = (item?.data ?? {}) as Record<string, string>;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    if (!title) {
      toast.error("Title is required.");
      return;
    }

    const data: Record<string, Json> = {};
    if (kind === "code_snippet") {
      data.language = String(form.get("language") ?? "").trim().toLowerCase();
    }
    if (kind === "decision") data.outcome = outcome;
    if (kind === "contact") {
      data.contact_type = contactType;
      data.contact_info = String(form.get("contact_info") ?? "").trim();
    }

    const file = form.get("file") as File | null;

    startTransition(async () => {
      let filePath: string | null = item?.file_path ?? null;
      if (file && file.size > 0) {
        const supabase = createClient();
        const path = `${kind}/${crypto.randomUUID()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("files")
          .upload(path, file);
        if (uploadError) {
          toast.error(`Upload failed: ${uploadError.message}`);
          return;
        }
        filePath = path;
      }

      const input = {
        kind,
        title,
        description: String(form.get("description") ?? ""),
        content: String(form.get("content") ?? ""),
        data,
        url: String(form.get("url") ?? ""),
        filePath,
        projectId: projectId === NONE ? null : projectId,
      };

      const { error } = item
        ? await updateKnowledgeItem(item.id, input, tags)
        : await createKnowledgeItem(input, tags);
      if (error) {
        toast.error(error);
      } else {
        toast.success(item ? "Item updated." : "Added to the brain.");
        setOpen(false);
        if (!item) setTags([]);
      }
    });
  }

  const showUpload = kind === "document" || kind === "project_archive";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {item ? "Edit item" : "Add to the brain"}
          </DialogTitle>
          <DialogDescription>
            Reusable knowledge for future projects and companies.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={onSubmit}
          className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1"
        >
          <div className="flex flex-col gap-2">
            <Label>Type</Label>
            <Select
              value={kind}
              onValueChange={(v) => setKind(v as KnowledgeKind)}
              disabled={Boolean(item)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(KIND_LABELS) as KnowledgeKind[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {KIND_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="title">
              {kind === "contact" ? "Name" : "Title"}
            </Label>
            <Input id="title" name="title" defaultValue={item?.title} required />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">
              {kind === "decision" ? "Context" : "Description"}
            </Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={item?.description ?? ""}
              rows={2}
              placeholder={
                kind === "decision"
                  ? "What was the situation?"
                  : "What is this and when would we reuse it?"
              }
            />
          </div>

          {kind === "code_snippet" && (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="language">Language</Label>
                <Input
                  id="language"
                  name="language"
                  defaultValue={itemData.language ?? ""}
                  placeholder="typescript, python, sql…"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="content">Code</Label>
                <Textarea
                  id="content"
                  name="content"
                  defaultValue={item?.content ?? ""}
                  rows={8}
                  className="font-mono text-xs"
                  placeholder="Paste the reusable code…"
                />
              </div>
            </>
          )}

          {kind === "decision" && (
            <>
              <div className="flex flex-col gap-2">
                <Label>Outcome</Label>
                <Select value={outcome} onValueChange={(v) => setOutcome(v as string)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="worked">Worked</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="content">What we tried & what we learned</Label>
                <Textarea
                  id="content"
                  name="content"
                  defaultValue={item?.content ?? ""}
                  rows={6}
                  placeholder="What did we do, what happened, and why?"
                />
              </div>
            </>
          )}

          {kind === "contact" && (
            <>
              <div className="flex flex-col gap-2">
                <Label>Type</Label>
                <Select
                  value={contactType}
                  onValueChange={(v) => setContactType(v as string)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="person">Person</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                    <SelectItem value="tool">Tool / service</SelectItem>
                    <SelectItem value="community">Community</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="contact_info">Contact info</Label>
                <Textarea
                  id="contact_info"
                  name="contact_info"
                  defaultValue={itemData.contact_info ?? ""}
                  rows={2}
                  placeholder="Email, phone, links…"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="content">Notes</Label>
                <Textarea
                  id="content"
                  name="content"
                  defaultValue={item?.content ?? ""}
                  rows={3}
                  placeholder="How do we know them? What are they good for?"
                />
              </div>
            </>
          )}

          {(kind === "document" || kind === "project_archive") && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="url">
                {kind === "project_archive" ? "GitHub repo URL" : "Link (URL)"}
              </Label>
              <Input
                id="url"
                name="url"
                type="url"
                defaultValue={item?.url ?? ""}
                placeholder={
                  kind === "project_archive"
                    ? "https://github.com/you/repo"
                    : "https://…"
                }
              />
            </div>
          )}

          {showUpload && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="file">
                {kind === "project_archive"
                  ? "Or upload a zip snapshot"
                  : "Or upload a file"}
              </Label>
              <Input id="file" name="file" type="file" />
              {item?.file_path && (
                <p className="text-xs text-muted-foreground">
                  Currently attached: {item.file_path.split("/").pop()} — uploading
                  replaces it.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Prefer links for big things — free storage is 1 GB total.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label>Project</Label>
            <Select
              value={projectId}
              onValueChange={(v) => setProjectId(v as string)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No project</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Tags</Label>
            <TagInput value={tags} onChange={setTags} suggestions={tagSuggestions} />
          </div>

          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : item ? "Save changes" : "Add to brain"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
