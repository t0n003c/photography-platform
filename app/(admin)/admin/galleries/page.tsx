"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, Spinner } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/src/lib/api-client";

type Visibility = "public" | "private";
type Status = "draft" | "published" | "archived";

interface GalleryRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  visibility: Visibility;
  status: Status;
  downloadEnabled: boolean;
  expiresAt: string | null;
}

function errMsg(err: unknown): string {
  return err instanceof ApiError ? err.message : "Something went wrong";
}

function visibilityTone(v: Visibility): "blue" | "neutral" {
  return v === "public" ? "blue" : "neutral";
}

function statusTone(s: Status): "green" | "amber" | "neutral" {
  if (s === "published") return "green";
  if (s === "draft") return "amber";
  return "neutral";
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function NewGalleryModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { toast } = useToast();
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post<{ id: string; slug: string }>(
        "/api/v1/admin/galleries",
        { slug, title, description, visibility },
      );
      toast("Gallery created", "success");
      onCreated(res.id);
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="New gallery">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Title" htmlFor="new-gallery-title">
          <Input
            id="new-gallery-title"
            value={title}
            onChange={(e) => {
              const nextTitle = e.target.value;
              setTitle(nextTitle);
              if (!slugEdited) setSlug(slugify(nextTitle));
            }}
            required
          />
        </Field>
        <Field label="Slug" htmlFor="new-gallery-slug">
          <Input
            id="new-gallery-slug"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugEdited(e.target.value.trim() !== "");
            }}
            placeholder="autumn-wedding"
            required
          />
        </Field>
        <Field label="Description" htmlFor="new-gallery-desc">
          <Textarea
            id="new-gallery-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </Field>
        <Field label="Visibility" htmlFor="new-gallery-visibility">
          <Select
            id="new-gallery-visibility"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as Visibility)}
          >
            <option value="private">Private</option>
            <option value="public">Public</option>
          </Select>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Create
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function GalleriesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [galleries, setGalleries] = useState<GalleryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get<{ data: GalleryRow[] }>("/api/v1/admin/galleries")
      .then((res) => {
        if (active) setGalleries(res.data);
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
  }, [toast]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Galleries</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {galleries.length} galler{galleries.length === 1 ? "y" : "ies"}
          </p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4" />
          New gallery
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6" />
        </div>
      ) : galleries.length === 0 ? (
        <EmptyState
          title="No galleries yet"
          description="Create a gallery to start sharing photos."
          action={
            <Button onClick={() => setShowNew(true)}>
              <Plus className="h-4 w-4" />
              New gallery
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {galleries.map((g) => (
            <Link key={g.id} href={`/admin/galleries/${g.id}`} className="block">
              <Card className="transition-colors hover:bg-[hsl(var(--muted))]">
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{g.title}</p>
                    <p className="truncate text-sm text-[hsl(var(--muted-foreground))]">
                      {g.slug}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={visibilityTone(g.visibility)}>
                      {g.visibility}
                    </Badge>
                    <Badge tone={statusTone(g.status)}>{g.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {showNew && (
        <NewGalleryModal
          onClose={() => setShowNew(false)}
          onCreated={(id) => router.push(`/admin/galleries/${id}`)}
        />
      )}
    </div>
  );
}
