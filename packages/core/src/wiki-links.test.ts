import { describe, expect, it } from "vitest";
import { extractWikiLinkTitles, rewriteWikiLinks } from "./wiki-links.js";

describe("wiki-links", () => {
  it("extracts distinct titles, trimming and ignoring labels", () => {
    const body = "See [[Alpha]] and [[ Alpha ]] plus [[Beta|the beta note]].";
    expect(extractWikiLinkTitles(body)).toEqual(["Alpha", "Beta"]);
  });

  it("rewrites resolved links and emphasizes unresolved ones", () => {
    const map = new Map([["alpha", "id-1"]]);
    const out = rewriteWikiLinks("Go to [[Alpha]] or [[Gamma|G]].", map);
    expect(out).toBe("Go to [Alpha](/notes/id-1) or *G*.");
  });
});
