"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Images, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/dialog";
import { EmptyState, Spinner } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { MembershipPhotos } from "@/components/admin/membership-photos";
import { api, ApiError } from "@/src/lib/api-client";

interface Category {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isPublished: boolean;
  photoCount?: number;
  coverPhotoId?: string | null;
}

interface Location {
  id: string;
  slug: string;
  name: string;
  region: string | null;
  sortOrder: number;
  isPublished: boolean;
  photoCount?: number;
  coverPhotoId?: string | null;
}

function errMsg(err: unknown): string {
  return err instanceof ApiError ? err.message : "Something went wrong";
}

interface FormState {
  slug: string;
  name: string;
  description: string;
  region: string;
  isPublished: boolean;
}

const EMPTY_FORM: FormState = {
  slug: "",
  name: "",
  description: "",
  region: "",
  isPublished: true,
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function EditorModal({
  kind,
  initial,
  onClose,
  onSubmit,
}: {
  kind: "category" | "location";
  initial: FormState | null;
  onClose: () => void;
  onSubmit: (form: FormState) => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(initial ?? EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const isEdit = initial !== null;
  // Auto-fill the slug from the name for new items, until the slug is edited by
  // hand (or always, when editing an existing item — keep its slug).
  const [slugEdited, setSlugEdited] = useState(isEdit);
  const noun = kind === "category" ? "category" : "location";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${isEdit ? "Edit" : "New"} ${noun}`}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name" htmlFor="tax-name">
          <Input
            id="tax-name"
            value={form.name}
            onChange={(e) => {
              const name = e.target.value;
              setForm((f) => ({
                ...f,
                name,
                slug: slugEdited ? f.slug : slugify(name),
              }));
            }}
            required
          />
        </Field>
        <Field label="Slug" htmlFor="tax-slug">
          <Input
            id="tax-slug"
            value={form.slug}
            onChange={(e) => {
              setForm({ ...form, slug: e.target.value });
              // Treat an emptied slug as "resume auto-fill from the name".
              setSlugEdited(e.target.value.trim() !== "");
            }}
            required
          />
        </Field>
        {kind === "category" ? (
          <Field label="Description" htmlFor="tax-desc">
            <Textarea
              id="tax-desc"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={3}
            />
          </Field>
        ) : (
          <Field label="Region" htmlFor="tax-region">
            <Input
              id="tax-region"
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
            />
          </Field>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isPublished}
            onChange={(e) =>
              setForm({ ...form, isPublished: e.target.checked })
            }
          />
          Published
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Save" : "Create"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function TaxonomyCard<T extends Category | Location>({
  title,
  kind,
}: {
  title: string;
  kind: "category" | "location";
}) {
  const { toast } = useToast();
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [managing, setManaging] = useState<T | null>(null);

  const path = kind === "category" ? "categories" : "locations";

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get<{ data: T[] }>(`/api/v1/admin/${path}`)
      .then((res) => {
        if (active) setItems(res.data);
      })
      .catch((err) => {
        if (active) toast(errMsg(err), "error");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, toast]);

  const persistOrder = async (next: T[]) => {
    const prev = items;
    setItems(next);
    try {
      await api.patch(`/api/v1/admin/${path}/reorder`, {
        items: next.map((c, i) => ({ id: c.id, sortOrder: i })),
      });
    } catch (err) {
      setItems(prev);
      toast(errMsg(err), "error");
    }
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    void persistOrder(next);
  };

  const create = async (form: FormState) => {
    try {
      const body =
        kind === "category"
          ? {
              slug: form.slug,
              name: form.name,
              description: form.description,
              isPublished: form.isPublished,
            }
          : {
              slug: form.slug,
              name: form.name,
              region: form.region,
              isPublished: form.isPublished,
            };
      // The create endpoint returns only { id, slug }, so build the list item
      // from the submitted fields + returned id (don't read a non-existent
      // res.data, which previously appended `undefined` and crashed the list).
      const res = await api.post<{ id: string }>(`/api/v1/admin/${path}`, body);
      const item = { ...body, id: res.id, sortOrder: 0, photoCount: 0 } as unknown as T;
      setItems((prev) => [...prev, item]);
      toast("Created", "success");
    } catch (err) {
      toast(errMsg(err), "error");
      throw err;
    }
  };

  const update = async (id: string, form: FormState) => {
    try {
      const body =
        kind === "category"
          ? {
              slug: form.slug,
              name: form.name,
              description: form.description,
              isPublished: form.isPublished,
            }
          : {
              slug: form.slug,
              name: form.name,
              region: form.region,
              isPublished: form.isPublished,
            };
      // The update endpoint returns only { id }, so merge the submitted fields
      // into the existing item rather than reading a non-existent res.data.
      await api.patch(`/api/v1/admin/${path}/${id}`, body);
      setItems((prev) =>
        prev.map((c) => (c.id === id ? ({ ...c, ...body } as T) : c)),
      );
      toast("Saved", "success");
    } catch (err) {
      toast(errMsg(err), "error");
      throw err;
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this item? This cannot be undone.")) return;
    try {
      await api.del(`/api/v1/admin/${path}/${id}`);
      setItems((prev) => prev.filter((c) => c.id !== id));
      toast("Deleted", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    }
  };

  const toFormState = (item: T): FormState => ({
    slug: item.slug,
    name: item.name,
    description: "description" in item ? (item.description ?? "") : "",
    region: "region" in item ? (item.region ?? "") : "",
    isPublished: item.isPublished,
  });

  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>{title}</CardTitle>
        <Button size="sm" onClick={() => setCreating(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          New {kind === "category" ? "category" : "location"}
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-6 w-6" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="Nothing here yet"
            description={`Create a ${kind} to get started.`}
          />
        ) : (
          <ul className="divide-y">
            {/* Guard against any stray nullish entry so the whole admin page
                can never crash while rendering the list. */}
            {items.filter(Boolean).map((item, i) => (
              <li
                key={item.id}
                className="flex min-w-0 flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="min-w-0 truncate font-medium">{item.name}</p>
                    <Badge
                      tone={item.isPublished ? "green" : "neutral"}
                      className="shrink-0 px-1.5 text-[11px] sm:px-2 sm:text-xs"
                    >
                      {item.isPublished ? "Published" : "Hidden"}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                    {item.slug}
                  </p>
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-0.5 sm:gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Move up"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    className="h-7 w-7 sm:h-9 sm:w-9"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Move down"
                    disabled={i === items.length - 1}
                    onClick={() => move(i, 1)}
                    className="h-7 w-7 sm:h-9 sm:w-9"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={`Manage photos (${item.photoCount ?? 0})`}
                    onClick={() => setManaging(item)}
                    className="h-7 min-w-0 gap-1 px-1.5 text-xs sm:h-8 sm:px-3"
                  >
                    <Images className="h-4 w-4" />
                    {item.photoCount ?? 0}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing(item)}
                    className="h-7 px-2 text-xs sm:h-8 sm:px-3"
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => remove(item.id)}
                    className="h-7 px-2 text-xs sm:h-8 sm:px-3"
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {creating && (
        <EditorModal
          kind={kind}
          initial={null}
          onClose={() => setCreating(false)}
          onSubmit={create}
        />
      )}
      {editing && (
        <EditorModal
          kind={kind}
          initial={toFormState(editing)}
          onClose={() => setEditing(null)}
          onSubmit={(form) => update(editing.id, form)}
        />
      )}
      {managing && (
        <Modal
          open
          onClose={() => setManaging(null)}
          title={`Photos — ${managing.name}`}
          className="w-[min(94vw,64rem)]"
        >
          <MembershipPhotos
            kind={kind}
            id={managing.id}
            coverPhotoId={managing.coverPhotoId ?? null}
            onCountChanged={(count) =>
              setItems((prev) =>
                prev.map((c) =>
                  c.id === managing.id ? ({ ...c, photoCount: count } as T) : c,
                ),
              )
            }
            onCoverChanged={(coverId) =>
              setItems((prev) =>
                prev.map((c) =>
                  c.id === managing.id ? ({ ...c, coverPhotoId: coverId } as T) : c,
                ),
              )
            }
          />
        </Modal>
      )}
    </Card>
  );
}

export default function TaxonomyPage() {
  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Taxonomy</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Organize your work into categories and locations.
        </p>
      </div>
      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <TaxonomyCard<Category> title="Categories" kind="category" />
        <TaxonomyCard<Location> title="Locations" kind="location" />
      </div>
    </div>
  );
}
