"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "__all__";

type PromptFiltersProps = {
  tools: string[];
  tags: string[];
};

export function PromptFilters({ tools, tags }: PromptFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams);
    if (value && value !== ALL) params.set(key, value);
    else params.delete(key);
    router.replace(`/prompts?${params.toString()}`);
  }

  function onSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      setParam("q", event.currentTarget.value.trim() || null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-52 flex-1">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search prompts… (press Enter)"
          defaultValue={searchParams.get("q") ?? ""}
          onKeyDown={onSearchKeyDown}
        />
      </div>
      <Select
        value={searchParams.get("tool") ?? ALL}
        onValueChange={(v) => setParam("tool", v as string)}
      >
        <SelectTrigger aria-label="Filter by AI tool">
          <SelectValue>
            {(value: string | null) => (value === ALL || !value ? "All tools" : value)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All tools</SelectItem>
          {tools.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={searchParams.get("tag") ?? ALL}
        onValueChange={(v) => setParam("tag", v as string)}
      >
        <SelectTrigger aria-label="Filter by tag">
          <SelectValue>
            {(value: string | null) => (value === ALL || !value ? "All tags" : value)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All tags</SelectItem>
          {tags.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
