import type { CSSProperties } from "react";
import { ShoppingBag } from "lucide-react";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import { AddToCartButton } from "@/components/store/add-to-cart-button";
import { listProductsPublic, productSalePrice, type ProductDTO } from "@/src/db/queries/store";
import type { LeafBlock } from "@/src/lib/blocks";
import { cn } from "@/src/lib/utils";

type ShopBlockData = Extract<LeafBlock, { type: "shop" }>;

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(cents / 100);
}

function themeClass(theme: ShopBlockData["theme"]) {
  if (theme === "dark") return "is-dark";
  if (theme === "light") return "is-light";
  return "";
}

function styleVars(block: ShopBlockData): CSSProperties {
  return {
    "--shop-bg": block.backgroundColor,
    "--shop-text": block.textColor,
    "--shop-accent": block.accentColor,
  } as CSSProperties;
}

function productHref(product: ProductDTO) {
  return `/product/${product.slug}`;
}

function ToraProductCard({
  product,
  showSaleBadge,
  showPrices,
}: {
  product: ProductDTO;
  showSaleBadge: boolean;
  showPrices: boolean;
}) {
  const sale = productSalePrice(product);
  return (
    <article className="tora-shop-card">
      <a href={productHref(product)} className="tora-shop-card__image" aria-label={product.name}>
        {product.photo ? (
          <ResponsiveImage
            photo={product.photo}
            sizes="(max-width: 767px) 100vw, (max-width: 1200px) 33vw, 275px"
            className="h-full w-full"
          />
        ) : (
          <div className="tora-shop-card__placeholder">
            <ShoppingBag aria-hidden className="h-8 w-8" />
          </div>
        )}
        {showSaleBadge && sale !== null && <span className="tora-shop-card__sale">Sale!</span>}
      </a>
      <h3>
        <a href={productHref(product)}>{product.name}</a>
      </h3>
      {showPrices && (
        <p className="tora-shop-card__price">
          {sale !== null ? (
            <>
              <del>{formatMoney(product.basePriceCents, product.currency)}</del>
              <ins>{formatMoney(sale, product.currency)}</ins>
            </>
          ) : (
            <span>{formatMoney(product.basePriceCents, product.currency)}</span>
          )}
        </p>
      )}
      <AddToCartButton productId={product.id} compact />
    </article>
  );
}

function Sidebar({
  products,
  showSearch,
  showTagCloud,
}: {
  products: ProductDTO[];
  showSearch: boolean;
  showTagCloud: boolean;
}) {
  const tags = [...new Set(products.flatMap((product) => product.tags))].sort((a, b) =>
    a.localeCompare(b),
  );
  if (!showSearch && (!showTagCloud || tags.length === 0)) return null;

  return (
    <aside className="tora-shop-sidebar">
      {showSearch && (
        <section className="tora-shop-sidebar__box">
          <form className="tora-shop-search" action="" method="get">
            <input name="shop-q" placeholder="Keyword search..." aria-label="Keyword search" />
            <button type="submit" aria-label="Search products" />
          </form>
        </section>
      )}
      {showTagCloud && tags.length > 0 && (
        <section className="tora-shop-sidebar__box">
          <h3>Tag cloud</h3>
          <div className="tora-shop-sidebar__rule" />
          <div className="tora-shop-tags">
            {tags.map((tag, index) => (
              <span
                key={tag}
                className={cn(
                  index % 5 === 1 && "is-large",
                  index % 5 === 3 && "is-medium",
                )}
              >
                {tag}
              </span>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}

function ComingSoon({ block }: { block: ShopBlockData }) {
  return (
    <section
      className={cn("tora-shop-coming-soon", themeClass(block.theme))}
      style={styleVars(block)}
    >
      <div>
        <h2>{block.title || "Great things are on the horizon"}</h2>
        {block.body && <p>{block.body}</p>}
      </div>
    </section>
  );
}

export async function ShopBlock({ block }: { block: ShopBlockData }) {
  if (block.style === "tora-coming-soon") return <ComingSoon block={block} />;

  const products = await listProductsPublic({
    source: block.source,
    category: block.category,
    limit: block.limit,
  });
  const hasSidebar =
    block.showSidebar && (block.showSearch || block.showTagCloud) && products.length > 0;

  return (
    <section
      className={cn("tora-shop-block", themeClass(block.theme), !hasSidebar && "no-sidebar")}
      style={styleVars(block)}
    >
      <div className="tora-shop-heading">
        <h2>{block.title || "SHOP"}</h2>
        {block.body && <p>{block.body}</p>}
      </div>
      <div className="tora-shop-shell">
        {hasSidebar && (
          <Sidebar
            products={products}
            showSearch={block.showSearch}
            showTagCloud={block.showTagCloud}
          />
        )}
        <div className="tora-shop-main">
          <div className="tora-shop-toolbar">
            <p>
              Showing all {products.length} result{products.length === 1 ? "" : "s"}
            </p>
            {block.showSorting && (
              <select aria-label="Product sorting" defaultValue="default">
                <option value="default">Default sorting</option>
                <option value="price-asc">Sort by price: low to high</option>
                <option value="price-desc">Sort by price: high to low</option>
              </select>
            )}
          </div>
          {products.length === 0 ? (
            <div className="tora-shop-empty">
              <h3>Great things are on the horizon</h3>
              <p>Products assigned to this shop block will appear here.</p>
            </div>
          ) : (
            <div className="tora-shop-grid">
              {products.map((product) => (
                <ToraProductCard
                  key={product.id}
                  product={product}
                  showSaleBadge={block.showSaleBadge}
                  showPrices={block.showPrices}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
