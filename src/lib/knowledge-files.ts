/** Shared types/helpers for multi-file & folder uploads on knowledge items. */

export type KnowledgeFile = { path: string; name: string; size: number };

// Free Supabase tier is ~1 GB total, so keep per-item uploads modest.
export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB per file
export const MAX_TOTAL_BYTES = 100 * 1024 * 1024; // 100 MB per item
export const MAX_FILES = 50;

// Skip VCS/build/dependency junk and dotfiles when a folder is uploaded.
const IGNORE =
  /(^|\/)(node_modules|\.git|\.next|dist|build|coverage|__pycache__)(\/|$)|(^|\/)\.[^/]+$/;

export function isIgnoredPath(relPath: string): boolean {
  return IGNORE.test(relPath);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Safely read a stored file manifest out of a knowledge item's `data` jsonb. */
export function readManifest(data: unknown): KnowledgeFile[] {
  if (!data || typeof data !== "object") return [];
  const files = (data as { files?: unknown }).files;
  if (!Array.isArray(files)) return [];
  return files.filter(
    (f): f is KnowledgeFile =>
      !!f &&
      typeof f === "object" &&
      typeof (f as KnowledgeFile).path === "string" &&
      typeof (f as KnowledgeFile).name === "string" &&
      typeof (f as KnowledgeFile).size === "number",
  );
}
