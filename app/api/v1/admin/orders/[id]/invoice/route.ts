import { z } from "zod";
import { requireRole } from "@/src/auth/session";
import { notFound, ok, parseJson, problem } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { writeAudit } from "@/src/lib/audit";
import { getEnv } from "@/src/lib/env";
import { enqueueEmail } from "@/src/email/send";
import { storeInvoiceIssued } from "@/src/email/templates";
import { getSiteSettings } from "@/src/db/queries/settings";
import { getOrderAdmin, saveInvoiceAdmin } from "@/src/db/queries/orders";

export const dynamic = "force-dynamic";

const InvoiceSchema = z.object({
  dueAt: z.string().max(40).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  paymentInstructions: z.string().max(2000).nullable().optional(),
  sendEmail: z.boolean().default(false),
});

function trimSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function parseDueDate(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const raw = value.trim();
  const parsed = new Date(raw.includes("T") ? raw : `${raw}T12:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;
  const current = await getOrderAdmin(id);
  if (!current) return notFound();

  const parsed = await parseJson(req, InvoiceSchema);
  if ("error" in parsed) return parsed.error;
  const dueAt = parseDueDate(parsed.data.dueAt);
  if (parsed.data.dueAt?.trim() && !dueAt) {
    return problem(422, "INVALID_DUE_DATE", "Invoice due date is invalid.");
  }
  if (parsed.data.sendEmail && !current.email) {
    return problem(
      422,
      "ORDER_EMAIL_REQUIRED",
      "Add a customer email before sending an invoice.",
    );
  }

  const result = await saveInvoiceAdmin(id, {
    dueAt,
    notes: parsed.data.notes,
    paymentInstructions: parsed.data.paymentInstructions,
    issue: parsed.data.sendEmail,
  });
  if (!result) return notFound();

  let invoiceUrl: string | null = null;
  const invoice = result.order.invoice;
  if (parsed.data.sendEmail && result.invoiceToken && invoice && result.order.email) {
    invoiceUrl = `${trimSlash(getEnv().APP_BASE_URL)}/invoice/${encodeURIComponent(
      result.invoiceToken,
    )}`;
    const settings = await getSiteSettings();
    await enqueueEmail(
      storeInvoiceIssued({
        to: result.order.email,
        order: result.order,
        invoice,
        invoiceUrl,
        siteName: settings.siteTitle,
      }),
    );
  }

  await writeAudit({
    actorId: a.session.user.id,
    action: parsed.data.sendEmail ? "order.invoice.send" : "order.invoice.save",
    entityType: "order",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: {
      invoiceId: invoice?.id ?? null,
      invoiceNumber: invoice?.number ?? null,
      fromStatus: current.status,
      toStatus: result.order.status,
      sent: parsed.data.sendEmail,
    },
  });

  return ok({ data: { order: result.order, invoiceUrl } });
}
