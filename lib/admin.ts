import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getSuperadmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.is_superadmin) return null;

  return { supabase, user };
}

export async function requireSuperadmin() {
  const admin = await getSuperadmin();
  if (!admin) redirect("/forbidden");
  return admin;
}

export async function requireApiSuperadmin() {
  const admin = await getSuperadmin();
  if (!admin) {
    return {
      error: Response.json({ error: "Superadmin access required." }, { status: 403 }),
    } as const;
  }
  return { ...admin, error: null } as const;
}
