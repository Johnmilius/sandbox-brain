/**
 * Pure helpers for the Tasks feature (V2 Task 8). Fully unit-tested.
 */

/**
 * Derive a 2-3 char ticket prefix from a project name.
 *
 * Rule (documented approximation of the design's hand-picked prefixes):
 * 2+ words → first letter of each of the first 3 words ("Ramp landing" → "RL");
 * 1 word → first letter + next 2 consonants ("Warehouse" → "WRH");
 * clamped to 2-3 chars, A-Z only; fallback "TSK". Stored on the project and
 * editable later, so drift from the design seeds is cosmetic.
 */
export function deriveTicketPrefix(name: string): string {
  const words = name
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z]/g, ""))
    .filter(Boolean);

  let prefix = "";
  if (words.length >= 2) {
    prefix = words
      .slice(0, 3)
      .map((w) => w[0])
      .join("");
  } else if (words.length === 1) {
    const word = words[0];
    const consonants = word
      .slice(1)
      .replace(/[aeiouAEIOU]/g, "")
      .slice(0, 2);
    prefix = word[0] + consonants;
    // Pad short results from the rest of the word (e.g. "Go" → "GO").
    if (prefix.length < 2) prefix = word.slice(0, 2);
  }

  prefix = prefix.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
  return prefix.length >= 2 ? prefix : "TSK";
}

/** "RMP" + 14 → "RMP-14". */
export function formatTicketId(prefix: string, num: number): string {
  return `${prefix}-${num}`;
}

type ConflictTask = {
  id: string;
  project_id: string;
  area: string;
  status: string;
};

/**
 * Conflict rule (PLAN Adjudication 6): two tasks in the same project + same
 * area, both `inprogress`, conflict with each other. Computed, never stored.
 * Returns task id → sorted ids of the tasks it conflicts with.
 */
export function findConflicts(
  tasks: ConflictTask[],
): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const t of tasks) {
    if (t.status !== "inprogress") continue;
    const key = `${t.project_id}|${t.area}`;
    const list = groups.get(key) ?? [];
    list.push(t.id);
    groups.set(key, list);
  }

  const conflicts = new Map<string, string[]>();
  for (const ids of groups.values()) {
    if (ids.length < 2) continue;
    const sorted = [...ids].sort();
    for (const id of sorted) {
      conflicts.set(
        id,
        sorted.filter((other) => other !== id),
      );
    }
  }
  return conflicts;
}
