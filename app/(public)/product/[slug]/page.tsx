import { notFound } from "next/navigation";
import Link from "next/link";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import { ProductPurchaseForm } from "@/components/store/product-purchase-form";
import { getActiveProductBySlug, productSalePrice } from "@/src/db/queries/store";
import { buildMetadata } from "@/src/lib/seo";

export const dynamic = "force-dynamic";

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(cents / 100);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getActiveProductBySlug(slug);
  if (!product) return buildMetadata({ path: `/product/${slug}` });
  return buildMetadata({
    title: product.name,
    description: product.description ?? undefined,
    path: `/product/${slug}`,
  });
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getActiveProductBySlug(slug);
  if (!product) notFound();
  const sale = productSalePrice(product);

  return (
    <section className="tora-product-page">
      <div className="tora-product-page__crumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <span>Shop</span>
      </div>
      <div className="tora-product-page__inner">
        <div className="tora-product-page__image">
          {product.photo ? (
            <ResponsiveImage
              photo={product.photo}
              sizes="(max-width: 767px) 100vw, 50vw"
              className="h-full w-full"
              priority
            />
          ) : null}
          {sale !== null && <span>Sale!</span>}
        </div>
        <div className="tora-product-page__summary">
          <p className="tora-product-page__kind">{product.kind}</p>
          <h1>{product.name}</h1>
          <p className="tora-product-page__price">
            {sale !== null ? (
              <>
                <del>{formatMoney(product.basePriceCents, product.currency)}</del>
                <ins>{formatMoney(sale, product.currency)}</ins>
              </>
            ) : (
              <span>{formatMoney(product.basePriceCents, product.currency)}</span>
            )}
          </p>
          {product.description && (
            <p className="tora-product-page__description">{product.description}</p>
          )}
          <ProductPurchaseForm
            productId={product.id}
            currency={product.currency}
            basePriceCents={sale ?? product.basePriceCents}
            inventoryTracked={product.inventoryTracked}
            stockQuantity={product.stockQuantity}
            lowStockThreshold={product.lowStockThreshold}
            allowBackorder={product.allowBackorder}
            options={product.options}
          />
          <dl className="tora-product-page__meta">
            <div>
              <dt>SKU</dt>
              <dd>{product.sku}</dd>
            </div>
            {product.category && (
              <div>
                <dt>Category</dt>
                <dd>{product.category}</dd>
              </div>
            )}
            {product.tags.length > 0 && (
              <div>
                <dt>Tags</dt>
                <dd>{product.tags.join(", ")}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </section>
  );
}
