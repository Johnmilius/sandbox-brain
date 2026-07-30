/**
 * Minimal structural view of a Supabase client — just enough for core
 * helpers to run queries. Typed loosely on purpose so both the app's
 * SupabaseClient<Database> and the MCP server's untyped client satisfy it
 * without generic-variance friction.
 */
export type MinimalDbClient = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
};
