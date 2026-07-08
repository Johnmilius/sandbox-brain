"use client";

import { useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search } from "lucide-react";
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
          1 online
        </span>
        <div className="flex items-center">
          <span
            className="flex size-6 items-center justify-center rounded-full border-2 border-white text-[10px] font-medium"
            style={{ backgroundColor: "#e7e5e0", color: "#57534e" }}
            title={currentUser.name}
          >
            {currentUser.initials}
          </span>
        </div>
      </div>
    </header>
  );
}
