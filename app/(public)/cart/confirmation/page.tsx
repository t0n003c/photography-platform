import { StoreOrderConfirmationPage } from "@/components/store/order-confirmation-page";
import { buildMetadata } from "@/src/lib/seo";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return buildMetadata({
    title: "Order confirmation",
    description: "Confirmation for a manual invoice order request.",
    path: "/cart/confirmation",
  });
}

export default async function CartConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawOrder = Array.isArray(params.order) ? params.order[0] : params.order;
  const orderId = rawOrder?.trim() || null;
  return <StoreOrderConfirmationPage orderId={orderId} />;
}
