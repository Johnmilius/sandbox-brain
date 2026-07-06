"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Brain, LogOut, Search, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";

type AppHeaderProps = {
  email: string;
  name?: string;
  avatarUrl?: string;
};

const NAV_LINKS = [
  { href: "/projects", label: "Projects" },
  { href: "/time", label: "Time" },
  { href: "/prompts", label: "Prompts" },
  { href: "/agents", label: "Agents" },
  { href: "/notes", label: "Notes" },
  { href: "/brain", label: "Brain" },
  { href: "/graph", label: "Graph" },
];

export function AppHeader({ email, name, avatarUrl }: AppHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = (name ?? email)
    .split(/[\s@.]+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-5">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Brain className="size-4" />
            </span>
            <span className="hidden sm:inline">Sandbox Brain</span>
          </Link>
          <nav className="flex items-center gap-1 overflow-x-auto">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
                  pathname.startsWith(href) && "bg-muted text-foreground",
                )}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/search"
            aria-label="Search everything"
            className={cn(
              "flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground",
              pathname.startsWith("/search") && "bg-muted text-foreground",
            )}
          >
            <Search className="size-4" />
          </Link>
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar className="size-8">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={name ?? email} />}
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <div className="text-sm font-medium">{name ?? "Team member"}</div>
                <div className="text-xs text-muted-foreground">{email}</div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/profile" />}>
              <User className="size-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={signOut}>
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
