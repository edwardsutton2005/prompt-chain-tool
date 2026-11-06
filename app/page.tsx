import { Blocks } from "lucide-react";
import { requireSuperadmin } from "@/lib/admin";
import { loadEditorData } from "@/lib/data";
import { PromptChainEditor } from "@/components/prompt-chain-editor";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { supabase, user } = await requireSuperadmin();
  const data = await loadEditorData(supabase);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Blocks className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-none">Prompt Chain Tool</h1>
            <p className="mt-1 text-[11px] text-muted-foreground">Morningside Takes</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground md:block">{user.email}</span>
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </header>
      <PromptChainEditor initialData={data} />
    </div>
  );
}
