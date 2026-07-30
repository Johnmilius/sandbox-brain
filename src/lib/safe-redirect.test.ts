import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";

/**
 * The guarantee under test: whatever comes back, concatenating it onto the
 * deployment origin must still resolve to that origin's host.
 */
const ORIGIN = "https://app.example.com";
const hostAfter = (next: string) => new URL(`${ORIGIN}${safeNextPath(next)}`).host;

describe("safeNextPath", () => {
  it("keeps ordinary in-app paths, including query and hash", () => {
    expect(safeNextPath("/")).toBe("/");
    expect(safeNextPath("/notes/abc")).toBe("/notes/abc");
    expect(safeNextPath("/tasks?status=done#top")).toBe("/tasks?status=done#top");
  });

  it("falls back to / when there is no target", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("")).toBe("/");
  });

  it("rejects a target that would append userinfo to the origin", () => {
    expect(safeNextPath("@evil.com")).toBe("/");
    expect(hostAfter("@evil.com")).toBe("app.example.com");
  });

  it("rejects scheme-relative targets", () => {
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(hostAfter("//evil.com")).toBe("app.example.com");
    expect(safeNextPath("/\\evil.com")).toBe("/");
    expect(hostAfter("/\\evil.com")).toBe("app.example.com");
  });

  it("rejects absolute URLs", () => {
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(hostAfter("https://evil.com")).toBe("app.example.com");
    expect(safeNextPath("http://evil.com")).toBe("/");
    expect(safeNextPath("javascript:alert(1)")).toBe("/");
  });

  it("rejects unrooted paths rather than guessing", () => {
    expect(safeNextPath("notes/abc")).toBe("/");
    expect(safeNextPath(" /notes/abc")).toBe("/");
  });
});
