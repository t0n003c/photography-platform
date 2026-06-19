"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  Images,
  FolderTree,
  FolderOpen,
  Users,
  Tags,
  Palette,
  Menu as MenuIcon,
  Inbox,
  UserCog,
  Settings,
} from "lucide-react";
import { cn } from "@/src/lib/utils";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/upload", label: "Upload", icon: Upload },
  { href: "/admin/library", label: "Library", icon: Images },
  { href: "/admin/folders", label: "Folders", icon: FolderTree },
  { href: "/admin/galleries", label: "Galleries", icon: FolderOpen },
  { href: "/admin/clients", label: "Clients", icon: Users },
  { href: "/admin/taxonomy", label: "Categories & Locations", icon: Tags },
  { href: "/admin/pages", label: "Pages", icon: Palette },
  { href: "/admin/menus", label: "Menus", icon: MenuIcon },
  { href: "/admin/contact", label: "Inbox", icon: Inbox },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/account", label: "Account", icon: UserCog },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 p-3">
      {NAV.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-[hsl(var(--muted))] font-medium"
                : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]",
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
