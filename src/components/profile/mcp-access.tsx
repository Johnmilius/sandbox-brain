"use client";

import { useState } from "react";
import { Check, Copy, Eye, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

/**
 * Reveals the signed-in user's Supabase refresh token so they can wire the
 * MCP server to act as themselves (BRAIN_USER_REFRESH_TOKEN) instead of the
 * shared service-role key. The token stays client-side — it's never rendered
 * on the server or stored anywhere new.
 */
export function McpAccess() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function reveal() {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    setLoading(false);
    if (!session?.refresh_token) {
      toast.error("Couldn't read your session — try signing out and back in.");
      return;
    }
    setToken(session.refresh_token);
  }

  async function copy() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      toast.success("Token copied.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed — select the text and copy manually.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Wire Claude&apos;s MCP server to act as <strong>you</strong> instead of using
        the shared admin key. Add this token to <code>.env.local</code> as{" "}
        <code>BRAIN_USER_REFRESH_TOKEN</code> (see <code>mcp/README.md</code>).
        It&apos;s tied to your account and can only do what you can.
      </p>

      {token ? (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Input
              value={token}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
              className="font-mono text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={copy}
              aria-label="Copy token"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Treat it like a password — anyone with it can act as you. The first
            time the MCP server runs, this browser may ask you to sign in again
            (the session moves to the server); just sign back in.
          </p>
        </div>
      ) : (
        <div>
          <Button type="button" variant="outline" onClick={reveal} disabled={loading}>
            {loading ? (
              <KeyRound className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
            {loading ? "Reading session…" : "Reveal my MCP token"}
          </Button>
        </div>
      )}
    </div>
  );
}
