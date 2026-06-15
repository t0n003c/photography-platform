"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Select } from "@/components/ui/form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState, Spinner } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/src/lib/api-client";

type ContactStatus = "new" | "read" | "replied" | "archived" | "spam";
type SpamVerdict = "ham" | "spam" | "unknown";

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  spamVerdict: SpamVerdict;
  status: ContactStatus;
  createdAt: string;
}

interface PageMeta {
  nextCursor: string | null;
  hasMore: boolean;
}

const STATUS_OPTIONS: ContactStatus[] = [
  "new",
  "read",
  "replied",
  "archived",
  "spam",
];

function errMsg(err: unknown): string {
  return err instanceof ApiError ? err.message : "Something went wrong";
}

function verdictTone(v: SpamVerdict): "red" | "green" | "neutral" {
  if (v === "spam") return "red";
  if (v === "ham") return "green";
  return "neutral";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function MessageCard({
  message,
  onStatusChange,
}: {
  message: ContactMessage;
  onStatusChange: (id: string, status: ContactStatus) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);

  const handleChange = async (status: ContactStatus) => {
    setSaving(true);
    try {
      await onStatusChange(message.id, status);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{message.name}</p>
          <p className="truncate text-sm text-[hsl(var(--muted-foreground))]">
            {message.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={verdictTone(message.spamVerdict)}>
            {message.spamVerdict}
          </Badge>
          {saving && <Spinner />}
          <Select
            className="h-8 w-32 py-1 text-xs"
            value={message.status}
            disabled={saving}
            onChange={(e) => handleChange(e.target.value as ContactStatus)}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {message.subject && (
          <p className="font-medium">{message.subject}</p>
        )}
        <p className="whitespace-pre-wrap text-sm">{message.message}</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {formatDate(message.createdAt)}
        </p>
      </CardContent>
    </Card>
  );
}

export default function ContactPage() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [status, setStatus] = useState("all");
  const [verdict, setVerdict] = useState("all");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const load = useCallback(
    async (cursor: string | null) => {
      const isInitial = cursor === null;
      if (isInitial) setLoading(true);
      else setLoadingMore(true);
      try {
        let qs = "?limit=50";
        if (status !== "all") qs += `&status=${status}`;
        if (verdict !== "all") qs += `&verdict=${verdict}`;
        if (cursor) qs += `&cursor=${encodeURIComponent(cursor)}`;
        const res = await api.get<{ data: ContactMessage[]; page: PageMeta }>(
          `/api/v1/admin/contact${qs}`,
        );
        setMessages((prev) =>
          isInitial ? res.data : [...prev, ...res.data],
        );
        setNextCursor(res.page.nextCursor);
      } catch (err) {
        toast(errMsg(err), "error");
      } finally {
        if (isInitial) setLoading(false);
        else setLoadingMore(false);
      }
    },
    [status, verdict, toast],
  );

  useEffect(() => {
    void load(null);
  }, [load]);

  const changeStatus = async (id: string, next: ContactStatus) => {
    try {
      await api.patch(`/api/v1/admin/contact/${id}`, { status: next });
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: next } : m)),
      );
      toast("Status updated", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Inbox</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Messages submitted through the contact form.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Field label="Status">
          <Select
            className="w-40"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All</option>
            <option value="new">New</option>
            <option value="read">Read</option>
            <option value="replied">Replied</option>
            <option value="archived">Archived</option>
            <option value="spam">Spam</option>
          </Select>
        </Field>
        <Field label="Verdict">
          <Select
            className="w-40"
            value={verdict}
            onChange={(e) => setVerdict(e.target.value)}
          >
            <option value="all">All</option>
            <option value="ham">Ham</option>
            <option value="spam">Spam</option>
            <option value="unknown">Unknown</option>
          </Select>
        </Field>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6" />
        </div>
      ) : messages.length === 0 ? (
        <EmptyState
          title="No messages"
          description="Nothing matches the current filters."
        />
      ) : (
        <div className="space-y-4">
          {messages.map((m) => (
            <MessageCard
              key={m.id}
              message={m}
              onStatusChange={changeStatus}
            />
          ))}
          {nextCursor && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => load(nextCursor)}
                disabled={loadingMore}
              >
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
