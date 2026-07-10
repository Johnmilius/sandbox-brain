import { describe, expect, it } from "vitest";
import {
  deriveTicketPrefix,
  findConflicts,
  formatTicketId,
} from "@/lib/tasks";

describe("deriveTicketPrefix", () => {
  it("uses first letters of the first words for multi-word names", () => {
    expect(deriveTicketPrefix("Ramp landing")).toBe("RL");
    expect(deriveTicketPrefix("Sidequest v2")).toBe("SV");
    expect(deriveTicketPrefix("Warehouse sim")).toBe("WS");
  });

  it("caps at the first 3 words", () => {
    expect(deriveTicketPrefix("Big Brown Fox Jumps")).toBe("BBF");
  });

  it("uses first letter + next two consonants for single words", () => {
    expect(deriveTicketPrefix("Ramp")).toBe("RMP");
    expect(deriveTicketPrefix("Warehouse")).toBe("WRH");
  });

  it("clamps single short words to at least 2 chars", () => {
    // "Go" → G + consonants of "o" (none) → too short → padded/fallback logic
    const prefix = deriveTicketPrefix("Go");
    expect(prefix.length).toBeGreaterThanOrEqual(2);
    expect(prefix.length).toBeLessThanOrEqual(3);
    expect(prefix).toMatch(/^[A-Z]+$/);
  });

  it("strips non-alphabetic characters", () => {
    expect(deriveTicketPrefix("v2.0 Launch!")).toMatch(/^[A-Z]{2,3}$/);
  });

  it("falls back to TSK for unusable input", () => {
    expect(deriveTicketPrefix("")).toBe("TSK");
    expect(deriveTicketPrefix("123 456")).toBe("TSK");
    expect(deriveTicketPrefix("!!!")).toBe("TSK");
  });

  it("always returns 2-3 uppercase A-Z chars", () => {
    for (const name of ["a", "ab", "x y z w", "Ramp", "ó ü", "The"]) {
      const prefix = deriveTicketPrefix(name);
      expect(prefix).toMatch(/^[A-Z]{2,3}$/);
    }
  });
});

describe("formatTicketId", () => {
  it("joins prefix and number with a dash", () => {
    expect(formatTicketId("RMP", 14)).toBe("RMP-14");
    expect(formatTicketId("SV", 3)).toBe("SV-3");
  });
});

describe("findConflicts", () => {
  const task = (
    id: string,
    project_id: string,
    area: string,
    status: string,
  ) => ({ id, project_id, area, status });

  it("flags two inprogress tasks in the same project + area", () => {
    const conflicts = findConflicts([
      task("a", "p1", "frontend", "inprogress"),
      task("b", "p1", "frontend", "inprogress"),
    ]);
    expect(conflicts.get("a")).toEqual(["b"]);
    expect(conflicts.get("b")).toEqual(["a"]);
  });

  it("does not flag different areas", () => {
    const conflicts = findConflicts([
      task("a", "p1", "frontend", "inprogress"),
      task("b", "p1", "backend", "inprogress"),
    ]);
    expect(conflicts.size).toBe(0);
  });

  it("does not flag different projects", () => {
    const conflicts = findConflicts([
      task("a", "p1", "frontend", "inprogress"),
      task("b", "p2", "frontend", "inprogress"),
    ]);
    expect(conflicts.size).toBe(0);
  });

  it("does not flag when only one is inprogress", () => {
    const conflicts = findConflicts([
      task("a", "p1", "frontend", "inprogress"),
      task("b", "p1", "frontend", "todo"),
    ]);
    expect(conflicts.size).toBe(0);
  });

  it("flags all three in a three-way overlap", () => {
    const conflicts = findConflicts([
      task("a", "p1", "design", "inprogress"),
      task("b", "p1", "design", "inprogress"),
      task("c", "p1", "design", "inprogress"),
    ]);
    expect(conflicts.get("a")).toEqual(["b", "c"]);
    expect(conflicts.get("b")).toEqual(["a", "c"]);
    expect(conflicts.get("c")).toEqual(["a", "b"]);
  });

  it("returns an empty map for no tasks", () => {
    expect(findConflicts([]).size).toBe(0);
  });
});
