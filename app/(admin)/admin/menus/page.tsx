"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  IndentIncrease,
  IndentDecrease,
  Eye,
  EyeOff,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/src/lib/api-client";

type LinkType = "page" | "category" | "location" | "gallery" | "url" | "home";

interface MenuItemRow {
  id: string;
  menuId: string;
  parentId: string | null;
  label: string;
  linkType: LinkType;
  targetId: string | null;
  url: string | null;
  sortOrder: number;
  openInNewTab: boolean;
  isVisible: boolean;
}

interface AdminMenu {
  id: string;
  key: string;
  name: string;
  items: MenuItemRow[];
}

interface TargetOption {
  id: string;
  label: string;
}

function errMsg(err: unknown): string {
  return err instanceof ApiError ? err.message : "Something went wrong";
}

const LINK_TYPES: { value: LinkType; label: string }[] = [
  { value: "home", label: "Home" },
  { value: "url", label: "URL / link" },
  { value: "category", label: "Category" },
  { value: "location", label: "Location" },
  { value: "gallery", label: "Gallery" },
];

interface DraftItem {
  label: string;
  linkType: LinkType;
  targetId: string;
  url: string;
  openInNewTab: boolean;
}

const EMPTY_DRAFT: DraftItem = {
  label: "",
  linkType: "url",
  targetId: "",
  url: "",
  openInNewTab: false,
};

export default function MenusPage() {
  const { toast } = useToast();
  const [menus, setMenus] = useState<AdminMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeKey, setActiveKey] = useState("primary");
  const [busy, setBusy] = useState(false);
  const [targets, setTargets] = useState<Record<string, TargetOption[]>>({
    category: [],
    location: [],
    gallery: [],
    page: [],
  });
  const [draft, setDraft] = useState<DraftItem>(EMPTY_DRAFT);

  const reload = useCallback(async () => {
    const res = await api.get<{ data: AdminMenu[] }>("/api/v1/admin/menus");
    setMenus(res.data);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get<{ data: AdminMenu[] }>("/api/v1/admin/menus"),
      api
        .get<{ data: { id: string; name: string }[] }>("/api/v1/admin/categories")
        .catch(() => ({ data: [] })),
      api
        .get<{ data: { id: string; name: string }[] }>("/api/v1/admin/locations")
        .catch(() => ({ data: [] })),
      api
        .get<{ data: { id: string; title: string }[] }>("/api/v1/admin/galleries")
        .catch(() => ({ data: [] })),
    ])
      .then(([m, cats, locs, gals]) => {
        if (!active) return;
        setMenus(m.data);
        setTargets({
          category: cats.data.map((c) => ({ id: c.id, label: c.name })),
          location: locs.data.map((l) => ({ id: l.id, label: l.name })),
          gallery: gals.data.map((g) => ({ id: g.id, label: g.title })),
          page: [],
        });
      })
      .catch((err) => active && toast(errMsg(err), "error"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [toast]);

  const activeMenu = menus.find((m) => m.key === activeKey) ?? menus[0];

  // Build a depth-annotated, ordered flat list from the menu's items.
  const ordered = useMemo(() => {
    if (!activeMenu) return [] as (MenuItemRow & { depth: number })[];
    const byParent = new Map<string, MenuItemRow[]>();
    for (const it of activeMenu.items) {
      const k = it.parentId ?? "root";
      const arr = byParent.get(k) ?? [];
      arr.push(it);
      byParent.set(k, arr);
    }
    for (const arr of byParent.values()) arr.sort((a, b) => a.sortOrder - b.sortOrder);
    const out: (MenuItemRow & { depth: number })[] = [];
    const walk = (parent: string, depth: number) => {
      for (const it of byParent.get(parent) ?? []) {
        out.push({ ...it, depth });
        walk(it.id, depth + 1);
      }
    };
    walk("root", 0);
    return out;
  }, [activeMenu]);

  const siblingsOf = (item: MenuItemRow) =>
    (activeMenu?.items ?? [])
      .filter((i) => i.parentId === item.parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      await reload();
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setBusy(false);
    }
  };

  const move = (item: MenuItemRow, dir: -1 | 1) =>
    run(async () => {
      const sibs = siblingsOf(item);
      const idx = sibs.findIndex((s) => s.id === item.id);
      const swap = sibs[idx + dir];
      if (!swap) return;
      await Promise.all([
        api.patch(`/api/v1/admin/menus/items/${item.id}`, { sortOrder: swap.sortOrder }),
        api.patch(`/api/v1/admin/menus/items/${swap.id}`, { sortOrder: item.sortOrder }),
      ]);
    });

  const indent = (item: MenuItemRow) =>
    run(async () => {
      const sibs = siblingsOf(item);
      const idx = sibs.findIndex((s) => s.id === item.id);
      const prev = sibs[idx - 1];
      if (!prev) {
        toast("Nothing above to nest under", "info");
        return;
      }
      await api.patch(`/api/v1/admin/menus/items/${item.id}`, { parentId: prev.id });
    });

  const outdent = (item: MenuItemRow) =>
    run(async () => {
      const parent = activeMenu?.items.find((i) => i.id === item.parentId);
      await api.patch(`/api/v1/admin/menus/items/${item.id}`, {
        parentId: parent?.parentId ?? null,
      });
    });

  const toggleVisible = (item: MenuItemRow) =>
    run(async () => {
      await api.patch(`/api/v1/admin/menus/items/${item.id}`, {
        isVisible: !item.isVisible,
      });
    });

  const remove = (item: MenuItemRow) =>
    run(async () => {
      await api.del(`/api/v1/admin/menus/items/${item.id}`);
    });

  const addItem = () =>
    run(async () => {
      if (!activeMenu) return;
      if (!draft.label.trim()) {
        toast("Label is required", "error");
        return;
      }
      const payload: Record<string, unknown> = {
        menuId: activeMenu.id,
        label: draft.label.trim(),
        linkType: draft.linkType,
        openInNewTab: draft.openInNewTab,
      };
      if (draft.linkType === "url") payload.url = draft.url.trim();
      if (["category", "location", "gallery", "page"].includes(draft.linkType))
        payload.targetId = draft.targetId;
      await api.post("/api/v1/admin/menus/items", payload);
      setDraft(EMPTY_DRAFT);
    });

  function linkSummary(item: MenuItemRow): string {
    switch (item.linkType) {
      case "home":
        return "Home (/)";
      case "url":
        return item.url ?? "—";
      default: {
        const opt = targets[item.linkType]?.find((t) => t.id === item.targetId);
        return `${item.linkType}: ${opt?.label ?? item.targetId ?? "—"}`;
      }
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Menus</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Organize the site navigation. Nest items to create dropdowns and
          subpages.
        </p>
      </div>

      <div className="flex gap-2">
        {menus.map((m) => (
          <Button
            key={m.key}
            variant={m.key === activeKey ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveKey(m.key)}
          >
            {m.name}
          </Button>
        ))}
      </div>

      {activeMenu && (
        <Card>
          <CardHeader>
            <CardTitle>{activeMenu.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {ordered.length === 0 && (
              <p className="py-4 text-sm text-[hsl(var(--muted-foreground))]">
                No items yet. Add one below.
              </p>
            )}
            {ordered.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-md border px-2 py-1.5"
                style={{ marginLeft: `${item.depth * 1.25}rem` }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <span className={item.isVisible ? "" : "opacity-50 line-through"}>
                      {item.label}
                    </span>
                    {item.openInNewTab && (
                      <ExternalLink className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
                    )}
                  </div>
                  <div className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                    {linkSummary(item)}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <IconBtn title="Move up" onClick={() => move(item, -1)} disabled={busy}>
                    <ChevronUp className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn title="Move down" onClick={() => move(item, 1)} disabled={busy}>
                    <ChevronDown className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn title="Nest (indent)" onClick={() => indent(item)} disabled={busy}>
                    <IndentIncrease className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn title="Un-nest (outdent)" onClick={() => outdent(item)} disabled={busy}>
                    <IndentDecrease className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn
                    title={item.isVisible ? "Hide" : "Show"}
                    onClick={() => toggleVisible(item)}
                    disabled={busy}
                  >
                    {item.isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </IconBtn>
                  <IconBtn title="Delete" onClick={() => remove(item)} disabled={busy}>
                    <Trash2 className="h-4 w-4 text-[hsl(var(--destructive,0_70%_50%))]" />
                  </IconBtn>
                </div>
              </div>
            ))}

            {/* Add item */}
            <div className="mt-4 space-y-3 rounded-md border border-dashed p-3">
              <p className="text-sm font-medium">Add item</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Label">
                  <Input
                    value={draft.label}
                    onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                    placeholder="About"
                  />
                </Field>
                <Field label="Links to">
                  <Select
                    value={draft.linkType}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        linkType: e.target.value as LinkType,
                        targetId: "",
                        url: "",
                      })
                    }
                  >
                    {LINK_TYPES.map((lt) => (
                      <option key={lt.value} value={lt.value}>
                        {lt.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                {draft.linkType === "url" && (
                  <Field label="URL">
                    <Input
                      value={draft.url}
                      onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                      placeholder="/about or https://example.com"
                    />
                  </Field>
                )}
                {["category", "location", "gallery"].includes(draft.linkType) && (
                  <Field label="Target">
                    <Select
                      value={draft.targetId}
                      onChange={(e) => setDraft({ ...draft, targetId: e.target.value })}
                    >
                      <option value="">Select…</option>
                      {(targets[draft.linkType] ?? []).map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.openInNewTab}
                  onChange={(e) => setDraft({ ...draft, openInNewTab: e.target.checked })}
                />
                Open in new tab
              </label>
              <Button size="sm" onClick={addItem} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add item
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function IconBtn({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className="rounded p-1 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] disabled:opacity-40"
    >
      {children}
    </button>
  );
}
