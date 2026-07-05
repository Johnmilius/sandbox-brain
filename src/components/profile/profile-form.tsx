"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile } from "@/app/profile/actions";

type ProfileFormProps = {
  initialName: string;
  email: string;
};

export function ProfileForm({ initialName, email }: ProfileFormProps) {
  const [name, setName] = useState(initialName);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const dirty = name.trim() !== initialName.trim();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const { error } = await updateProfile(name);
      if (error) {
        toast.error(error);
      } else {
        toast.success("Profile updated.");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="full_name">Display name</Label>
        <Input
          id="full_name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Jordan Rivera"
        />
        <p className="text-xs text-muted-foreground">
          Shown across the app instead of your email.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} disabled readOnly />
        <p className="text-xs text-muted-foreground">
          Tied to your Google sign-in — can&apos;t be changed here.
        </p>
      </div>
      <div>
        <Button type="submit" disabled={pending || !dirty}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
