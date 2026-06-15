import type { EmailMessage } from "@/src/email/provider";

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function layout(title: string, body: string): string {
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.6;color:#111">
  <div style="max-width:520px;margin:0 auto;padding:24px">
    <h2 style="margin:0 0 12px">${escape(title)}</h2>
    ${body}
  </div></body></html>`;
}

// Admin notification for a new (non-spam) contact submission.
export function contactNotification(opts: {
  to: string;
  name: string;
  email: string;
  subject?: string | null;
  message: string;
}): EmailMessage {
  const body = `
    <p><strong>${escape(opts.name)}</strong> &lt;${escape(opts.email)}&gt; wrote:</p>
    ${opts.subject ? `<p><em>${escape(opts.subject)}</em></p>` : ""}
    <p style="white-space:pre-wrap">${escape(opts.message)}</p>`;
  return {
    to: opts.to,
    subject: `New inquiry${opts.subject ? `: ${opts.subject}` : ""}`,
    html: layout("New contact inquiry", body),
    text: `${opts.name} <${opts.email}>\n\n${opts.message}`,
    replyTo: opts.email,
  };
}

// Client invitation to a private gallery (sent on grant creation).
export function galleryInvite(opts: {
  to: string;
  clientName?: string | null;
  galleryTitle: string;
  shareUrl: string;
}): EmailMessage {
  const greeting = opts.clientName ? `Hi ${escape(opts.clientName)},` : "Hi,";
  const body = `
    <p>${greeting}</p>
    <p>Your gallery <strong>${escape(opts.galleryTitle)}</strong> is ready to view.</p>
    <p><a href="${escape(opts.shareUrl)}" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Open your gallery</a></p>
    <p style="color:#666;font-size:13px">Or paste this link into your browser:<br>${escape(opts.shareUrl)}</p>`;
  return {
    to: opts.to,
    subject: `Your gallery: ${opts.galleryTitle}`,
    html: layout("Your gallery is ready", body),
    text: `${greeting}\n\nYour gallery "${opts.galleryTitle}" is ready: ${opts.shareUrl}`,
  };
}
