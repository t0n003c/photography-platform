"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { signOut } from "@/src/auth/client";
import { Sidebar } from "@/components/admin/sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";

export function Topbar({
  user,
}: {
  user: { name: string; email: string; role: string };
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="flex h-14 items-center justify-between gap-3 border-b px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          {/* Mobile menu trigger (the sidebar is hidden below md). */}
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
            className="-ml-1 rounded-md p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link
            href="/admin"
            className="truncate text-sm font-semibold tracking-tight hover:opacity-80"
          >
            Studio admin
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
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
            className="px-2 sm:px-3"
            onClick={async () => {
              await signOut();
              router.push("/login");
              router.refresh();
            }}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      {/* Mobile nav drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute left-0 top-0 flex h-full w-[min(18rem,85vw)] flex-col border-r bg-[hsl(var(--background))] shadow-lg">
            <div className="flex h-14 items-center justify-between border-b px-4 font-semibold">
              Photography
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
                className="rounded-md p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <Sidebar onNavigate={() => setMenuOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
