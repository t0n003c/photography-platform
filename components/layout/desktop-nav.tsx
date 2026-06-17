"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { ResolvedMenuItem } from "@/src/db/queries/menus";

const linkCls =
  "text-sm text-foreground/70 transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]";

function ItemLink({
  item,
  className,
  onClick,
}: {
  item: ResolvedMenuItem;
  className?: string;
  onClick?: () => void;
}) {
  if (item.external || item.openInNewTab) {
    return (
      <a
        href={item.href}
        target={item.openInNewTab || item.external ? "_blank" : undefined}
        rel="noreferrer noopener"
        className={className}
        onClick={onClick}
      >
        {item.label}
      </a>
    );
  }
  return (
    <Link href={item.href} className={className} onClick={onClick}>
      {item.label}
    </Link>
  );
}

function Dropdown({ item }: { item: ResolvedMenuItem }) {
  const [open, setOpen] = React.useState(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        className={`inline-flex items-center gap-1 ${linkCls}`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
      >
        {item.label}
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 min-w-44 rounded-md border bg-background p-1 shadow-md">
          {/* The parent itself is also reachable. */}
          <ItemLink
            item={item}
            className="block rounded px-3 py-2 text-sm text-foreground/80 hover:bg-[hsl(var(--muted))]"
            onClick={() => setOpen(false)}
          />
          {item.children.map((child) => (
            <ItemLink
              key={child.id}
              item={child}
              className="block rounded px-3 py-2 text-sm text-foreground/80 hover:bg-[hsl(var(--muted))]"
              onClick={() => setOpen(false)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function DesktopNav({ items }: { items: ResolvedMenuItem[] }) {
  return (
    <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
      {items.map((item) =>
        item.children.length > 0 ? (
          <Dropdown key={item.id} item={item} />
        ) : (
          <ItemLink key={item.id} item={item} className={linkCls} />
        ),
      )}
    </nav>
  );
}
