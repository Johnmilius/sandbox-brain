"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { NAV_ITEMS } from "@/components/shell/sidebar";

type PresenceUser = {
  id: string;
  name: string;
  initials: string;
};

type TopbarProps = {
  currentUser: PresenceUser;
};

function pageTitleFor(pathname: string): string {
  if (pathname === "/") return "Home";
  const match = NAV_ITEMS.find(
    (item) => item.href !== "/" && pathname.startsWith(item.href),
  );
  return match?.label ?? "Sandbox Brain";
}

export function Topbar({ currentUser }: TopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const title = useMemo(() => pageTitleFor(pathname), [pathname]);

  const [present, setPresent] = useState<PresenceUser[]>([currentUser]);
  const channelRef = useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        router.push("/search");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    try {
      const channel = supabase.channel("shell-presence", {
        config: { presence: { key: currentUser.id } },
      });
      channelRef.current = channel;

      channel.on("presence", { event: "sync" }, () => {
        try {
          const state = channel.presenceState<PresenceUser>();
          const others: PresenceUser[] = [];
          for (const key of Object.keys(state)) {
            const entries = state[key];
            const entry = entries?.[0] as unknown as PresenceUser | undefined;
            if (entry) others.push(entry);
          }
          if (cancelled) return;
          // Current user last/frontmost.
          const withoutSelf = others.filter((u) => u.id !== currentUser.id);
          setPresent([...withoutSelf, currentUser]);
        } catch {
          if (!cancelled) setPresent([currentUser]);
        }
      });

      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel
            .track(currentUser)
            .catch(() => {
              // Presence tracking failed (e.g. Realtime disabled) — degrade
              // to showing just the current user, already the default state.
            });
        }
      });
    } catch {
      // Realtime unavailable for this client key — degrade gracefully.
      // State already defaults to [currentUser], so there's nothing to set.
    }

    return () => {
      cancelled = true;
      const channel = channelRef.current;
      if (channel) {
        try {
          channel.untrack();
          supabase.removeChannel(channel);
        } catch {
          // best-effort cleanup
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.id]);

  const visible = present.slice(-4);

  return (
    <header
      className="flex h-[52px] shrink-0 items-center border-b"
      style={{ borderColor: "#f0eeeb", padding: "0 26px" }}
    >
      <h1 className="text-[14px] font-semibold text-[var(--v2-ink-1)]">
        {title}
      </h1>

      <button
        type="button"
        onClick={() => router.push("/search")}
        className="mx-auto flex h-8 flex-1 items-center gap-2 rounded-[9px] px-[11px] text-left"
        style={{ maxWidth: 340, backgroundColor: "#f6f4f1", marginLeft: 24 }}
      >
        <Search className="size-[13px] shrink-0 text-[var(--v2-ink-3)]" />
        <span className="flex-1 truncate text-[12.5px] text-[var(--v2-ink-3)]">
          Search the brain…
        </span>
        <span
          className="shrink-0 rounded border px-[5px] py-[1px] font-mono text-[9.5px] text-[var(--v2-ink-3)]"
          style={{ borderColor: "#e2ddd6" }}
        >
          ⌘K
        </span>
      </button>

      <div className="ml-auto flex items-center gap-2 pl-4">
        <span className="font-mono text-[11px] text-[var(--v2-ink-3)]">
          {present.length} online
        </span>
        <div className="flex items-center">
          {visible.map((u, i) => (
            <span
              key={u.id}
              className="flex size-6 items-center justify-center rounded-full border-2 border-white text-[10px] font-medium"
              style={{
                marginLeft: i === 0 ? 0 : -8,
                zIndex: i,
                backgroundColor: u.id === currentUser.id ? "#e7e5e0" : "#cdd4ea",
                color: u.id === currentUser.id ? "#57534e" : "#4a5b8a",
              }}
              title={u.name}
            >
              {u.initials}
            </span>
          ))}
        </div>
      </div>
    </header>
  );
}
