"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Brain as BrainIcon,
  Clock,
  GraduationCap,
  House,
  Lightbulb,
  LayoutGrid,
  Pencil,
  Quote,
  Sparkles,
  SquareKanban,
  TrendingUp,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TimerChip } from "@/components/shell/timer-chip";
import type { TimeEntry } from "@/lib/database.types";

export type NavBadges = {
  projects: string;
  ideas: string;
  tasks: string;
  time: string;
};

export const NAV_ITEMS: {
  href: string;
  label: string;
  icon: LucideIcon;
  badgeKey?: keyof NavBadges;
}[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/projects", label: "Projects", icon: LayoutGrid, badgeKey: "projects" },
  { href: "/ideas", label: "Ideas", icon: Lightbulb, badgeKey: "ideas" },
  { href: "/tasks", label: "Tasks", icon: SquareKanban, badgeKey: "tasks" },
  { href: "/time", label: "Time", icon: Clock, badgeKey: "time" },
  { href: "/prompts", label: "Prompts", icon: Quote },
  { href: "/agents", label: "Agents", icon: Sparkles },
  { href: "/notes", label: "Notes", icon: Pencil },
  { href: "/brain", label: "Brain", icon: BrainIcon },
  { href: "/graph", label: "Graph", icon: Waypoints },
  { href: "/academy", label: "Academy", icon: GraduationCap },
  { href: "/growth", label: "Growth", icon: TrendingUp },
];

type RunningEntry = TimeEntry & { projectName: string };

type SidebarProps = {
  badges: NavBadges;
  name: string;
  initials: string;
  runningEntry: RunningEntry | null;
};

export function Sidebar({ badges, name, initials, runningEntry }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className="flex h-full w-[224px] shrink-0 flex-col border-r"
      style={{
        backgroundColor: "var(--v2-sidebar-bg)",
        borderColor: "#ededeb",
        padding: "18px 13px",
      }}
    >
      <Link
        href="/"
        className="flex items-center gap-[9px] px-2 pt-0.5 pb-[18px]"
      >
        <span
          className="flex size-[26px] shrink-0 items-center justify-center rounded-[7px] bg-[#1c1c1f] text-white"
          aria-hidden
        >
          ◨
        </span>
        <span className="text-[14.5px] font-semibold text-[var(--v2-ink-1)]">
          Sandbox Brain
        </span>
      </Link>

      <div className="font-mono-label font-mono-label-sm px-2 pb-2">
        WORKSPACE
      </div>

      <nav className="flex flex-1 flex-col gap-px overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon, badgeKey }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          const badge = badgeKey ? badges[badgeKey] : undefined;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-[8px] px-[9px] py-[7px] text-[13.5px] transition-colors",
                active
                  ? "bg-[#efece7] font-medium text-[var(--v2-ink-1)]"
                  : "font-normal text-[#57534e] hover:bg-[#efece7]",
              )}
            >
              <Icon
                className={cn(
                  "size-4 shrink-0",
                  active ? "text-[var(--v2-ink-2)]" : "text-[var(--v2-ink-4)]",
                )}
              />
              <span className="flex-1 truncate">{label}</span>
              {badge && (
                <span className="font-mono text-[10px] text-[var(--v2-ink-label)]">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-2 flex flex-col gap-2">
        <TimerChip runningEntry={runningEntry} />

        <div className="flex items-center gap-2 px-1 py-1">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#e7e5e0] text-[10px] font-medium text-[#57534e]">
            {initials}
          </span>
          <span className="truncate text-[12.5px] text-[#57534e]">{name}</span>
        </div>
      </div>
    </aside>
  );
}
