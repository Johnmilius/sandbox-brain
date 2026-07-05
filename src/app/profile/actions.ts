"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateProfile(
  fullName: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You're not signed in." };

  const name = fullName.trim();

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name: name || null })
    .eq("id", user.id);
  if (profileError) return { error: profileError.message };

  // Keep auth metadata in sync — the header and per-page greetings read it.
  const { error: authError } = await supabase.auth.updateUser({
    data: { full_name: name || null },
  });
  if (authError) return { error: authError.message };

  revalidatePath("/", "layout");
  return { error: null };
}
