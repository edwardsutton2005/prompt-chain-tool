"use client";

import { useState } from "react";
import { Blocks } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LoginPage() {
  const [error, setError] = useState("");

  async function signIn() {
    setError("");
    const supabase = createClient();
    const result = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (result.error) setError(result.error.message);
  }

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="absolute right-5 top-5"><ThemeToggle /></div>
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Blocks className="h-5 w-5" />
        </div>
        <p className="mb-2 text-sm font-medium text-muted-foreground">Morningside Takes</p>
        <h1 className="text-2xl font-semibold tracking-tight">Prompt Chain Tool</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Sign in with the same Google account used by the main application. Access is limited to superadmins.
        </p>
        <Button className="mt-7 w-full" onClick={signIn}>Continue with Google</Button>
        {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
      </Card>
    </main>
  );
}
