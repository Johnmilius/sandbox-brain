import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getActor, supabase } from "../context.js";
import { fail, guarded, ok, syncWikiLinks } from "../helpers.js";

async function findNoteByTitle(
  title: string,
): Promise<{ id: string; title: string; body: string }> {
  const { data, error } = await supabase().from("notes").select("id, title, body");
  if (error) throw new Error(`Couldn't load notes: ${error.message}`);
  const notes = data ?? [];
  const needle = title.trim().toLowerCase();
  const exact = notes.find((n) => n.title.toLowerCase() === needle);
  if (exact) return exact;
  const partial = notes.filter((n) => n.title.toLowerCase().includes(needle));
  if (partial.length === 1) return partial[0];
  if (partial.length > 1) {
    throw new Error(
      `"${title}" matches multiple notes: ${partial.map((n) => n.title).join(", ")}. Be more specific.`,
    );
  }
  throw new Error(
    `No note titled "${title}". ${
      notes.length > 0
        ? `Existing notes: ${notes.map((n) => n.title).join(", ")}.`
        : "There are no notes yet — create one with brain_create_note."
    }`,
  );
}

export function registerNoteTools(server: McpServer): void {
  server.registerTool(
    "brain_create_note",
    {
      title: "Create a note",
      description:
        "Create a markdown note in the team wiki. Titles must be unique. " +
        "Reference other notes with [[Note Title]] — those become edges in the knowledge graph automatically.",
      inputSchema: {
        title: z.string().min(1).max(200).describe("Unique note title"),
        body: z
          .string()
          .default("")
          .describe("Markdown body; may contain [[wiki-links]] to other notes"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    guarded(async ({ title, body }) => {
      const actor = await getActor();
      const { data, error } = await supabase()
        .from("notes")
        .insert({ title: title.trim(), body, author_id: actor.id })
        .select("id")
        .single();
      if (error) {
        if (error.code === "23505") {
          return fail(
            `A note titled "${title.trim()}" already exists. Use brain_append_to_note to add to it.`,
          );
        }
        return fail(error.message);
      }
      await syncWikiLinks(data.id, body);
      return ok(`Created note **${title.trim()}**.`);
    }),
  );

  server.registerTool(
    "brain_append_to_note",
    {
      title: "Append to a note",
      description:
        "Append markdown to the end of an existing note (matched by title, partial OK). " +
        "Great for adding meeting takeaways, ideas, or updates without overwriting anything.",
      inputSchema: {
        title: z.string().min(1).describe("Title of the note to append to"),
        markdown: z.string().min(1).describe("Markdown content to append"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    guarded(async ({ title, markdown }) => {
      const note = await findNoteByTitle(title);
      const newBody =
        note.body.trim() === "" ? markdown : `${note.body.replace(/\s+$/, "")}\n\n${markdown}`;
      const { error } = await supabase()
        .from("notes")
        .update({ body: newBody })
        .eq("id", note.id);
      if (error) return fail(error.message);
      await syncWikiLinks(note.id, newBody);
      return ok(`Appended to **${note.title}**.`);
    }),
  );

  server.registerTool(
    "brain_get_note",
    {
      title: "Read a note",
      description:
        "Fetch a note's full markdown by title (partial match OK). Lists existing titles in the error if nothing matches.",
      inputSchema: {
        title: z.string().min(1).describe("Note title (partial match OK)"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    guarded(async ({ title }) => {
      const note = await findNoteByTitle(title);
      return ok(`# ${note.title}\n\n${note.body || "*Empty note.*"}`);
    }),
  );

  server.registerTool(
    "brain_list_notes",
    {
      title: "List notes",
      description: "List all note titles in the team wiki with last-updated dates.",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    guarded(async () => {
      const { data, error } = await supabase()
        .from("notes")
        .select("title, updated_at")
        .order("updated_at", { ascending: false });
      if (error) return fail(error.message);
      if (!data || data.length === 0) return ok("No notes yet.");
      const lines = data.map(
        (n) => `- ${n.title} (updated ${new Date(n.updated_at).toISOString().slice(0, 10)})`,
      );
      return ok(`# Notes (${data.length})\n\n${lines.join("\n")}`);
    }),
  );
}
