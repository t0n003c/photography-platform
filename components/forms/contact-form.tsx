"use client";

import { useEffect, useId, useState } from "react";

// Spam-protected contact form (honeypot `company` + min-fill-time `_ts`),
// posting to the public API. The server scores spam; we always show success.
export function ContactForm({
  submitLabel = "Send message",
  className = "",
  variant = "default",
  subjectFallback = "",
  toraLayout = "split",
  toraPlaceholders,
  showPhone = false,
}: {
  submitLabel?: string;
  className?: string;
  variant?: "default" | "tora";
  subjectFallback?: string;
  toraLayout?: "split" | "stacked";
  toraPlaceholders?: {
    name?: string;
    email?: string;
    phone?: string;
    message?: string;
  };
  showPhone?: boolean;
}) {
  const formId = useId();
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
      subject: String(fd.get("subject") ?? subjectFallback),
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
    if (variant === "tora") {
      return (
        <div className="tora-contact-form-status">
          <p>Thank you. Your message is on its way.</p>
        </div>
      );
    }

    return (
      <div className="rounded-lg border p-6">
        <p className="font-medium">Thank you — your message is on its way.</p>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          I&apos;ll get back to you shortly.
        </p>
      </div>
    );
  }

  if (variant === "tora") {
    const placeholders = {
      name: toraPlaceholders?.name ?? "Full name",
      email: toraPlaceholders?.email ?? "E-mail",
      phone: toraPlaceholders?.phone ?? "Phone Number",
      message: toraPlaceholders?.message ?? "Message..",
    };

    return (
      <form
        onSubmit={onSubmit}
        className={`tora-contact-form tora-contact-form--${toraLayout} ${className}`}
      >
        <div className="tora-contact-form__row">
          <ToraField
            id={`${formId}-name`}
            label="Name"
            name="name"
            placeholder={placeholders.name}
            required
          />
          <ToraField
            id={`${formId}-email`}
            label="Email"
            name="email"
            type="email"
            placeholder={placeholders.email}
            required
          />
        </div>
        {showPhone && (
          <ToraField
            id={`${formId}-phone`}
            label="Phone Number"
            name="subject"
            type="tel"
            placeholder={placeholders.phone}
          />
        )}
        <div className="tora-contact-form__field tora-contact-form__field--message">
          <label htmlFor={`${formId}-message`} className="sr-only">
            Message
          </label>
          <textarea
            id={`${formId}-message`}
            name="message"
            required
            rows={4}
            placeholder={placeholders.message}
          />
        </div>
        <div aria-hidden className="absolute left-[-9999px]">
          <label>
            Company
            <input name="company" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        {status === "error" && (
          <p className="tora-contact-form-error">
            Something went wrong. Please try again.
          </p>
        )}
        <div className="tora-contact-form__actions">
          <button type="submit" disabled={status === "sending"}>
            {status === "sending" ? "Sending..." : submitLabel}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className={`space-y-4 ${className}`}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${formId}-name`} label="Name" name="name" required />
        <Field
          id={`${formId}-email`}
          label="Email"
          name="email"
          type="email"
          required
        />
      </div>
      <Field id={`${formId}-subject`} label="Subject" name="subject" />
      <div>
        <label
          htmlFor={`${formId}-message`}
          className="mb-1.5 block text-sm font-medium"
        >
          Message
        </label>
        <textarea
          id={`${formId}-message`}
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
  id,
  label,
  name,
  type = "text",
  required,
}: {
  id: string;
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
        {required && <span className="text-[hsl(var(--muted-foreground))]"> *</span>}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
      />
    </div>
  );
}

function ToraField({
  id,
  label,
  name,
  type = "text",
  placeholder,
  required,
}: {
  id: string;
  label: string;
  name: string;
  type?: string;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <div className="tora-contact-form__field">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
      />
    </div>
  );
}
