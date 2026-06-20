"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Label, Textarea } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/dialog";
import { EmptyState, Spinner } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/src/lib/api-client";

interface Category {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isPublished: boolean;
}

interface Location {
  id: string;
  slug: string;
  name: string;
  region: string | null;
  sortOrder: number;
  isPublished: boolean;
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
      const res = await api.post<{ data: T }>(`/api/v1/admin/${path}`, body);
      setItems((prev) => [...prev, res.data]);
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
      const res = await api.patch<{ data: T }>(
        `/api/v1/admin/${path}/${id}`,
        body,
      );
      setItems((prev) => prev.map((c) => (c.id === id ? res.data : c)));
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
    <Card>
      <CardHeader className="flex items-center justify-between gap-2">
        <CardTitle>{title}</CardTitle>
        <Button size="sm" onClick={() => setCreating(true)}>
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
            {items.map((item, i) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                    {item.slug}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Badge tone={item.isPublished ? "green" : "neutral"}>
                    {item.isPublished ? "Published" : "Hidden"}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Move up"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Move down"
                    disabled={i === items.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing(item)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => remove(item.id)}
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
    </Card>
  );
}

export default function TaxonomyPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Taxonomy</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Organize your work into categories and locations.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <TaxonomyCard<Category> title="Categories" kind="category" />
        <TaxonomyCard<Location> title="Locations" kind="location" />
      </div>
    </div>
  );
}
