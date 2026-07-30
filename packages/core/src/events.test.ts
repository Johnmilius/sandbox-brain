import { describe, expect, it, vi } from "vitest";
import { emitEvent } from "./events.js";
import type { MinimalDbClient } from "./db.js";

function fakeDb(result: { error: { message: string } | null }) {
  const insert = vi.fn().mockResolvedValue(result);
  const db: MinimalDbClient = { from: vi.fn(() => ({ insert })) };
  return { db, insert };
}

describe("emitEvent", () => {
  it("inserts a well-formed event row", async () => {
    const { db, insert } = fakeDb({ error: null });
    await emitEvent(db, {
      verb: "created",
      object: { type: "note", id: "n1", label: "My note" },
      target: { type: "project", id: "p1", label: "Acme" },
      projectId: "p1",
      source: "mcp",
      actorId: "u1",
      metadata: { via: "test" },
    });
    expect(db.from).toHaveBeenCalledWith("events");
    expect(insert).toHaveBeenCalledWith({
      verb: "created",
      object_type: "note",
      object_id: "n1",
      object_label: "My note",
      target_type: "project",
      target_id: "p1",
      target_label: "Acme",
      project_id: "p1",
      source: "mcp",
      metadata: { via: "test" },
      actor_id: "u1",
    });
  });

  it("defaults source to app and omits actor_id so the DB default applies", async () => {
    const { db, insert } = fakeDb({ error: null });
    await emitEvent(db, { verb: "updated", object: { type: "task", id: "t1" } });
    const row = insert.mock.calls[0][0];
    expect(row.source).toBe("app");
    expect("actor_id" in row).toBe(false);
    expect(row.target_type).toBeNull();
  });

  it("never throws when the insert fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { db } = fakeDb({ error: { message: "table missing" } });
    await expect(
      emitEvent(db, { verb: "created", object: { type: "note", id: "n1" } }),
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("never throws when the client itself throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const db: MinimalDbClient = {
      from: () => {
        throw new Error("boom");
      },
    };
    await expect(
      emitEvent(db, { verb: "created", object: { type: "note", id: "n1" } }),
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
