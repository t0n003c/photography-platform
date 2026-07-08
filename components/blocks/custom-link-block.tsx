import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import type { LeafBlock } from "@/src/lib/blocks";
import { cn } from "@/src/lib/utils";

type CustomLinkBlockData = Extract<LeafBlock, { type: "customLink" }>;
type CSSVars = CSSProperties & { [key: `--${string}`]: string | number | undefined };

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

function CustomLinkAnchor({
  href,
  className,
  children,
}: {
  href?: string | null;
  className?: string;
  children: ReactNode;
}) {
  const cleanHref = (href ?? "").trim();
  if (!cleanHref || cleanHref === "#") {
    return <span className={className}>{children}</span>;
  }
  if (isExternalHref(cleanHref)) {
    return (
      <a href={cleanHref} className={className} target="_blank" rel="noreferrer noopener">
        {children}
      </a>
    );
  }
  return (
    <Link href={cleanHref} className={className}>
      {children}
    </Link>
  );
}

export function CustomLinkBlock({ block }: { block: CustomLinkBlockData }) {
  const items = block.items ?? [];
  const vars: CSSVars = {
    "--custom-link-bg": block.showBackground === false ? "transparent" : block.backgroundColor,
    "--custom-link-text":
      block.showBackground === false ? "hsl(var(--foreground))" : block.textColor,
    "--custom-link-muted":
      block.showBackground === false ? "hsl(var(--muted-foreground))" : block.textColor,
    "--custom-link-accent":
      block.showBackground === false ? "hsl(var(--primary))" : block.accentColor,
  };

  if (block.layout === "center-button") {
    const label = (block.buttonLabel ?? "").trim();
    if (!label) return null;
    return (
      <section
        className={cn("custom-link-block custom-link-button-block", block.showBackground === false && "is-transparent")}
        style={vars}
      >
        <CustomLinkAnchor href={block.buttonHref} className="custom-link-button">
          {label}
        </CustomLinkAnchor>
      </section>
    );
  }

  return (
    <section
      className={cn("custom-link-block custom-link-row-block", block.showBackground === false && "is-transparent")}
      style={vars}
    >
      <div className="custom-link-row">
        {(items.length > 0 ? items : [{ id: "empty", title: "PORTRAITS", subtitle: "BEST WORKS", href: "#" }]).map((item) => (
          <div key={item.id} className="custom-link-item">
            <CustomLinkAnchor href={item.href} className="custom-link-card">
              <span className="custom-link-title">{item.title}</span>
              {item.subtitle && <span className="custom-link-subtitle">{item.subtitle}</span>}
            </CustomLinkAnchor>
          </div>
        ))}
      </div>
    </section>
  );
}
