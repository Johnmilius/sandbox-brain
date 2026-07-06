"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactElement,
} from "react";
import { X } from "lucide-react";
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
import { TagSuggestions } from "@/components/tag-suggestions";
import { createKnowledgeItem, updateKnowledgeItem } from "@/app/brain/actions";
import { createClient } from "@/lib/supabase/client";
import {
  MAX_FILES,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
  formatBytes,
  isIgnoredPath,
  readManifest,
  type KnowledgeFile,
} from "@/lib/knowledge-files";
import type {
  Json,
  KnowledgeItem,
  KnowledgeKind,
  Project,
} from "@/lib/database.types";

type PickedFile = { file: File; key: string };

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
  const [scanText, setScanText] = useState(
    `${item?.title ?? ""} ${item?.description ?? ""} ${item?.content ?? ""}`,
  );
  const [picked, setPicked] = useState<PickedFile[]>([]);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  const itemData = (item?.data ?? {}) as Record<string, string>;
  const existingFiles = readManifest(item?.data);

  // `webkitdirectory` isn't a typed React attribute — set it imperatively.
  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute("webkitdirectory", "");
      folderInputRef.current.setAttribute("directory", "");
    }
  }, []);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming: PickedFile[] = [];
    for (const file of Array.from(list)) {
      const rel = file.webkitRelativePath || file.name;
      if (isIgnoredPath(rel)) continue;
      incoming.push({ file, key: `${rel}:${file.size}` });
    }
    setPicked((prev) => {
      const seen = new Set(prev.map((p) => p.key));
      return [...prev, ...incoming.filter((p) => !seen.has(p.key))];
    });
  }

  function removeFile(key: string) {
    setPicked((prev) => prev.filter((p) => p.key !== key));
  }

  const pickedTotal = picked.reduce((n, p) => n + p.file.size, 0);
  const overCap =
    picked.length > MAX_FILES ||
    pickedTotal > MAX_TOTAL_BYTES ||
    picked.some((p) => p.file.size > MAX_FILE_BYTES);

  function rescan(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const form = event.currentTarget.form;
    if (!form) return;
    const fd = new FormData(form);
    setScanText(
      `${fd.get("title") ?? ""} ${fd.get("description") ?? ""} ${fd.get("content") ?? ""}`,
    );
  }

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

    if (overCap) {
      toast.error(
        `Too much to upload — keep it under ${MAX_FILES} files and ${formatBytes(MAX_TOTAL_BYTES)}.`,
      );
      return;
    }

    startTransition(async () => {
      // New uploads replace the file manifest; otherwise keep what's attached.
      let manifest: KnowledgeFile[] = existingFiles;
      if (picked.length > 0) {
        const supabase = createClient();
        const prefix = `${kind}/${crypto.randomUUID()}`;
        const uploaded: KnowledgeFile[] = [];
        for (const { file } of picked) {
          const rel = (file.webkitRelativePath || file.name).replace(/^\/+/, "");
          const path = `${prefix}/${rel}`;
          const { error: uploadError } = await supabase.storage
            .from("files")
            .upload(path, file);
          if (uploadError) {
            toast.error(`Upload failed (${rel}): ${uploadError.message}`);
            return;
          }
          uploaded.push({ path, name: rel, size: file.size });
        }
        manifest = uploaded;
      }
      if (manifest.length > 0) {
        data.files = manifest as unknown as Json;
      }

      const input = {
        kind,
        title,
        description: String(form.get("description") ?? ""),
        content: String(form.get("content") ?? ""),
        data,
        url: String(form.get("url") ?? ""),
        // Legacy single-file column: null once a manifest exists.
        filePath: picked.length > 0 ? null : (item?.file_path ?? null),
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
        setPicked([]);
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
            <Input
              id="title"
              name="title"
              defaultValue={item?.title}
              onChange={rescan}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">
              {kind === "decision" ? "Context" : "Description"}
            </Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={item?.description ?? ""}
              onChange={rescan}
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
                  onChange={rescan}
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
                  onChange={rescan}
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
                  ? "Upload files or a whole folder"
                  : "Upload files"}
              </Label>
              <div className="flex flex-wrap gap-2">
                <Input
                  id="file"
                  type="file"
                  multiple
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => folderInputRef.current?.click()}
                >
                  Add folder
                </Button>
                <input
                  ref={folderInputRef}
                  type="file"
                  multiple
                  hidden
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>

              {picked.length > 0 && (
                <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border p-2 text-sm">
                  {picked.map(({ file, key }) => {
                    const rel = file.webkitRelativePath || file.name;
                    const tooBig = file.size > MAX_FILE_BYTES;
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <span
                          className={`flex-1 truncate ${tooBig ? "text-destructive" : ""}`}
                        >
                          {rel}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {formatBytes(file.size)}
                        </span>
                        <button
                          type="button"
                          aria-label={`Remove ${rel}`}
                          onClick={() => removeFile(key)}
                          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-foreground/10"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    );
                  })}
                  <p className="pt-1 text-xs text-muted-foreground">
                    {picked.length} file{picked.length === 1 ? "" : "s"} ·{" "}
                    {formatBytes(pickedTotal)}
                    {overCap && (
                      <span className="text-destructive">
                        {" "}
                        · over the limit
                      </span>
                    )}
                  </p>
                </div>
              )}

              {picked.length === 0 && existingFiles.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {existingFiles.length} file
                  {existingFiles.length === 1 ? "" : "s"} attached — adding new
                  ones replaces them.
                </p>
              )}
              {picked.length === 0 && item?.file_path && (
                <p className="text-xs text-muted-foreground">
                  Currently attached: {item.file_path.split("/").pop()} — uploading
                  replaces it.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Prefer links for big things — free storage is 1 GB total. Folders
                skip node_modules, .git, and dotfiles.
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
            <TagSuggestions
              text={scanText}
              vocabulary={tagSuggestions}
              selected={tags}
              onAdd={(t) => setTags((prev) => [...prev, t])}
            />
          </div>

          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : item ? "Save changes" : "Add to brain"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
