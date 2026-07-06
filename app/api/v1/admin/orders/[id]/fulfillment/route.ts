import { z } from "zod";
import { requireRole } from "@/src/auth/session";
import { issueInvoiceToken } from "@/src/auth/invoice-token";
import { issueOrderStatusToken } from "@/src/auth/order-status-token";
import { enqueueEmail } from "@/src/email/send";
import {
  storeOrderDelivered,
  storeOrderReady,
  storeOrderShipped,
} from "@/src/email/templates";
import { getOrderAdmin, updateOrderFulfillmentAdmin } from "@/src/db/queries/orders";
import type { FulfillmentStatus } from "@/src/db/queries/orders";
import { getSiteSettings } from "@/src/db/queries/settings";
import { writeAudit } from "@/src/lib/audit";
import { getEnv } from "@/src/lib/env";
import { notFound, ok, parseJson, problem } from "@/src/lib/http";
import { orderStatusUrl } from "@/src/lib/order-status";
import { clientIp, userAgent } from "@/src/lib/request";

export const dynamic = "force-dynamic";

const FulfillmentSchema = z.object({
  fulfillmentStatus: z.enum([
    "unfulfilled",
    "in_progress",
    "ready",
    "shipped",
    "delivered",
    "cancelled",
  ]),
  fulfillmentCarrier: z.string().max(120).nullable().optional(),
  fulfillmentTrackingNumber: z.string().max(200).nullable().optional(),
  fulfillmentTrackingUrl: z.string().url().max(500).nullable().optional(),
  fulfillmentReadyAt: z.string().max(40).nullable().optional(),
  fulfillmentShippedAt: z.string().max(40).nullable().optional(),
  fulfillmentDeliveredAt: z.string().max(40).nullable().optional(),
  fulfillmentNotes: z.string().max(2000).nullable().optional(),
  sendEmail: z.boolean().default(false),
});

function trimSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function parseMilestoneDate(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const raw = value.trim();
  const parsed = new Date(raw.includes("T") ? raw : `${raw}T12:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function canSendFulfillmentEmail(status: FulfillmentStatus) {
  return status === "ready" || status === "shipped" || status === "delivered";
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

  const parsed = await parseJson(req, FulfillmentSchema);
  if ("error" in parsed) return parsed.error;

  if (
    parsed.data.sendEmail &&
    !canSendFulfillmentEmail(parsed.data.fulfillmentStatus)
  ) {
    return problem(
      422,
      "FULFILLMENT_EMAIL_NOT_AVAILABLE",
      "Fulfillment emails can be sent only for ready, shipped, or delivered updates.",
    );
  }
  if (parsed.data.sendEmail && !current.email) {
    return problem(
      422,
      "ORDER_EMAIL_REQUIRED",
      "Add a customer email before sending a fulfillment update.",
    );
  }

  const readyAt = parseMilestoneDate(parsed.data.fulfillmentReadyAt);
  const shippedAt = parseMilestoneDate(parsed.data.fulfillmentShippedAt);
  const deliveredAt = parseMilestoneDate(parsed.data.fulfillmentDeliveredAt);
  if (parsed.data.fulfillmentReadyAt?.trim() && !readyAt) {
    return problem(422, "INVALID_READY_DATE", "Ready date is invalid.");
  }
  if (parsed.data.fulfillmentShippedAt?.trim() && !shippedAt) {
    return problem(422, "INVALID_SHIPPED_DATE", "Shipped date is invalid.");
  }
  if (parsed.data.fulfillmentDeliveredAt?.trim() && !deliveredAt) {
    return problem(422, "INVALID_DELIVERED_DATE", "Delivered date is invalid.");
  }

  const order = await updateOrderFulfillmentAdmin(id, {
    fulfillmentStatus: parsed.data.fulfillmentStatus,
    fulfillmentCarrier: parsed.data.fulfillmentCarrier,
    fulfillmentTrackingNumber: parsed.data.fulfillmentTrackingNumber,
    fulfillmentTrackingUrl: parsed.data.fulfillmentTrackingUrl,
    fulfillmentReadyAt:
      parsed.data.fulfillmentReadyAt === undefined ? undefined : readyAt,
    fulfillmentShippedAt:
      parsed.data.fulfillmentShippedAt === undefined ? undefined : shippedAt,
    fulfillmentDeliveredAt:
      parsed.data.fulfillmentDeliveredAt === undefined ? undefined : deliveredAt,
    fulfillmentNotes: parsed.data.fulfillmentNotes,
  });
  if (!order) return notFound();

  let receiptUrl: string | null = null;
  if (order.invoice) {
    const token = issueInvoiceToken(order.invoice.id);
    receiptUrl = `${trimSlash(getEnv().APP_BASE_URL)}/invoice/${encodeURIComponent(
      token,
    )}`;
  }

  if (parsed.data.sendEmail && order.email) {
    const settings = await getSiteSettings();
    const common = {
      to: order.email,
      order,
      receiptUrl,
      statusUrl: orderStatusUrl(issueOrderStatusToken(order.id)),
      siteName: settings.siteTitle,
    };
    const message =
      order.fulfillmentStatus === "delivered"
        ? storeOrderDelivered(common)
        : order.fulfillmentStatus === "shipped"
          ? storeOrderShipped(common)
          : storeOrderReady(common);
    await enqueueEmail(message);
  }

  await writeAudit({
    actorId: a.session.user.id,
    action: parsed.data.sendEmail
      ? "order.fulfillment.email"
      : "order.fulfillment.update",
    entityType: "order",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: {
      fromOrderStatus: current.status,
      toOrderStatus: order.status,
      fromFulfillmentStatus: current.fulfillmentStatus,
      toFulfillmentStatus: order.fulfillmentStatus,
      carrier: order.fulfillmentCarrier,
      trackingNumber: order.fulfillmentTrackingNumber,
      emailSent: parsed.data.sendEmail,
    },
  });

  return ok({ data: { order, receiptUrl } });
}
