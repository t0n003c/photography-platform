"use client";

import { FormEvent, useMemo, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import { AddToCartButton } from "@/components/store/add-to-cart-button";
import type { ProductDTO } from "@/src/db/queries/store";
import { cn } from "@/src/lib/utils";

type SortMode = "default" | "name-asc" | "price-asc" | "price-desc";

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(cents / 100);
}

function productSalePrice(product: Pick<ProductDTO, "basePriceCents" | "salePriceCents">) {
  if (product.salePriceCents === null) return null;
  return product.salePriceCents < product.basePriceCents ? product.salePriceCents : null;
}

function productCurrentPrice(product: Pick<ProductDTO, "basePriceCents" | "salePriceCents">) {
  return productSalePrice(product) ?? product.basePriceCents;
}

function productHref(product: ProductDTO) {
  return `/product/${product.slug}`;
}

function matchesQuery(product: ProductDTO, query: string) {
  if (!query) return true;
  const haystack = [
    product.name,
    product.sku,
    product.description,
    product.category,
    ...product.tags,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
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
  query,
  activeTag,
  showSearch,
  showTagCloud,
  onQueryChange,
  onTagChange,
}: {
  products: ProductDTO[];
  query: string;
  activeTag: string | null;
  showSearch: boolean;
  showTagCloud: boolean;
  onQueryChange: (query: string) => void;
  onTagChange: (tag: string | null) => void;
}) {
  const tags = [...new Set(products.flatMap((product) => product.tags))].sort((a, b) =>
    a.localeCompare(b),
  );
  if (!showSearch && (!showTagCloud || tags.length === 0)) return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <aside className="tora-shop-sidebar">
      {showSearch && (
        <section className="tora-shop-sidebar__box">
          <form className="tora-shop-search" onSubmit={submit}>
            <input
              name="shop-q"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Keyword search..."
              aria-label="Keyword search"
            />
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
              <button
                type="button"
                key={tag}
                className={cn(
                  index % 5 === 1 && "is-large",
                  index % 5 === 3 && "is-medium",
                  activeTag === tag && "is-active",
                )}
                onClick={() => onTagChange(activeTag === tag ? null : tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}

export function ShopGridClient({
  products,
  hasSidebar,
  showSearch,
  showTagCloud,
  showSorting,
  showSaleBadge,
  showPrices,
}: {
  products: ProductDTO[];
  hasSidebar: boolean;
  showSearch: boolean;
  showTagCloud: boolean;
  showSorting: boolean;
  showSaleBadge: boolean;
  showPrices: boolean;
}) {
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>("default");

  const visible = useMemo(() => {
    const filtered = products.filter((product) => {
      if (!matchesQuery(product, query.trim())) return false;
      if (activeTag && !product.tags.includes(activeTag)) return false;
      return true;
    });
    if (sort === "name-asc") {
      return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    }
    if (sort === "price-asc") {
      return [...filtered].sort((a, b) => productCurrentPrice(a) - productCurrentPrice(b));
    }
    if (sort === "price-desc") {
      return [...filtered].sort((a, b) => productCurrentPrice(b) - productCurrentPrice(a));
    }
    return filtered;
  }, [activeTag, products, query, sort]);

  const isFiltered = query.trim() || activeTag;

  return (
    <div className="tora-shop-shell">
      {hasSidebar && (
        <Sidebar
          products={products}
          query={query}
          activeTag={activeTag}
          showSearch={showSearch}
          showTagCloud={showTagCloud}
          onQueryChange={setQuery}
          onTagChange={setActiveTag}
        />
      )}
      <div className="tora-shop-main">
        <div className="tora-shop-toolbar">
          <p>
            Showing {visible.length} of {products.length} result
            {products.length === 1 ? "" : "s"}
          </p>
          {showSorting && (
            <select
              aria-label="Product sorting"
              value={sort}
              onChange={(event) => setSort(event.target.value as SortMode)}
            >
              <option value="default">Default sorting</option>
              <option value="name-asc">Sort by name</option>
              <option value="price-asc">Sort by price: low to high</option>
              <option value="price-desc">Sort by price: high to low</option>
            </select>
          )}
        </div>
        {visible.length === 0 ? (
          <div className="tora-shop-empty">
            <h3>{products.length === 0 ? "Great things are on the horizon" : "No products found"}</h3>
            <p>
              {products.length === 0
                ? "Products assigned to this shop block will appear here."
                : "Try a different keyword or tag."}
            </p>
            {isFiltered && (
              <button
                type="button"
                className="tora-shop-clear"
                onClick={() => {
                  setQuery("");
                  setActiveTag(null);
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="tora-shop-grid">
            {visible.map((product) => (
              <ToraProductCard
                key={product.id}
                product={product}
                showSaleBadge={showSaleBadge}
                showPrices={showPrices}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
