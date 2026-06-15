"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

// Minimal scaffold toggle. Replaced by a shadcn/ui button in Phase 3.
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch: theme is only known on the client.
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const isDark = resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-[hsl(var(--muted))]"
      aria-label="Toggle dark mode"
    >
      {isDark ? "☀ Light" : "☾ Dark"}
    </button>
  );
}
