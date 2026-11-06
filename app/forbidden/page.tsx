import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function ForbiddenPage() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <Card className="max-w-md p-8 text-center">
        <ShieldX className="mx-auto h-10 w-10 text-destructive" />
        <h1 className="mt-4 text-xl font-semibold">Superadmin access required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account is signed in, but its profile does not have superadmin permission.
        </p>
        <Link className="mt-6 inline-block text-sm underline underline-offset-4" href="/login">Return to sign in</Link>
      </Card>
    </main>
  );
}
