"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, Home as HomeIcon, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { useStepUp } from "@/components/admin/step-up";
import { api, ApiError } from "@/src/lib/api-client";
import { PAGE_TYPES, type PageType } from "@/src/lib/page-presets";

interface PageRow {
  id: string;
  slug: string;
  title: string;
  type: string;
  status: "draft" | "published";
  isHome: boolean;
}

function errMsg(err: unknown): string {
  return err instanceof ApiError ? err.message : "Something went wrong";
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function PagesListPage() {
  const { toast } = useToast();
  const { runWithStepUp } = useStepUp();
  const router = useRouter();
  const [pages, setPages] = useState<PageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [type, setType] = useState<PageType>("standard");

  const load = useCallback(
    () =>
      api
        .get<{ data: PageRow[] }>("/api/v1/admin/pages")
        .then((res) => setPages(res.data))
        .catch((err) => toast(errMsg(err), "error")),
    [toast],
  );

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  // Refetch when the tab/window regains focus so a page created in the editor
  // (or elsewhere) shows up without a manual refresh.
  useEffect(() => {
    const onFocus = () => void load();
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const create = async () => {
    if (!title.trim()) return toast("Title is required", "error");
    setCreating(true);
    try {
      // Mutations return the bare object ({ id }), not a { data } envelope.
      const res = await api.post<{ id: string }>("/api/v1/admin/pages", {
        title: title.trim(),
        slug: slug || slugify(title),
        type,
      });
      toast("Page created", "success");
      await load(); // keep the list fresh for when the user returns
      router.push(`/admin/pages/${res.id}`);
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setCreating(false);
    }
  };

  const togglePublish = (p: PageRow) =>
    runBusy(p.id, async () => {
      await api.patch(`/api/v1/admin/pages/${p.id}`, {
        status: p.status === "published" ? "draft" : "published",
      });
      await load();
    });

  const remove = (p: PageRow) =>
    runBusy(p.id, async () => {
      // Deleting a page is a destructive action → step-up: the re-auth modal
      // appears if the session isn't fresh, then the delete retries.
      await runWithStepUp(() => api.del(`/api/v1/admin/pages/${p.id}`));
      await load();
    });

  const runBusy = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id);
    try {
      await fn();
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Pages</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Build and organize the pages of your site.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New page</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Title">
              <Input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (!slugEdited) setSlug(slugify(e.target.value));
                }}
                placeholder="Weddings"
              />
            </Field>
            <Field label="URL slug">
              <Input
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugEdited(true);
                }}
                placeholder="weddings"
              />
            </Field>
            <Field label="Type">
              <Select value={type} onChange={(e) => setType(e.target.value as PageType)}>
                {PAGE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {PAGE_TYPES.find((t) => t.value === type)?.hint}
          </p>
          <Button onClick={create} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create page
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (
        <div className="space-y-2">
          {pages.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-lg border px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link href={`/admin/pages/${p.id}`} className="font-medium hover:underline">
                    {p.title}
                  </Link>
                  {p.isHome && (
                    <Badge tone="blue">
                      <HomeIcon className="mr-1 h-3 w-3" /> Home
                    </Badge>
                  )}
                  <Badge tone={p.status === "published" ? "green" : "neutral"}>
                    {p.status}
                  </Badge>
                </div>
                <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                  /{p.slug} · {p.type}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => togglePublish(p)} disabled={busyId === p.id}>
                  {busyId === p.id && <Loader2 className="h-4 w-4 animate-spin" />}
                  {p.status === "published" ? "Unpublish" : "Publish"}
                </Button>
                <Link href={`/admin/pages/${p.id}`}>
                  <Button variant="outline" size="sm">
                    <Pencil className="h-4 w-4" /> Edit
                  </Button>
                </Link>
                {!p.isHome && (
                  <Button variant="ghost" size="sm" onClick={() => remove(p)} disabled={busyId === p.id}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
