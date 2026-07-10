/**
 * Note tag colors — design maps known tags to identity colors
 * (marketing purple, strategy green, product blue, project gold) and the
 * rest hash onto the same palette so a tag keeps its color everywhere.
 */

const NAMED: Record<string, string> = {
  marketing: "#5b3fd6",
  strategy: "#3f7a56",
  product: "#4a5b8a",
  project: "#8a6a2a",
};

const PALETTE = ["#5b3fd6", "#3f7a56", "#4a5b8a", "#8a6a2a"];

export function noteTagColor(tag: string): string {
  const named = NAMED[tag.toLowerCase()];
  if (named) return named;
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

/** Strip [[wiki-link]] brackets for plain-text snippets. */
export function noteSnippet(body: string, max = 120): string {
  return body.replaceAll("[[", "").replaceAll("]]", "").trim().slice(0, max);
}
