"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, Spinner } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { useStepUp } from "@/components/admin/step-up";
import { api, ApiError } from "@/src/lib/api-client";

interface ClientRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  notes: string | null;
}

function errMsg(err: unknown): string {
  return err instanceof ApiError ? err.message : "Something went wrong";
}

interface ClientFormValues {
  name: string;
  email: string;
  phone: string;
  notes: string;
}

function ClientModal({
  initial,
  title,
  onClose,
  onSubmit,
}: {
  initial: ClientFormValues;
  title: string;
  onClose: () => void;
  onSubmit: (values: ClientFormValues) => Promise<void>;
}) {
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone);
  const [notes, setNotes] = useState(initial.notes);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({ name, email, phone, notes });
      onClose();
    } catch {
      // onSubmit is responsible for toasting errors.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={title}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name" htmlFor="client-name">
          <Input
            id="client-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Email" htmlFor="client-email">
          <Input
            id="client-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label="Phone" htmlFor="client-phone">
          <Input
            id="client-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
        <Field label="Notes" htmlFor="client-notes">
          <Textarea
            id="client-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function ClientsPage() {
  const { toast } = useToast();
  const { runWithStepUp } = useStepUp();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<ClientRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: ClientRow[] }>("/api/v1/admin/clients");
      setClients(res.data);
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toPayload = (v: ClientFormValues) => ({
    name: v.name.trim(),
    email: v.email.trim(),
    phone: v.phone.trim() === "" ? null : v.phone.trim(),
    notes: v.notes.trim() === "" ? null : v.notes.trim(),
  });

  const create = async (v: ClientFormValues) => {
    try {
      await api.post("/api/v1/admin/clients", toPayload(v));
      toast("Client created", "success");
      await load();
    } catch (err) {
      toast(errMsg(err), "error");
      throw err;
    }
  };

  const update = async (id: string, v: ClientFormValues) => {
    try {
      await api.patch(`/api/v1/admin/clients/${id}`, toPayload(v));
      toast("Client updated", "success");
      await load();
    } catch (err) {
      toast(errMsg(err), "error");
      throw err;
    }
  };

  const remove = async (client: ClientRow) => {
    if (!window.confirm(`Delete ${client.name || client.email}?`)) return;
    setDeletingId(client.id);
    try {
      await runWithStepUp(() =>
        api.del(`/api/v1/admin/clients/${client.id}`),
      );
      setClients((prev) => prev.filter((c) => c.id !== client.id));
      toast("Client deleted", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Clients</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {clients.length} client{clients.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4" />
          New client
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6" />
        </div>
      ) : clients.length === 0 ? (
        <EmptyState
          title="No clients yet"
          description="Add a client to share galleries with them."
          action={
            <Button onClick={() => setShowNew(true)}>
              <Plus className="h-4 w-4" />
              New client
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[42rem] text-sm">
              <thead>
                <tr className="border-b text-left text-[hsl(var(--muted-foreground))]">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                      {c.email}
                    </td>
                    <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                      {c.phone ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditing(c)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => remove(c)}
                          disabled={deletingId === c.id}
                        >
                          {deletingId === c.id && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {showNew && (
        <ClientModal
          title="New client"
          initial={{ name: "", email: "", phone: "", notes: "" }}
          onClose={() => setShowNew(false)}
          onSubmit={create}
        />
      )}

      {editing && (
        <ClientModal
          title="Edit client"
          initial={{
            name: editing.name,
            email: editing.email,
            phone: editing.phone ?? "",
            notes: editing.notes ?? "",
          }}
          onClose={() => setEditing(null)}
          onSubmit={(v) => update(editing.id, v)}
        />
      )}
    </div>
  );
}
