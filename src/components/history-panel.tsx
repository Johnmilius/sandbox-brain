import type { ObjectType } from "@sandbox-brain/core";
import { createClient } from "@/lib/supabase/server";

/**
 * Per-object History: this object's rows from the events timeline
 * (migration 0009), newest first. Server component — drop it onto any
 * object detail page with the object's (type, id).
 *
 * Renders nothing until the events table exists or the object has history,
 * so it is safe to mount everywhere.
 */

const VERB_LABEL: Record<string, string> = {
  created: "created",
  updated: "updated",
  completed: "completed",
  started: "started a timer",
  logged_time: "logged time",
  linked: "linked",
  rated: "rated",
  promoted: "promoted",
  claimed: "claimed",
  ingested: "ingested",
};

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export async function HistoryPanel({
  objectType,
  objectId,
  limit = 10,
}: {
  objectType: ObjectType;
  objectId: string;
  limit?: number;
}) {
  const supabase = await createClient();
  const [{ data: events, error }, { data: profiles }] = await Promise.all([
    supabase
      .from("events")
      .select("id, actor_id, verb, target_label, source, occurred_at")
      .eq("object_type", objectType)
      .eq("object_id", objectId)
      .order("occurred_at", { ascending: false })
      .limit(limit),
    supabase.from("profiles").select("id, full_name, email"),
  ]);
  if (error || !events || events.length === 0) return null;

  const nameById = new Map(
    (profiles ?? []).map((p) => [p.id, (p.full_name ?? p.email).split(/[\s@]+/)[0]]),
  );

  return (
    <section className="mt-8">
      <p className="font-mono-label mb-3">History</p>
      <ol className="flex flex-col gap-2">
        {events.map((e) => (
          <li
            key={e.id}
            className="flex items-baseline gap-2 text-[12.5px] text-[var(--v2-ink-2)]"
          >
            <span className="font-mono shrink-0 text-[10.5px] tabular-nums text-[var(--v2-ink-3)]">
              {when(e.occurred_at)}
            </span>
            <span className="min-w-0">
              <span className="font-medium text-[var(--v2-ink-1)]">
                {e.actor_id ? nameById.get(e.actor_id) ?? "Someone" : "System"}
              </span>{" "}
              {VERB_LABEL[e.verb] ?? e.verb.replace(/_/g, " ")}
              {e.target_label ? ` → ${e.target_label}` : ""}
              {e.source !== "app" ? (
                <span className="text-[var(--v2-ink-4)]"> · via {e.source}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
