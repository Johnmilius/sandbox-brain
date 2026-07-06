/**
 * Database types for the Supabase schema.
 *
 * NOTE: hand-written to match supabase/migrations/0001_init.sql so we can
 * build before the Supabase project exists. Once the project is linked,
 * regenerate with `npm run db:types` — that command overwrites this file.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ProjectStatus = "active" | "paused" | "completed" | "archived";
export type TimeEntrySource = "timer" | "manual";
export type KnowledgeKind =
  | "code_snippet"
  | "decision"
  | "document"
  | "contact"
  | "project_archive";
export type EntityType =
  | "project"
  | "prompt"
  | "note"
  | "knowledge_item"
  | "profile"
  | "agent";

export type AgentStatus = "active" | "archived";

export type Database = {
  public: {
    Tables: {
      allowed_emails: {
        Row: { email: string };
        Insert: { email: string };
        Update: { email?: string };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          status: ProjectStatus;
          started_on: string | null;
          ended_on: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          status?: ProjectStatus;
          started_on?: string | null;
          ended_on?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          status?: ProjectStatus;
          started_on?: string | null;
          ended_on?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      time_entries: {
        Row: {
          id: string;
          user_id: string;
          project_id: string;
          started_at: string;
          ended_at: string | null;
          notes: string | null;
          source: TimeEntrySource;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          project_id: string;
          started_at: string;
          ended_at?: string | null;
          notes?: string | null;
          source?: TimeEntrySource;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          project_id?: string;
          started_at?: string;
          ended_at?: string | null;
          notes?: string | null;
          source?: TimeEntrySource;
          created_at?: string;
        };
        Relationships: [];
      };
      prompts: {
        Row: {
          id: string;
          user_id: string;
          project_id: string | null;
          title: string;
          prompt_text: string;
          response_notes: string | null;
          ai_tool: string | null;
          rating: number | null;
          is_favorite: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          project_id?: string | null;
          title: string;
          prompt_text: string;
          response_notes?: string | null;
          ai_tool?: string | null;
          rating?: number | null;
          is_favorite?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          project_id?: string | null;
          title?: string;
          prompt_text?: string;
          response_notes?: string | null;
          ai_tool?: string | null;
          rating?: number | null;
          is_favorite?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notes: {
        Row: {
          id: string;
          author_id: string;
          title: string;
          body: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          author_id?: string;
          title: string;
          body?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          author_id?: string;
          title?: string;
          body?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      knowledge_items: {
        Row: {
          id: string;
          kind: KnowledgeKind;
          title: string;
          description: string | null;
          content: string | null;
          data: Json;
          url: string | null;
          file_path: string | null;
          project_id: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          kind: KnowledgeKind;
          title: string;
          description?: string | null;
          content?: string | null;
          data?: Json;
          url?: string | null;
          file_path?: string | null;
          project_id?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          kind?: KnowledgeKind;
          title?: string;
          description?: string | null;
          content?: string | null;
          data?: Json;
          url?: string | null;
          file_path?: string | null;
          project_id?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      agents: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          system_prompt: string | null;
          model: string | null;
          tools: string[];
          status: AgentStatus;
          project_id: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          system_prompt?: string | null;
          model?: string | null;
          tools?: string[];
          status?: AgentStatus;
          project_id?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          system_prompt?: string | null;
          model?: string | null;
          tools?: string[];
          status?: AgentStatus;
          project_id?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tags: {
        Row: { id: string; name: string; created_at: string };
        Insert: { id?: string; name: string; created_at?: string };
        Update: { id?: string; name?: string; created_at?: string };
        Relationships: [];
      };
      taggables: {
        Row: {
          tag_id: string;
          entity_type: string;
          entity_id: string;
        };
        Insert: {
          tag_id: string;
          entity_type: string;
          entity_id: string;
        };
        Update: {
          tag_id?: string;
          entity_type?: string;
          entity_id?: string;
        };
        Relationships: [];
      };
      links: {
        Row: {
          id: string;
          source_type: EntityType;
          source_id: string;
          target_type: EntityType;
          target_id: string;
          relationship: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          source_type: EntityType;
          source_id: string;
          target_type: EntityType;
          target_id: string;
          relationship?: string;
          created_by?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          source_type?: EntityType;
          source_id?: string;
          target_type?: EntityType;
          target_id?: string;
          relationship?: string;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_team_member: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

// Convenience row aliases used across the app.
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type TimeEntry = Database["public"]["Tables"]["time_entries"]["Row"];
export type Prompt = Database["public"]["Tables"]["prompts"]["Row"];
export type Note = Database["public"]["Tables"]["notes"]["Row"];
export type KnowledgeItem = Database["public"]["Tables"]["knowledge_items"]["Row"];
export type Agent = Database["public"]["Tables"]["agents"]["Row"];
export type Tag = Database["public"]["Tables"]["tags"]["Row"];
export type LinkRow = Database["public"]["Tables"]["links"]["Row"];
