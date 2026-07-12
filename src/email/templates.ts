import type { EmailMessage } from "@/src/email/provider";
import type { StoreOrderConfirmation } from "@/src/lib/store-order-confirmation";
import type {
  AdminOrderDTO,
  AdminInvoiceDTO,
  AdminOrderRefundDTO,
} from "@/src/db/queries/orders";
import {
  DEFAULT_CONTACT_EMAIL_BODY_TEMPLATE,
  DEFAULT_CONTACT_EMAIL_SUBJECT_TEMPLATE,
} from "@/src/lib/notification-settings";

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escape(s).replace(/"/g, "&quot;");
}

function layout(title: string, body: string): string {
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.6;color:#111">
  <div style="max-width:520px;margin:0 auto;padding:24px">
    <h2 style="margin:0 0 12px">${escape(title)}</h2>
    ${body}
  </div></body></html>`;
}

function galleryInviteLayout(preheader: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f6f2ec;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;color:#111">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escape(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f6f2ec">
    <tr>
      <td align="center" style="padding:32px 16px">
        <div style="max-width:640px;margin:0 auto">
          ${body}
          <p style="margin:18px 0 0;text-align:center;color:#8a8178;font-size:12px">This message was sent because a gallery was shared with you.</p>
        </div>
      </td>
    </tr>
  </table>
  </body></html>`;
}

function formatDateTime(value: Date | string | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("en-US");
}

function formatDate(value: Date | string | undefined | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("en-US", { dateStyle: "long" });
}

function renderTemplate(template: string, tokens: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    return tokens[key] ?? "";
  });
}

function cleanSubject(value: string): string {
  return (
    value
      .replace(/[\r\n]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 240) || "New contact inquiry"
  );
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(cents / 100);
}

function optionText(
  option: StoreOrderConfirmation["lines"][number]["selectedOptions"][number],
  currency: string,
) {
  const delta =
    option.priceDeltaCents === 0
      ? ""
      : ` (${option.priceDeltaCents > 0 ? "+" : "-"}${formatMoney(
          Math.abs(option.priceDeltaCents),
          currency,
        )})`;
  return `${option.optionName}: ${option.valueLabel}${delta}`;
}

function orderLinesHtml(order: StoreOrderConfirmation) {
  return order.lines
    .map((line) => {
      const options = line.selectedOptions
        .map((option) => `<li>${escape(optionText(option, order.currency))}</li>`)
        .join("");
      return `<tr>
        <td style="padding:12px 0;border-bottom:1px solid #e6e6e6">
          <strong>${escape(line.productName)}</strong>
          <div style="color:#666;font-size:13px">${escape(line.sku)}</div>
          ${
            options
              ? `<ul style="color:#666;font-size:13px;margin:8px 0 0;padding-left:18px">${options}</ul>`
              : ""
          }
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #e6e6e6;text-align:center">${line.quantity}</td>
        <td style="padding:12px 0;border-bottom:1px solid #e6e6e6;text-align:right">${escape(
          formatMoney(line.lineTotalCents, order.currency),
        )}</td>
      </tr>`;
    })
    .join("");
}

function orderLinesText(order: StoreOrderConfirmation) {
  return order.lines
    .flatMap((line) => {
      const head = `- ${line.quantity} x ${line.productName} (${line.sku}) = ${formatMoney(
        line.lineTotalCents,
        order.currency,
      )}`;
      return [
        head,
        ...line.selectedOptions.map(
          (option) => `  ${optionText(option, order.currency)}`,
        ),
      ];
    })
    .join("\n");
}

function shippingText(order: StoreOrderConfirmation) {
  if (order.shippingCents > 0) return formatMoney(order.shippingCents, order.currency);
  if (order.shippingProfileLabel) {
    return order.shippingProfileLabel.toLowerCase().includes("quote")
      ? "Quoted after review"
      : "Free";
  }
  if (order.checkoutSettings.shippingMode === "free") return "Free";
  if (order.checkoutSettings.shippingMode === "manual") return "Quoted after review";
  return formatMoney(0, order.currency);
}

function totalsHtml(order: StoreOrderConfirmation) {
  return `<table style="width:100%;border-collapse:collapse;margin:10px 0 0">
    <tbody>
      <tr><td style="padding:4px 0;color:#666">Subtotal</td><td style="padding:4px 0;text-align:right">${escape(
        formatMoney(order.subtotalCents, order.currency),
      )}</td></tr>
      ${
        order.discountCents > 0
          ? `<tr><td style="padding:4px 0;color:#666">Discount${
              order.promoCode ? ` · ${escape(order.promoCode)}` : ""
            }</td><td style="padding:4px 0;text-align:right">-${escape(
              formatMoney(order.discountCents, order.currency),
            )}</td></tr>`
          : ""
      }
      <tr><td style="padding:4px 0;color:#666">Tax</td><td style="padding:4px 0;text-align:right">${escape(
        formatMoney(order.taxCents, order.currency),
      )}</td></tr>
      <tr><td style="padding:4px 0;color:#666">Shipping${
        order.shippingProfileLabel ? ` · ${escape(order.shippingProfileLabel)}` : ""
      }</td><td style="padding:4px 0;text-align:right">${escape(
        shippingText(order),
      )}</td></tr>
      <tr><td style="padding:10px 0 0;font-size:18px"><strong>Total</strong></td><td style="padding:10px 0 0;text-align:right;font-size:18px"><strong>${escape(
        formatMoney(order.totalCents, order.currency),
      )}</strong></td></tr>
    </tbody>
  </table>`;
}

function totalsText(order: StoreOrderConfirmation) {
  return [
    `Subtotal: ${formatMoney(order.subtotalCents, order.currency)}`,
    ...(order.discountCents > 0
      ? [
          `Discount${order.promoCode ? ` (${order.promoCode})` : ""}: -${formatMoney(
            order.discountCents,
            order.currency,
          )}`,
        ]
      : []),
    `Tax: ${formatMoney(order.taxCents, order.currency)}`,
    `Shipping${order.shippingProfileLabel ? ` (${order.shippingProfileLabel})` : ""}: ${shippingText(order)}`,
    `Total: ${formatMoney(order.totalCents, order.currency)}`,
  ].join("\n");
}

// Admin notification for a new (non-spam) contact submission.
export function contactNotification(opts: {
  to: string;
  name: string;
  email: string;
  phone?: string | null;
  subject?: string | null;
  message: string;
  submittedAt?: Date | string;
  adminUrl?: string;
  subjectTemplate?: string;
  bodyTemplate?: string;
}): EmailMessage {
  const subject = opts.subject?.trim() ?? "";
  const phone = opts.phone?.trim() ?? "";
  const inboxUrl = opts.adminUrl ?? "";
  const tokens = {
    name: opts.name,
    email: opts.email,
    phone,
    phoneLine: phone ? `Phone: ${phone}\n` : "",
    subject,
    subjectLine: subject ? `Subject: ${subject}\n` : "",
    subjectSuffix: subject ? `: ${subject}` : "",
    message: opts.message,
    submittedAt: formatDateTime(opts.submittedAt),
    inboxUrl,
  };
  const subjectTemplate =
    opts.subjectTemplate || DEFAULT_CONTACT_EMAIL_SUBJECT_TEMPLATE;
  const bodyTemplate = opts.bodyTemplate || DEFAULT_CONTACT_EMAIL_BODY_TEMPLATE;
  const renderedSubject = cleanSubject(renderTemplate(subjectTemplate, tokens));
  const renderedBody = renderTemplate(bodyTemplate, tokens).trim();
  const body = `<p style="white-space:pre-wrap">${escape(renderedBody)}</p>`;
  return {
    to: opts.to,
    subject: renderedSubject,
    html: layout("New contact inquiry", body),
    text: renderedBody,
    replyTo: opts.email,
  };
}

// Client invitation to a private gallery (sent on grant creation).
export function galleryInvite(opts: {
  to: string;
  clientName?: string | null;
  galleryTitle: string;
  shareUrl: string;
  siteTitle?: string | null;
  logoUrl?: string | null;
  previewImageUrl?: string | null;
  previewAlt?: string | null;
  isPasswordProtected?: boolean;
  message?: string | null;
  password?: string | null;
  shootDate?: Date | string | null;
  expiresAt?: Date | string | null;
  permissions?: {
    favorite?: boolean;
    download?: boolean;
  };
}): EmailMessage {
  const greeting = opts.clientName ? `Hi ${escape(opts.clientName)},` : "Hi,";
  const shootDate = formatDate(opts.shootDate);
  const expiresAt = formatDateTime(opts.expiresAt ?? undefined);
  const permissions = [
    "view",
    opts.permissions?.favorite ? "favorite photos" : null,
    opts.permissions?.download ? "download originals" : null,
  ].filter(Boolean);
  const siteTitle = opts.siteTitle?.trim() || "Photography Platform";
  const logo = opts.logoUrl
    ? `<img src="${escapeAttr(opts.logoUrl)}" alt="${escapeAttr(siteTitle)}" style="display:block;max-height:44px;max-width:220px;width:auto;height:auto;border:0">`
    : `<div style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#111">${escape(siteTitle)}</div>`;
  const previewAlt = opts.previewAlt?.trim() || `${opts.galleryTitle} gallery preview`;
  const previewImage = opts.previewImageUrl
    ? `<img src="${escapeAttr(opts.previewImageUrl)}" alt="${escapeAttr(previewAlt)}" style="display:block;width:100%;height:auto;border:0">`
    : `<div style="background:#f4f1ec;padding:46px 24px;text-align:center">
        <div style="display:inline-block;border:1px solid #d8d2c8;border-radius:999px;padding:6px 12px;color:#6f675d;font-size:12px;letter-spacing:.08em;text-transform:uppercase">${opts.isPasswordProtected ? "Private gallery" : "Gallery preview"}</div>
        <div style="margin-top:18px;font-size:28px;line-height:1.15;font-family:Georgia,serif;color:#171717">${escape(opts.galleryTitle)}</div>
      </div>`;
  const previewCard = `<a href="${escapeAttr(opts.shareUrl)}" style="display:block;text-decoration:none;color:#111">
    <div style="overflow:hidden;border:1px solid #e6e0d8;border-radius:18px;background:#fff">
      ${previewImage}
      <div style="padding:18px 20px">
        <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#8a8178">${opts.isPasswordProtected ? "Password protected" : "Client gallery"}</div>
        <div style="margin-top:5px;font-size:22px;line-height:1.2;font-family:Georgia,serif;color:#111">${escape(opts.galleryTitle)}</div>
        <div style="margin-top:10px;color:#6b625a;font-size:14px">Open the gallery page to view the full collection.</div>
      </div>
    </div>
  </a>`;
  const detailRows = [
    shootDate ? `<li><strong>Shoot date:</strong> ${escape(shootDate)}</li>` : "",
    expiresAt ? `<li><strong>Access expires:</strong> ${escape(expiresAt)}</li>` : "",
    permissions.length
      ? `<li><strong>Access:</strong> ${escape(permissions.join(", "))}</li>`
      : "",
    opts.password ? `<li><strong>Password:</strong> ${escape(opts.password)}</li>` : "",
  ]
    .filter(Boolean)
    .join("");
  const message = opts.message?.trim()
    ? `<p style="white-space:pre-wrap">${escape(opts.message.trim())}</p>`
    : "";
  const body = `
    <div style="padding-bottom:20px">${logo}</div>
    ${previewCard}
    <p>${greeting}</p>
    <p>Your gallery <strong>${escape(opts.galleryTitle)}</strong> is ready to view.</p>
    ${message}
    ${detailRows ? `<ul style="padding-left:20px">${detailRows}</ul>` : ""}
    <p><a href="${escapeAttr(opts.shareUrl)}" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Open your gallery</a></p>
    <p style="color:#666;font-size:13px">Or paste this link into your browser:<br>${escape(opts.shareUrl)}</p>`;
  const textParts = [
    greeting,
    "",
    `${siteTitle} sent you a gallery.`,
    `Your gallery "${opts.galleryTitle}" is ready to view.`,
    opts.message?.trim() ? "" : "",
    opts.message?.trim() ? opts.message.trim() : "",
    shootDate ? `Shoot date: ${shootDate}` : "",
    expiresAt ? `Access expires: ${expiresAt}` : "",
    permissions.length ? `Access: ${permissions.join(", ")}` : "",
    opts.password ? `Password: ${opts.password}` : "",
    "",
    `Open your gallery: ${opts.shareUrl}`,
  ].filter((part) => part !== "");
  return {
    to: opts.to,
    subject: `Your gallery: ${opts.galleryTitle}`,
    html: galleryInviteLayout(`Your gallery "${opts.galleryTitle}" is ready.`, body),
    text: textParts.join("\n"),
  };
}

export function manualOrderCustomerConfirmation(opts: {
  to: string;
  order: StoreOrderConfirmation;
  siteName: string;
}): EmailMessage {
  const name = opts.order.customerName?.trim();
  const greeting = name ? `Hi ${escape(name)},` : "Hi,";
  const body = `
    <p>${greeting}</p>
    <p>${escape(opts.order.checkoutSettings.confirmationMessage)}</p>
    <p style="color:#666;font-size:13px">Order ${escape(opts.order.orderId)}</p>
    <table style="width:100%;border-collapse:collapse;margin:18px 0">
      <thead>
        <tr style="color:#666;font-size:12px;text-transform:uppercase;letter-spacing:.08em">
          <th align="left" style="padding-bottom:8px">Item</th>
          <th align="center" style="padding-bottom:8px">Qty</th>
          <th align="right" style="padding-bottom:8px">Total</th>
        </tr>
      </thead>
      <tbody>${orderLinesHtml(opts.order)}</tbody>
    </table>
    ${totalsHtml(opts.order)}`;
  const statusLink = opts.order.statusUrl
    ? `<p><a href="${escape(opts.order.statusUrl)}" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Track order status</a></p>
    <p style="color:#666;font-size:13px">Or paste this link into your browser:<br>${escape(opts.order.statusUrl)}</p>`
    : "";
  return {
    to: opts.to,
    subject: `Order request received: ${opts.order.orderId}`,
    html: layout("Order request received", `${body}${statusLink}`),
    text: `${name ? `Hi ${name},` : "Hi,"}

${opts.order.checkoutSettings.confirmationMessage}

Order ${opts.order.orderId}

${orderLinesText(opts.order)}

${totalsText(opts.order)}
${opts.order.statusUrl ? `\nTrack order status: ${opts.order.statusUrl}\n` : ""}

${opts.siteName}`,
  };
}

export function manualOrderAdminNotification(opts: {
  to: string;
  order: StoreOrderConfirmation;
  adminUrl: string;
}): EmailMessage {
  const customer = opts.order.customerName
    ? `${opts.order.customerName} <${opts.order.customerEmail}>`
    : opts.order.customerEmail;
  const body = `
    <p><strong>${escape(customer)}</strong> submitted a manual invoice request.</p>
    <p style="color:#666;font-size:13px">Order ${escape(opts.order.orderId)}</p>
    <table style="width:100%;border-collapse:collapse;margin:18px 0">
      <thead>
        <tr style="color:#666;font-size:12px;text-transform:uppercase;letter-spacing:.08em">
          <th align="left" style="padding-bottom:8px">Item</th>
          <th align="center" style="padding-bottom:8px">Qty</th>
          <th align="right" style="padding-bottom:8px">Total</th>
        </tr>
      </thead>
      <tbody>${orderLinesHtml(opts.order)}</tbody>
    </table>
    ${totalsHtml(opts.order)}
    <p><a href="${escape(opts.adminUrl)}" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Review in Store admin</a></p>`;
  return {
    to: opts.to,
    subject: `New store order request: ${opts.order.orderId}`,
    html: layout("New store order request", body),
    text: `${customer} submitted a manual invoice request.

Order ${opts.order.orderId}

${orderLinesText(opts.order)}

${totalsText(opts.order)}

Review: ${opts.adminUrl}`,
    replyTo: opts.order.customerEmail,
  };
}

function adminOrderToConfirmation(
  order: AdminOrderDTO,
  receiptUrl: string,
): StoreOrderConfirmation {
  return {
    orderId: order.id,
    status: "pending",
    customerName: order.clientName,
    customerEmail: order.email ?? "",
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents,
    promoCode: order.promoCode,
    taxCents: order.taxCents,
    shippingCents: order.shippingCents,
    shippingProfileLabel: order.shippingProfileLabel,
    totalCents: order.totalCents,
    currency: order.currency,
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    createdAt: order.createdAt,
    receiptUrl,
    checkoutSettings: order.storeSettingsSnapshot,
    lines: order.items.map((item) => ({
      productId: item.productId ?? "",
      productSlug: "",
      productName: item.description?.split(" — ")[0] || "Product",
      sku: item.description ?? "Order item",
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      lineTotalCents: item.lineTotalCents,
      selectedOptions: item.options,
    })),
  };
}

function emailDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

export function storeInvoiceIssued(opts: {
  to: string;
  order: AdminOrderDTO;
  invoice: AdminInvoiceDTO;
  invoiceUrl: string;
  statusUrl?: string | null;
  siteName: string;
}): EmailMessage {
  const customerName = opts.order.clientName?.trim();
  const greeting = customerName ? `Hi ${escape(customerName)},` : "Hi,";
  const invoiceOrder = adminOrderToConfirmation(opts.order, opts.invoiceUrl);
  invoiceOrder.customerEmail = opts.order.email ?? opts.to;
  const dueDate = opts.invoice.dueAt ? emailDate(opts.invoice.dueAt) : null;
  const body = `
    <p>${greeting}</p>
    <p>Your invoice <strong>${escape(opts.invoice.number)}</strong> is ready.</p>
    ${dueDate ? `<p style="color:#666;font-size:13px">Due ${escape(dueDate)}</p>` : ""}
    <table style="width:100%;border-collapse:collapse;margin:18px 0">
      <thead>
        <tr style="color:#666;font-size:12px;text-transform:uppercase;letter-spacing:.08em">
          <th align="left" style="padding-bottom:8px">Item</th>
          <th align="center" style="padding-bottom:8px">Qty</th>
          <th align="right" style="padding-bottom:8px">Total</th>
        </tr>
      </thead>
      <tbody>${orderLinesHtml(invoiceOrder)}</tbody>
    </table>
    ${totalsHtml(invoiceOrder)}
    ${
      opts.invoice.paymentInstructions
        ? `<p style="white-space:pre-wrap">${escape(opts.invoice.paymentInstructions)}</p>`
        : ""
    }
    <p><a href="${escape(opts.invoiceUrl)}" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">View invoice</a></p>
    ${
      opts.statusUrl
        ? `<p><a href="${escape(opts.statusUrl)}" style="display:inline-block;background:#fff;color:#111;border:1px solid #111;padding:9px 16px;border-radius:999px;text-decoration:none">Track order status</a></p>`
        : ""
    }
    <p style="color:#666;font-size:13px">Or paste this link into your browser:<br>${escape(opts.invoiceUrl)}</p>`;
  return {
    to: opts.to,
    subject: `Invoice ${opts.invoice.number} from ${opts.siteName}`,
    html: layout("Your invoice is ready", body),
    text: `${customerName ? `Hi ${customerName},` : "Hi,"}

Your invoice ${opts.invoice.number} is ready.
${dueDate ? `Due: ${dueDate}\n` : ""}
${orderLinesText(invoiceOrder)}

${totalsText(invoiceOrder)}
${opts.invoice.paymentInstructions ? `\n${opts.invoice.paymentInstructions}\n` : ""}
View invoice: ${opts.invoiceUrl}
${opts.statusUrl ? `Track order status: ${opts.statusUrl}` : ""}`,
  };
}

export function storeReceiptIssued(opts: {
  to: string;
  order: AdminOrderDTO;
  invoice: AdminInvoiceDTO;
  receiptUrl: string;
  statusUrl?: string | null;
  siteName: string;
}): EmailMessage {
  const customerName = opts.order.clientName?.trim();
  const greeting = customerName ? `Hi ${escape(customerName)},` : "Hi,";
  const receiptOrder = adminOrderToConfirmation(opts.order, opts.receiptUrl);
  receiptOrder.customerEmail = opts.order.email ?? opts.to;
  const paidDate = emailDate(opts.invoice.paidAt);
  const paidAmount = formatMoney(
    opts.invoice.paidAmountCents ?? opts.invoice.amountCents,
    opts.invoice.currency,
  );
  const paymentDetails = [
    paidDate ? `Paid ${paidDate}` : null,
    opts.invoice.paymentMethod ? `Method: ${opts.invoice.paymentMethod}` : null,
    opts.invoice.paymentReference
      ? `Reference: ${opts.invoice.paymentReference}`
      : null,
  ].filter(Boolean) as string[];
  const body = `
    <p>${greeting}</p>
    <p>Payment has been recorded for invoice <strong>${escape(opts.invoice.number)}</strong>.</p>
    <p style="font-size:18px"><strong>Amount paid: ${escape(paidAmount)}</strong></p>
    ${
      paymentDetails.length
        ? `<ul style="color:#666;font-size:13px;margin:8px 0 18px;padding-left:18px">${paymentDetails
            .map((detail) => `<li>${escape(detail)}</li>`)
            .join("")}</ul>`
        : ""
    }
    <table style="width:100%;border-collapse:collapse;margin:18px 0">
      <thead>
        <tr style="color:#666;font-size:12px;text-transform:uppercase;letter-spacing:.08em">
          <th align="left" style="padding-bottom:8px">Item</th>
          <th align="center" style="padding-bottom:8px">Qty</th>
          <th align="right" style="padding-bottom:8px">Total</th>
        </tr>
      </thead>
      <tbody>${orderLinesHtml(receiptOrder)}</tbody>
    </table>
    ${totalsHtml(receiptOrder)}
    <p><a href="${escape(opts.receiptUrl)}" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">View receipt</a></p>
    ${
      opts.statusUrl
        ? `<p><a href="${escape(opts.statusUrl)}" style="display:inline-block;background:#fff;color:#111;border:1px solid #111;padding:9px 16px;border-radius:999px;text-decoration:none">Track order status</a></p>`
        : ""
    }
    <p style="color:#666;font-size:13px">Or paste this link into your browser:<br>${escape(opts.receiptUrl)}</p>`;
  return {
    to: opts.to,
    subject: `Receipt for ${opts.invoice.number} from ${opts.siteName}`,
    html: layout("Payment received", body),
    text: `${customerName ? `Hi ${customerName},` : "Hi,"}

Payment has been recorded for invoice ${opts.invoice.number}.
Amount paid: ${paidAmount}
${paidDate ? `Paid: ${paidDate}\n` : ""}${
      opts.invoice.paymentMethod ? `Method: ${opts.invoice.paymentMethod}\n` : ""
    }${
      opts.invoice.paymentReference
        ? `Reference: ${opts.invoice.paymentReference}\n`
        : ""
    }
${orderLinesText(receiptOrder)}

${totalsText(receiptOrder)}

View receipt: ${opts.receiptUrl}
${opts.statusUrl ? `Track order status: ${opts.statusUrl}` : ""}`,
  };
}

export function storeRefundIssued(opts: {
  to: string;
  order: AdminOrderDTO;
  refund: AdminOrderRefundDTO;
  receiptUrl: string;
  statusUrl?: string | null;
  siteName: string;
}): EmailMessage {
  const customerName = opts.order.clientName?.trim();
  const greeting = customerName ? `Hi ${escape(customerName)},` : "Hi,";
  const amount = formatMoney(opts.refund.amountCents, opts.refund.currency);
  const refundDate = emailDate(opts.refund.refundedAt);
  const details = [
    refundDate ? `Refunded ${refundDate}` : null,
    opts.refund.provider === "stripe" ? "Provider: Stripe" : null,
    opts.refund.status !== "succeeded" ? `Status: ${opts.refund.status}` : null,
    opts.refund.method ? `Method: ${opts.refund.method}` : null,
    opts.refund.reference ? `Reference: ${opts.refund.reference}` : null,
    opts.refund.reason ? `Reason: ${opts.refund.reason}` : null,
  ].filter(Boolean) as string[];
  const body = `
    <p>${greeting}</p>
    <p>A refund has been recorded for order <strong>${escape(opts.order.id)}</strong>.</p>
    <p style="font-size:18px"><strong>Amount refunded: ${escape(amount)}</strong></p>
    ${
      details.length
        ? `<ul style="color:#666;font-size:13px;margin:8px 0 18px;padding-left:18px">${details
            .map((detail) => `<li>${escape(detail)}</li>`)
            .join("")}</ul>`
        : ""
    }
    ${
      opts.refund.note
        ? `<p style="white-space:pre-wrap">${escape(opts.refund.note)}</p>`
        : ""
    }
    <p><a href="${escape(opts.receiptUrl)}" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">View receipt</a></p>
    ${
      opts.statusUrl
        ? `<p><a href="${escape(opts.statusUrl)}" style="display:inline-block;background:#fff;color:#111;border:1px solid #111;padding:9px 16px;border-radius:999px;text-decoration:none">Track order status</a></p>`
        : ""
    }
    <p style="color:#666;font-size:13px">Or paste this link into your browser:<br>${escape(opts.receiptUrl)}</p>`;
  return {
    to: opts.to,
    subject: `Refund for order ${opts.order.id} from ${opts.siteName}`,
    html: layout("Refund recorded", body),
    text: `${customerName ? `Hi ${customerName},` : "Hi,"}

A refund has been recorded for order ${opts.order.id}.
Amount refunded: ${amount}
${refundDate ? `Refunded: ${refundDate}\n` : ""}${
      opts.refund.method ? `Method: ${opts.refund.method}\n` : ""
    }${opts.refund.reference ? `Reference: ${opts.refund.reference}\n` : ""}${
      opts.refund.reason ? `Reason: ${opts.refund.reason}\n` : ""
    }${opts.refund.note ? `\n${opts.refund.note}\n` : ""}
View receipt: ${opts.receiptUrl}
${opts.statusUrl ? `Track order status: ${opts.statusUrl}` : ""}`,
  };
}

type FulfillmentEmailOpts = {
  to: string;
  order: AdminOrderDTO;
  receiptUrl: string | null;
  statusUrl?: string | null;
  siteName: string;
};

function fulfillmentTrackingHtml(order: AdminOrderDTO) {
  const details = [
    order.fulfillmentCarrier ? `Carrier: ${order.fulfillmentCarrier}` : null,
    order.fulfillmentTrackingNumber
      ? `Tracking: ${order.fulfillmentTrackingNumber}`
      : null,
  ].filter(Boolean) as string[];
  if (!details.length && !order.fulfillmentTrackingUrl) return "";
  return `<div style="background:#f6f6f6;border-radius:12px;padding:14px;margin:18px 0">
    ${
      details.length
        ? `<ul style="color:#555;font-size:13px;margin:0;padding-left:18px">${details
            .map((detail) => `<li>${escape(detail)}</li>`)
            .join("")}</ul>`
        : ""
    }
    ${
      order.fulfillmentTrackingUrl
        ? `<p style="margin:12px 0 0"><a href="${escape(order.fulfillmentTrackingUrl)}" style="display:inline-block;background:#111;color:#fff;padding:9px 16px;border-radius:999px;text-decoration:none">Track shipment</a></p>`
        : ""
    }
  </div>`;
}

function fulfillmentTrackingText(order: AdminOrderDTO) {
  return [
    order.fulfillmentCarrier ? `Carrier: ${order.fulfillmentCarrier}` : null,
    order.fulfillmentTrackingNumber
      ? `Tracking: ${order.fulfillmentTrackingNumber}`
      : null,
    order.fulfillmentTrackingUrl ? `Track: ${order.fulfillmentTrackingUrl}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function fulfillmentEmail(
  opts: FulfillmentEmailOpts & {
    title: string;
    subject: string;
    lead: string;
    ctaLabel: string;
  },
): EmailMessage {
  const customerName = opts.order.clientName?.trim();
  const greeting = customerName ? `Hi ${escape(customerName)},` : "Hi,";
  const emailOrder = adminOrderToConfirmation(opts.order, opts.receiptUrl ?? "");
  emailOrder.customerEmail = opts.order.email ?? opts.to;
  const body = `
    <p>${greeting}</p>
    <p>${escape(opts.lead)}</p>
    <p style="color:#666;font-size:13px">Order ${escape(opts.order.id)}</p>
    ${fulfillmentTrackingHtml(opts.order)}
    <table style="width:100%;border-collapse:collapse;margin:18px 0">
      <thead>
        <tr style="color:#666;font-size:12px;text-transform:uppercase;letter-spacing:.08em">
          <th align="left" style="padding-bottom:8px">Item</th>
          <th align="center" style="padding-bottom:8px">Qty</th>
          <th align="right" style="padding-bottom:8px">Total</th>
        </tr>
      </thead>
      <tbody>${orderLinesHtml(emailOrder)}</tbody>
    </table>
    ${
      opts.statusUrl
        ? `<p><a href="${escape(opts.statusUrl)}" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Track order status</a></p>`
        : ""
    }
    ${
      opts.receiptUrl
        ? `<p><a href="${escape(opts.receiptUrl)}" style="display:inline-block;background:#fff;color:#111;border:1px solid #111;padding:9px 16px;border-radius:999px;text-decoration:none">${escape(opts.ctaLabel)}</a></p>
    <p style="color:#666;font-size:13px">Or paste this link into your browser:<br>${escape(opts.receiptUrl)}</p>`
        : ""
    }`;
  const trackingText = fulfillmentTrackingText(opts.order);
  return {
    to: opts.to,
    subject: opts.subject,
    html: layout(opts.title, body),
    text: `${customerName ? `Hi ${customerName},` : "Hi,"}

${opts.lead}

Order ${opts.order.id}
${trackingText ? `\n${trackingText}\n` : ""}
${orderLinesText(emailOrder)}

${opts.statusUrl ? `Track order status: ${opts.statusUrl}\n` : ""}
${opts.receiptUrl ? `${opts.ctaLabel}: ${opts.receiptUrl}` : opts.siteName}`,
  };
}

export function storeOrderReady(opts: FulfillmentEmailOpts): EmailMessage {
  return fulfillmentEmail({
    ...opts,
    title: "Your order is ready",
    subject: `Order ${opts.order.id} is ready`,
    lead: "Your order is ready. The studio will follow up with any pickup or handoff details.",
    ctaLabel: "View receipt",
  });
}

export function storeOrderShipped(opts: FulfillmentEmailOpts): EmailMessage {
  return fulfillmentEmail({
    ...opts,
    title: "Your order has shipped",
    subject: `Order ${opts.order.id} has shipped`,
    lead: "Your order has shipped. Tracking details are below when available.",
    ctaLabel: "View receipt",
  });
}

export function storeOrderDelivered(opts: FulfillmentEmailOpts): EmailMessage {
  return fulfillmentEmail({
    ...opts,
    title: "Your order was delivered",
    subject: `Order ${opts.order.id} was delivered`,
    lead: "Your order has been marked delivered. Thank you for ordering from the studio.",
    ctaLabel: "View receipt",
  });
}
