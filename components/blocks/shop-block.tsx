import type { CSSProperties } from "react";
import { ShopGridClient } from "@/components/store/shop-grid-client";
import { listProductsPublic } from "@/src/db/queries/store";
import type { LeafBlock } from "@/src/lib/blocks";
import { cn } from "@/src/lib/utils";

type ShopBlockData = Extract<LeafBlock, { type: "shop" }>;

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
      <ShopGridClient
        products={products}
        hasSidebar={hasSidebar}
        showSearch={block.showSearch}
        showTagCloud={block.showTagCloud}
        showSorting={block.showSorting}
        showSaleBadge={block.showSaleBadge}
        showPrices={block.showPrices}
      />
    </section>
  );
}
