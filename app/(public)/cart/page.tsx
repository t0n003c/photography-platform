import { StoreCartPage } from "@/components/store/cart-page";
import { buildMetadata } from "@/src/lib/seo";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return buildMetadata({
    title: "Cart",
    description: "Review selected products and submit a manual invoice request.",
    path: "/cart",
  });
}

export default function CartPage() {
  return <StoreCartPage />;
}
