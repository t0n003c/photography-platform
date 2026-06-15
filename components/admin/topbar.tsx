"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOut } from "@/src/auth/client";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";

export function Topbar({
  user,
}: {
  user: { name: string; email: string; role: string };
}) {
  const router = useRouter();
  return (
    <header className="flex h-14 items-center justify-between border-b px-4">
      <span className="text-sm font-semibold tracking-tight">
        Studio admin
      </span>
      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium leading-tight">{user.name}</p>
          <p className="text-xs capitalize text-[hsl(var(--muted-foreground))]">
            {user.role}
          </p>
        </div>
        <ThemeToggle />
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await signOut();
            router.push("/login");
            router.refresh();
          }}
        >
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
    </header>
  );
}
