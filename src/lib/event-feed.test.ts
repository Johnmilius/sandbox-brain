import { describe, expect, it } from "vitest";
import { eventToFeedItem, eventedObjectKeys } from "./event-feed";

const names = (id: string) => (id === "u1" ? "Luke" : "Someone");

describe("eventToFeedItem", () => {
  it("maps a note creation to a note-kind item linking to the note", () => {
    const item = eventToFeedItem(
      {
        id: "e1",
        actor_id: "u1",
        verb: "created",
        object_type: "note",
        object_id: "n1",
        object_label: "Kickoff notes",
        target_type: null,
        target_id: null,
        target_label: null,
        occurred_at: "2026-07-12T10:00:00Z",
      },
      names,
    );
    expect(item).toMatchObject({
      actor: "Luke",
      verb: "created",
      object: "Kickoff notes",
      context: "notes",
      href: "/notes/n1",
      kind: "note",
    });
  });

  it("anchors time events on the target project", () => {
    const item = eventToFeedItem(
      {
        id: "e2",
        actor_id: "u1",
        verb: "logged_time",
        object_type: "time_entry",
        object_id: "t1",
        object_label: null,
        target_type: "project",
        target_id: "p1",
        target_label: "Acme",
        occurred_at: "2026-07-12T11:00:00Z",
      },
      names,
    );
    expect(item).toMatchObject({
      verb: "logged time on",
      object: "Acme",
      context: "time",
      href: "/time",
      kind: "time",
    });
  });

  it("uses the target label as context for linked events", () => {
    const item = eventToFeedItem(
      {
        id: "e3",
        actor_id: "u1",
        verb: "promoted",
        object_type: "idea",
        object_id: "i1",
        object_label: "Graph search",
        target_type: "project",
        target_id: "p2",
        target_label: "Graph search",
        occurred_at: "2026-07-12T12:00:00Z",
      },
      names,
    );
    expect(item.context).toBe("Graph search");
    expect(item.href).toBe("/ideas/i1");
  });

  it("links deleted objects to their section, not the dead page", () => {
    const item = eventToFeedItem(
      {
        id: "e5",
        actor_id: "u1",
        verb: "deleted",
        object_type: "note",
        object_id: "n9",
        object_label: "Old note",
        target_type: null,
        target_id: null,
        target_label: null,
        occurred_at: "2026-07-12T14:00:00Z",
      },
      names,
    );
    expect(item.href).toBe("/notes");
    expect(item.verb).toBe("deleted");
  });

  it("labels system events and unknown verbs safely", () => {
    const item = eventToFeedItem(
      {
        id: "e4",
        actor_id: null,
        verb: "ingested",
        object_type: "knowledge_item",
        object_id: "k1",
        object_label: null,
        target_type: null,
        target_id: null,
        target_label: null,
        occurred_at: "2026-07-12T13:00:00Z",
      },
      names,
    );
    expect(item.actor).toBe("System");
    expect(item.object).toBe("Knowledge item");
    expect(item.kind).toBe("knowledge");
  });
});

describe("eventedObjectKeys", () => {
  it("keys rows by type and id so the legacy feed can skip evented objects", () => {
    const keys = eventedObjectKeys([
      { object_type: "note", object_id: "n1" },
      { object_type: "time_entry", object_id: "t1" },
    ]);
    expect(keys.has("note:n1")).toBe(true);
    expect(keys.has("time_entry:t1")).toBe(true);
    // A note the timeline hasn't recorded must still come through the legacy
    // union — this is what keeps non-emitting clients (the Mac and iOS apps)
    // visible in the feed.
    expect(keys.has("note:n2")).toBe(false);
  });

  it("collapses repeated events for one object into a single key", () => {
    const keys = eventedObjectKeys([
      { object_type: "note", object_id: "n1" },
      { object_type: "note", object_id: "n1" },
    ]);
    expect(keys.size).toBe(1);
  });

  it("does not collide ids across object types", () => {
    const keys = eventedObjectKeys([
      { object_type: "note", object_id: "shared-id" },
    ]);
    expect(keys.has("idea:shared-id")).toBe(false);
  });
});
