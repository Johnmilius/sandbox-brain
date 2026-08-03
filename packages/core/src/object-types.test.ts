import { describe, expect, it } from "vitest";
import {
  OBJECT_TYPES,
  OBJECT_TYPE_LABELS,
  isObjectType,
  nodeKey,
  parseNodeKey,
  urlFor,
} from "./object-types.js";

describe("object contract", () => {
  it("every type has a label", () => {
    for (const type of OBJECT_TYPES) {
      expect(OBJECT_TYPE_LABELS[type]).toBeTruthy();
    }
  });

  it("isObjectType accepts registered types and rejects others", () => {
    expect(isObjectType("note")).toBe(true);
    expect(isObjectType("task")).toBe(true);
    expect(isObjectType("meeting")).toBe(false);
    expect(isObjectType("")).toBe(false);
  });

  it("urlFor substitutes {id} and returns null for pageless types", () => {
    expect(urlFor({ type: "note", id: "abc" })).toBe("/notes/abc");
    expect(urlFor({ type: "idea", id: "x1" })).toBe("/ideas/x1");
    expect(urlFor({ type: "project", id: "p1" })).toBe("/projects");
    expect(urlFor({ type: "profile", id: "u1" })).toBeNull();
  });

  it("nodeKey and parseNodeKey round-trip", () => {
    const ref = { type: "knowledge_item" as const, id: "123-abc" };
    expect(nodeKey(ref)).toBe("knowledge_item:123-abc");
    expect(parseNodeKey("knowledge_item:123-abc")).toEqual(ref);
  });

  it("parseNodeKey rejects malformed keys", () => {
    expect(parseNodeKey("no-colon")).toBeNull();
    expect(parseNodeKey("meeting:123")).toBeNull();
    expect(parseNodeKey("note:")).toBeNull();
  });
});
