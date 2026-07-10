import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

/**
 * Presentational empty state: icon tile + display headline + muted body +
 * optional CTA slot. Used across list/detail pages once they drop the
 * shadcn <Card>-based placeholders in later V2 tasks.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-14 text-center",
        className,
      )}
    >
      <div className="flex size-11 items-center justify-center rounded-xl bg-[var(--v2-sidebar-bg)] text-[var(--v2-ink-3)]">
        <Icon className="size-5" />
      </div>
      <h3 className="font-display text-lg text-[var(--v2-ink-1)]">{title}</h3>
      {description && (
        <p className="max-w-sm text-sm text-[var(--v2-ink-2)]">
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
