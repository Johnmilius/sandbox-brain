"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "__all__";

type Option = { id: string; label: string };

export function TimePeopleFilter({ people }: { people: Option[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const who = searchParams.get("who") ?? ALL;

  function setWho(value: string) {
    const params = new URLSearchParams(searchParams);
    if (value && value !== ALL) params.set("who", value);
    else params.delete("who");
    router.replace(`/time?${params.toString()}`);
  }

  return (
    <Select value={who} onValueChange={(v) => setWho(v as string)}>
      <SelectTrigger aria-label="Filter entries by person" className="min-w-40">
        <SelectValue>
          {(v: string | null) =>
            v && v !== ALL
              ? (people.find((p) => p.id === v)?.label ?? "Person")
              : "Everyone"
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>Everyone</SelectItem>
        {people.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
