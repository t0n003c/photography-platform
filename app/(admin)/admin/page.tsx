"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Image as ImageIcon,
  LayoutGrid,
  Library,
  Mail,
  Palette,
  Upload,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/feedback";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import { api } from "@/src/lib/api-client";
import type { PhotoDTO } from "@/src/db/queries/photos";

interface QuickAction {
  href: string;
  label: string;
  description: string;
  icon: typeof Upload;
}

const ACTIONS: QuickAction[] = [
  {
    href: "/admin/upload",
    label: "Upload",
    description: "Add new photos to your library.",
    icon: Upload,
  },
  {
    href: "/admin/library",
    label: "Library",
    description: "Browse and manage all your media.",
    icon: Library,
  },
  {
    href: "/admin/galleries",
    label: "Galleries",
    description: "Curate collections and galleries.",
    icon: LayoutGrid,
  },
  {
    href: "/admin/clients",
    label: "Clients",
    description: "Manage client access and proofs.",
    icon: Users,
  },
  {
    href: "/admin/design",
    label: "Design",
    description: "Control how the public site renders.",
    icon: Palette,
  },
  {
    href: "/admin/contact",
    label: "Inbox",
    description: "Read messages from your contact form.",
    icon: Mail,
  },
];

export default function DashboardPage() {
  const [recent, setRecent] = useState<PhotoDTO[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [newCount, setNewCount] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .get<{ data: PhotoDTO[] }>("/api/v1/admin/photos?limit=8")
      .then((res) => {
        if (active) setRecent(res.data);
      })
      .catch(() => {
        /* resilient: show nothing on error */
      })
      .finally(() => {
        if (active) setLoadingRecent(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    api
      .get<{ data: { id: string }[] }>(
        "/api/v1/admin/contact?status=new&limit=50",
      )
      .then((res) => {
        if (!active) return;
        const n = res.data.length;
        setNewCount(n >= 50 ? "50+" : String(n));
      })
      .catch(() => {
        /* resilient: show nothing on error */
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Welcome back. Here&apos;s a quick way into everything.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          const isInbox = action.href === "/admin/contact";
          return (
            <Link key={action.href} href={action.href} className="block">
              <Card className="h-full transition-colors hover:bg-[hsl(var(--muted))]">
                <CardContent className="flex items-start gap-3">
                  <span className="rounded-lg border p-2">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{action.label}</p>
                      {isInbox && newCount && newCount !== "0" && (
                        <span className="rounded-full bg-[hsl(var(--primary))] px-2 py-0.5 text-xs font-medium text-[hsl(var(--primary-foreground))]">
                          {newCount}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                      {action.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-semibold">Recent uploads</h2>
        {loadingRecent ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-6 w-6" />
          </div>
        ) : recent.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            No recent uploads.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {recent.map((photo) => (
              <div
                key={photo.id}
                className="aspect-square overflow-hidden rounded-lg border bg-[hsl(var(--muted))]"
              >
                {photo.variants.length > 0 ? (
                  <ResponsiveImage
                    photo={photo}
                    sizes="(max-width:768px) 50vw, 140px"
                    className="h-full w-full"
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center"
                    style={{
                      backgroundColor:
                        photo.dominantColor ?? "hsl(var(--muted))",
                    }}
                  >
                    <ImageIcon className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
