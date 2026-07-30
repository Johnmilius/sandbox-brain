"use server";

/**
 * Keyset pagination for the home activity feed (events timeline).
 * Cursor = (occurred_at, id) of the last rendered event — index-backed via
 * events_feed_idx, no OFFSET (roadmap Pillar 3 acceptance criterion).
 */

import { createClient } from "@/lib/supabase/server";
import { eventToFeedItem } from "@/lib/event-feed";
import {
  ACTOR_COLORS,
  buildActorColorMap,
  relativeTime,
  shortNameOf,
} from "@/lib/home-digest";
import type { FlowFeedItem } from "@/components/home/flowing-feed";

export type FeedCursor = { occurredAt: string; id: string };

const PAGE_SIZE = 20;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function fetchFeedPage(
  cursor: FeedCursor,
): Promise<{ items: FlowFeedItem[]; nextCursor: FeedCursor | null }> {
  // The cursor round-trips through the client — validate before it reaches
  // the PostgREST or() filter string.
  if (!UUID_RE.test(cursor.id) || Number.isNaN(Date.parse(cursor.occurredAt))) {
    return { items: [], nextCursor: null };
  }

  const supabase = await createClient();
  const [eventsRes, profilesRes] = await Promise.all([
    supabase
      .from("events")
      .select(
        "id, actor_id, verb, object_type, object_id, object_label, target_type, target_id, target_label, occurred_at",
      )
      .or(
        `occurred_at.lt."${cursor.occurredAt}",and(occurred_at.eq."${cursor.occurredAt}",id.lt.${cursor.id})`,
      )
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(PAGE_SIZE),
    supabase.from("profiles").select("id, full_name, email"),
  ]);
  if (eventsRes.error) return { items: [], nextCursor: null };

  const rows = eventsRes.data ?? [];
  const profiles = profilesRes.data ?? [];
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const colorById = buildActorColorMap(profiles);
  const now = new Date();

  const items: FlowFeedItem[] = rows.map((e) => {
    const item = eventToFeedItem(e, (id) => shortNameOf(profileById.get(id)));
    return {
      ...item,
      actorColor: colorById.get(item.actorId) ?? ACTOR_COLORS[0],
      timeLabel: relativeTime(item.at, now),
    };
  });

  const last = rows[rows.length - 1];
  return {
    items,
    nextCursor:
      rows.length === PAGE_SIZE
        ? { occurredAt: last.occurred_at, id: last.id }
        : null,
  };
}
