import type { EmailMessage } from "@/src/email/provider";
import type { StoreOrderConfirmation } from "@/src/lib/store-order-confirmation";

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function layout(title: string, body: string): string {
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.6;color:#111">
  <div style="max-width:520px;margin:0 auto;padding:24px">
    <h2 style="margin:0 0 12px">${escape(title)}</h2>
    ${body}
  </div></body></html>`;
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
      <tr><td style="padding:4px 0;color:#666">Tax</td><td style="padding:4px 0;text-align:right">${escape(
        formatMoney(order.taxCents, order.currency),
      )}</td></tr>
      <tr><td style="padding:4px 0;color:#666">Shipping</td><td style="padding:4px 0;text-align:right">${escape(
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
    `Tax: ${formatMoney(order.taxCents, order.currency)}`,
    `Shipping: ${shippingText(order)}`,
    `Total: ${formatMoney(order.totalCents, order.currency)}`,
  ].join("\n");
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
  return {
    to: opts.to,
    subject: `Order request received: ${opts.order.orderId}`,
    html: layout("Order request received", body),
    text: `${name ? `Hi ${name},` : "Hi,"}

${opts.order.checkoutSettings.confirmationMessage}

Order ${opts.order.orderId}

${orderLinesText(opts.order)}

${totalsText(opts.order)}

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
