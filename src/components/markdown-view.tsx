import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Shared markdown renderer. Pass note bodies through rewriteWikiLinks()
 * first if they may contain [[wiki-links]].
 */
export function MarkdownView({ markdown }: { markdown: string }) {
  return (
    <div className="max-w-none space-y-3 [&_a]:rounded-[3px] [&_a]:font-medium [&_a]:text-[var(--v2-accent-purple)] [&_a]:underline [&_a]:decoration-[var(--v2-wikilink-underline)] [&_a]:underline-offset-2 [&_a:hover]:bg-[var(--v2-wikilink-hover-bg)] [&_a:hover]:text-[var(--v2-accent-purple-hover)] [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-semibold [&_hr]:my-4 [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:w-full [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1 [&_ul]:list-disc [&_ul]:pl-5">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}
