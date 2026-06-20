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
  Pencil,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/src/lib/api-client";

type Role = "primary" | "footer";
type LinkType =
  | "page"
  | "category"
  | "location"
  | "gallery"
  | "url"
  | "home"
  | "none";

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
  role: Role;
  isActive: boolean;
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
  { value: "page", label: "Page" },
  { value: "category", label: "Category" },
  { value: "location", label: "Location" },
  { value: "gallery", label: "Gallery" },
  { value: "none", label: "No link (label only)" },
];

const TARGET_TYPES = ["page", "category", "location", "gallery"];
const ROLE_LABEL: Record<Role, string> = {
  primary: "Primary navigation",
  footer: "Footer menu",
};

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
  const [busy, setBusy] = useState(false);
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItemRow | null>(null);
  // { mode: "new", role } | { mode: "rename", menu } for the name modal.
  const [nameModal, setNameModal] = useState<
    | { mode: "new"; role: Role }
    | { mode: "rename"; menu: AdminMenu }
    | null
  >(null);
  const [targets, setTargets] = useState<Record<string, TargetOption[]>>({
    page: [],
    category: [],
    location: [],
    gallery: [],
  });

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
      api
        .get<{ data: { id: string; title: string }[] }>("/api/v1/admin/pages")
        .catch(() => ({ data: [] })),
    ])
      .then(([m, cats, locs, gals, pgs]) => {
        if (!active) return;
        setMenus(m.data);
        setEditingMenuId(
          (prev) =>
            prev ??
            m.data.find((x) => x.role === "primary" && x.isActive)?.id ??
            m.data[0]?.id ??
            null,
        );
        setTargets({
          page: pgs.data.map((p) => ({ id: p.id, label: p.title })),
          category: cats.data.map((c) => ({ id: c.id, label: c.name })),
          location: locs.data.map((l) => ({ id: l.id, label: l.name })),
          gallery: gals.data.map((g) => ({ id: g.id, label: g.title })),
        });
      })
      .catch((err) => active && toast(errMsg(err), "error"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [toast]);

  const byRole = useMemo(() => {
    const out: Record<Role, AdminMenu[]> = { primary: [], footer: [] };
    for (const m of menus) (out[m.role] ?? out.primary).push(m);
    return out;
  }, [menus]);

  const editingMenu = menus.find((m) => m.id === editingMenuId) ?? null;

  // Depth-annotated, ordered flat list from the edited preset's items.
  const ordered = useMemo(() => {
    if (!editingMenu) return [] as (MenuItemRow & { depth: number })[];
    const byParent = new Map<string, MenuItemRow[]>();
    for (const it of editingMenu.items) {
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
  }, [editingMenu]);

  const siblingsOf = (item: MenuItemRow) =>
    (editingMenu?.items ?? [])
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

  // ── Preset operations ──────────────────────────────────────────────────────
  const createPreset = (role: Role, name: string) =>
    run(async () => {
      const res = await api.post<{ id: string }>("/api/v1/admin/menus", { role, name });
      setEditingMenuId(res.id);
    });
  const renamePreset = (id: string, name: string) =>
    run(() => api.patch(`/api/v1/admin/menus/${id}`, { name }));
  const activatePreset = (id: string) =>
    run(() => api.patch(`/api/v1/admin/menus/${id}`, { isActive: true }));
  const duplicatePreset = (id: string) =>
    run(async () => {
      const res = await api.post<{ id: string }>(`/api/v1/admin/menus/${id}/duplicate`);
      setEditingMenuId(res.id);
    });
  const deletePreset = (m: AdminMenu) =>
    run(async () => {
      await api.del(`/api/v1/admin/menus/${m.id}`);
      if (editingMenuId === m.id) setEditingMenuId(null);
    });

  // ── Item operations ────────────────────────────────────────────────────────
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
      const parent = editingMenu?.items.find((i) => i.id === item.parentId);
      await api.patch(`/api/v1/admin/menus/items/${item.id}`, {
        parentId: parent?.parentId ?? null,
      });
    });

  const toggleVisible = (item: MenuItemRow) =>
    run(() =>
      api.patch(`/api/v1/admin/menus/items/${item.id}`, { isVisible: !item.isVisible }),
    );

  const removeItem = (item: MenuItemRow) =>
    run(() => api.del(`/api/v1/admin/menus/items/${item.id}`));

  // Convert a draft to the link-type-specific payload fields.
  const linkPayload = (d: DraftItem) => ({
    url: d.linkType === "url" ? d.url.trim() : null,
    targetId: TARGET_TYPES.includes(d.linkType) ? d.targetId || null : null,
  });

  const addItem = (d: DraftItem) =>
    run(async () => {
      if (!editingMenu) return;
      await api.post("/api/v1/admin/menus/items", {
        menuId: editingMenu.id,
        label: d.label.trim(),
        linkType: d.linkType,
        openInNewTab: d.openInNewTab,
        ...linkPayload(d),
      });
    });

  const saveItem = (id: string, d: DraftItem) =>
    run(async () => {
      await api.patch(`/api/v1/admin/menus/items/${id}`, {
        label: d.label.trim(),
        linkType: d.linkType,
        openInNewTab: d.openInNewTab,
        ...linkPayload(d),
      });
      setEditingItem(null);
    });

  function linkSummary(item: MenuItemRow): string {
    switch (item.linkType) {
      case "home":
        return "Home (/)";
      case "none":
        return "No link";
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
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Menus</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Save multiple navigation presets per slot and switch which one is live.
          Nest items to create dropdowns and subpages. Footer composition (logo,
          Instagram, text) is set in the Design tab.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
      {(["primary", "footer"] as Role[]).map((role) => (
        <Card key={role}>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>{ROLE_LABEL[role]}</CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setNameModal({ mode: "new", role })}
              disabled={busy}
            >
              <Plus className="h-4 w-4" /> New preset
            </Button>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {byRole[role].map((m) => {
              const isEditing = m.id === editingMenuId;
              return (
                <div
                  key={m.id}
                  className={`flex items-center gap-2 rounded-md border px-2.5 py-2 ${
                    isEditing ? "border-[hsl(var(--ring))] bg-[hsl(var(--muted))]" : ""
                  }`}
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name={`active-${role}`}
                      checked={m.isActive}
                      onChange={() => !m.isActive && activatePreset(m.id)}
                      disabled={busy}
                      title="Make this preset live"
                    />
                    <span className="truncate text-sm font-medium">{m.name}</span>
                    {m.isActive && (
                      <span className="rounded bg-[hsl(var(--primary))] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[hsl(var(--primary-foreground))]">
                        Live
                      </span>
                    )}
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                      {m.items.length} item{m.items.length === 1 ? "" : "s"}
                    </span>
                  </label>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      size="sm"
                      variant={isEditing ? "default" : "outline"}
                      onClick={() => setEditingMenuId(m.id)}
                      disabled={busy}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <IconBtn title="Duplicate" onClick={() => duplicatePreset(m.id)} disabled={busy}>
                      <Copy className="h-4 w-4" />
                    </IconBtn>
                    <IconBtn
                      title="Rename"
                      onClick={() => setNameModal({ mode: "rename", menu: m })}
                      disabled={busy}
                    >
                      <Pencil className="h-4 w-4" />
                    </IconBtn>
                    <IconBtn
                      title={m.isActive ? "Activate another preset first" : "Delete preset"}
                      onClick={() => {
                        if (window.confirm(`Delete preset "${m.name}"? This cannot be undone.`))
                          deletePreset(m);
                      }}
                      disabled={busy || m.isActive || byRole[role].length <= 1}
                    >
                      <Trash2 className="h-4 w-4 text-[hsl(var(--destructive,0_70%_50%))]" />
                    </IconBtn>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
        </div>

        <div className="lg:sticky lg:top-4">
      {/* Item editor for the selected preset */}
      {editingMenu ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Editing items · {ROLE_LABEL[editingMenu.role]} ·{" "}
              <span className="text-[hsl(var(--muted-foreground))]">{editingMenu.name}</span>
            </CardTitle>
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
                  <IconBtn title="Edit" onClick={() => setEditingItem(item)} disabled={busy}>
                    <Pencil className="h-4 w-4" />
                  </IconBtn>
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
                  <IconBtn title="Delete" onClick={() => removeItem(item)} disabled={busy}>
                    <Trash2 className="h-4 w-4 text-[hsl(var(--destructive,0_70%_50%))]" />
                  </IconBtn>
                </div>
              </div>
            ))}

            <div className="mt-4 rounded-md border border-dashed p-3">
              <p className="mb-3 text-sm font-medium">Add item</p>
              <ItemForm
                key={editingMenu.id}
                initial={EMPTY_DRAFT}
                targets={targets}
                busy={busy}
                submitLabel="Add item"
                resetOnSubmit
                onSubmit={addItem}
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
            Select a preset&rsquo;s <span className="font-medium">Edit</span> button
            to manage its items here.
          </CardContent>
        </Card>
      )}
        </div>
      </div>

      {/* Edit item modal */}
      {editingItem && (
        <Modal open onClose={() => setEditingItem(null)} title="Edit item">
          <ItemForm
            initial={{
              label: editingItem.label,
              linkType: editingItem.linkType,
              targetId: editingItem.targetId ?? "",
              url: editingItem.url ?? "",
              openInNewTab: editingItem.openInNewTab,
            }}
            targets={targets}
            busy={busy}
            submitLabel="Save"
            onSubmit={(d) => saveItem(editingItem.id, d)}
          />
        </Modal>
      )}

      {/* Name modal (new preset / rename) */}
      {nameModal && (
        <NameModal
          title={nameModal.mode === "new" ? `New ${ROLE_LABEL[nameModal.role]} preset` : "Rename preset"}
          initial={nameModal.mode === "rename" ? nameModal.menu.name : ""}
          busy={busy}
          onClose={() => setNameModal(null)}
          onSubmit={async (name) => {
            if (nameModal.mode === "new") await createPreset(nameModal.role, name);
            else await renamePreset(nameModal.menu.id, name);
            setNameModal(null);
          }}
        />
      )}
    </div>
  );
}

// Shared add/edit form for a menu item.
function ItemForm({
  initial,
  targets,
  busy,
  submitLabel,
  resetOnSubmit,
  onSubmit,
}: {
  initial: DraftItem;
  targets: Record<string, TargetOption[]>;
  busy: boolean;
  submitLabel: string;
  resetOnSubmit?: boolean;
  onSubmit: (d: DraftItem) => void;
}) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<DraftItem>(initial);

  const submit = () => {
    if (!draft.label.trim()) {
      toast("Label is required", "error");
      return;
    }
    onSubmit(draft);
    if (resetOnSubmit) setDraft(EMPTY_DRAFT);
  };

  return (
    <div className="space-y-3">
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
              setDraft({ ...draft, linkType: e.target.value as LinkType, targetId: "", url: "" })
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
        {TARGET_TYPES.includes(draft.linkType) && (
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
          disabled={draft.linkType === "none"}
        />
        Open in new tab
      </label>
      <Button size="sm" onClick={submit} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        {submitLabel}
      </Button>
    </div>
  );
}

function NameModal({
  title,
  initial,
  busy,
  onClose,
  onSubmit,
}: {
  title: string;
  initial: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(initial);
  return (
    <Modal open onClose={onClose} title={title}>
      <div className="space-y-4">
        <Field label="Preset name">
          <Input
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Holiday nav"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              if (!name.trim()) {
                toast("Name is required", "error");
                return;
              }
              onSubmit(name.trim());
            }}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        </div>
      </div>
    </Modal>
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
