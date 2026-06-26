"use client";

import { useEffect, useState } from "react";

// Spam-protected contact form (honeypot `company` + min-fill-time `_ts`),
// posting to the public API. The server scores spam; we always show success.
export function ContactForm({
  submitLabel = "Send message",
  className = "",
}: {
  submitLabel?: string;
  className?: string;
}) {
  const [ts, setTs] = useState(0);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  useEffect(() => setTs(Date.now()), []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    const fd = new FormData(e.currentTarget);
    const body = {
      name: String(fd.get("name") ?? ""),
      email: String(fd.get("email") ?? ""),
      subject: String(fd.get("subject") ?? ""),
      message: String(fd.get("message") ?? ""),
      company: String(fd.get("company") ?? ""), // honeypot
      _ts: ts,
    };
    try {
      const res = await fetch("/api/v1/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      setStatus(res.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-lg border p-6">
        <p className="font-medium">Thank you — your message is on its way.</p>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          I&apos;ll get back to you shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className={`space-y-4 ${className}`}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" name="name" required />
        <Field label="Email" name="email" type="email" required />
      </div>
      <Field label="Subject" name="subject" />
      <div>
        <label htmlFor="message" className="mb-1.5 block text-sm font-medium">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={6}
          className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
        />
      </div>
      {/* Honeypot — visually hidden, must stay empty */}
      <div aria-hidden className="absolute left-[-9999px]">
        <label>
          Company
          <input name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {status === "error" && (
        <p className="text-sm text-red-600">
          Something went wrong. Please try again.
        </p>
      )}
      <button
        type="submit"
        disabled={status === "sending"}
        className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
      >
        {status === "sending" ? "Sending…" : submitLabel}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium">
        {label}
        {required && <span className="text-[hsl(var(--muted-foreground))]"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
      />
    </div>
  );
}
