import { cn } from "@/lib/utils";

export type MemberProgress = {
  id: string;
  label: string;
  isSelf: boolean;
  done: number;
  total: number;
};

/** One labelled progress bar per team member (self highlighted). */
export function ModuleProgressBars({ members }: { members: MemberProgress[] }) {
  return (
    <div className="flex flex-col gap-2">
      {members.map((member) => (
        <div key={member.id} className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate">
              {member.label}
              {member.isSelf && " (you)"}
            </span>
            <span className="tabular-nums">
              {member.done}/{member.total}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full",
                member.isSelf ? "bg-primary/70" : "bg-primary/40",
              )}
              style={{
                width: `${member.total > 0 ? (member.done / member.total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
