"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import type { ResolvedMenuItem } from "@/src/db/queries/menus";

// Kept for backwards-compat with any importer; the menu is data-driven now.
export interface NavLink {
  href: string;
  label: string;
}

interface MobileNavProps {
  items: ResolvedMenuItem[];
}

function MobileItem({
  item,
  depth,
  onNavigate,
}: {
  item: ResolvedMenuItem;
  depth: number;
  onNavigate: () => void;
}) {
  const cls = "rounded-md px-2 py-3 text-base text-foreground/80 transition-colors hover:bg-[hsl(var(--muted))] hover:text-foreground";
  const style = { paddingLeft: `${0.5 + depth * 0.75}rem` };
  return (
    <>
      {item.external || item.openInNewTab ? (
        <a
          href={item.href}
          target="_blank"
          rel="noreferrer noopener"
          onClick={onNavigate}
          className={cls}
          style={style}
        >
          {item.label}
        </a>
      ) : (
        <Link href={item.href} onClick={onNavigate} className={cls} style={style}>
          {item.label}
        </Link>
      )}
      {item.children.map((child) => (
        <MobileItem
          key={child.id}
          item={child}
          depth={depth + 1}
          onNavigate={onNavigate}
        />
      ))}
    </>
  );
}

export function MobileNav({ items }: MobileNavProps) {
  const [open, setOpen] = React.useState(false);

  // Close on Escape.
  React.useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        className="inline-flex items-center justify-center rounded-md p-2 transition-colors hover:bg-[hsl(var(--muted))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
      >
        {open ? (
          <X className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Menu className="h-5 w-5" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div
          id="mobile-nav-panel"
          className="absolute inset-x-0 top-full border-b bg-background shadow-sm"
        >
          <nav className="flex flex-col px-4 py-2" aria-label="Mobile">
            {items.map((item) => (
              <MobileItem
                key={item.id}
                item={item}
                depth={0}
                onNavigate={() => setOpen(false)}
              />
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
