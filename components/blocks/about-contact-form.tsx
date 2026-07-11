"use client";

import { useEffect, useState } from "react";
import {
  ContactCaptchaWidget,
  useContactCaptcha,
} from "@/components/forms/contact-captcha";

export function AboutContactForm({ submitLabel = "Send" }: { submitLabel?: string }) {
  const [ts, setTs] = useState(0);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const captcha = useContactCaptcha();

  useEffect(() => setTs(Date.now()), []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (captcha.enabled && !captcha.token) {
      setStatus("error");
      return;
    }
    setStatus("sending");
    const form = new FormData(event.currentTarget);
    const body = {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      subject: "About inquiry",
      message: String(form.get("message") ?? ""),
      company: String(form.get("company") ?? ""),
      _ts: ts,
      captchaToken: captcha.token ?? undefined,
    };
    try {
      const res = await fetch("/api/v1/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) captcha.reset();
      setStatus(res.ok ? "sent" : "error");
    } catch {
      captcha.reset();
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="about-modern-form-status">
        <p>Thank you. Your message is on its way.</p>
      </div>
    );
  }

  return (
    <form className="about-modern-form" onSubmit={onSubmit}>
      <input name="name" placeholder="Full name" required />
      <input name="email" type="email" placeholder="E-mail" required />
      <textarea name="message" placeholder="Message.." rows={4} required />
      <div aria-hidden className="absolute left-[-9999px]">
        <label>
          Company
          <input name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {status === "error" && (
        <p className="about-modern-form-error">Something went wrong. Please try again.</p>
      )}
      <ContactCaptchaWidget captcha={captcha} className="flex justify-center" />
      <button type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending..." : submitLabel}
      </button>
    </form>
  );
}
