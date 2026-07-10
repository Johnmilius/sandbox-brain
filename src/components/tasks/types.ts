import type {
  TaskArea,
  TaskChecklistItem,
  TaskPriority,
  TaskStatus,
} from "@/lib/database.types";

/** A person option for assignee pickers and avatars. */
export type PersonOption = {
  id: string;
  label: string;
  initials: string;
};

/** A project option for filter pills and the new-ticket dialog. */
export type ProjectOption = {
  id: string;
  name: string;
  prefix: string;
};

/** Something a ticket links to in the brain (read-only in V2). */
export type TaskLink = {
  kind: string;
  label: string;
  href: string;
};

/** View model the server page assembles for each ticket. */
export type TaskVM = {
  id: string;
  ticketId: string;
  projectId: string;
  projectName: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  area: TaskArea;
  status: TaskStatus;
  assignee: PersonOption | null;
  claimedBy: PersonOption | null;
  checklist: TaskChecklistItem[];
  links: TaskLink[];
  /** Ticket ids + names this task conflicts with (same project+area, both inprogress). */
  conflictsWith: { ticketId: string; name: string }[];
};

export const STATUS_COLUMNS: { value: TaskStatus; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "To do" },
  { value: "inprogress", label: "In progress" },
  { value: "review", label: "Review" },
  { value: "done", label: "Done" },
];

export const PRIORITY_META: Record<
  TaskPriority,
  { label: string; color: string }
> = {
  high: { label: "High", color: "#b0442e" },
  med: { label: "Med", color: "#e0a53f" },
  low: { label: "Low", color: "#a8a29e" },
};

export const AREA_META: Record<
  TaskArea,
  { label: string; fg: string; bg: string }
> = {
  frontend: { label: "Frontend", fg: "#4a5b8a", bg: "#eef1f8" },
  backend: { label: "Backend", fg: "#3f7a56", bg: "#eef6f0" },
  design: { label: "Design", fg: "#6a5f8a", bg: "#f1eefc" },
  copy: { label: "Copy", fg: "#8a6a2a", bg: "#f8f1e6" },
};
