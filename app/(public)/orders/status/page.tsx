import { OrderStatusPage } from "@/components/store/order-status-page";
import { buildMetadata } from "@/src/lib/seo";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return buildMetadata({
    title: "Order status",
    description: "Look up store order, payment, and fulfillment status.",
    path: "/orders/status",
  });
}

export default async function PublicOrderStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawToken = Array.isArray(params.token) ? params.token[0] : params.token;
  return <OrderStatusPage token={rawToken?.trim() || null} />;
}
