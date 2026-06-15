import { ThemeToggle } from "@/components/layout/theme-toggle";

// Phase 1 "hello world" landing. The real hero / portfolio / client-gallery
// surfaces arrive in Phase 3.
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
          Phase 1 · Scaffold
        </span>
        <ThemeToggle />
      </div>

      <h1 className="text-4xl font-semibold tracking-tight">
        Photography Platform
      </h1>

      <p className="text-[hsl(var(--muted-foreground))]">
        Self-hosted portfolio, private client galleries and a light print store.
        The application scaffold is running. Next up:{" "}
        <span className="font-medium text-[hsl(var(--foreground))]">
          Phase 2 — core data &amp; API
        </span>
        .
      </p>

      <div className="rounded-lg border p-4 text-sm">
        <p className="font-medium">Scaffold status</p>
        <ul className="mt-2 space-y-1 text-[hsl(var(--muted-foreground))]">
          <li>• Next.js 15 (App Router) + TypeScript + Tailwind</li>
          <li>• Dark mode (system + manual toggle, persisted)</li>
          <li>
            • Health check:{" "}
            <a className="underline" href="/api/health">
              /api/health
            </a>
          </li>
          <li>• Services: web · worker · postgres · redis · minio</li>
        </ul>
      </div>
    </main>
  );
}
