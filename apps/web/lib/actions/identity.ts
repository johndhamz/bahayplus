"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  // This device only: signing out a phone shouldn't end the session on the family laptop.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
