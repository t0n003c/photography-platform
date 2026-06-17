import { notFound } from "next/navigation";
import { getPublishedPageBySlug } from "@/src/db/queries/pages";
import { parseBlocks } from "@/src/lib/blocks";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { buildMetadata } from "@/src/lib/seo";

export const dynamic = "force-dynamic";

// Renders curated builder pages. Fixed routes (categories, locations,
// galleries, contact, about) take precedence; this catch-all only handles
// slugs they don't own.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const path = slug.join("/");
  const pg = await getPublishedPageBySlug(path);
  if (!pg) return buildMetadata({ path: `/${path}` });
  return buildMetadata({
    title: pg.seoTitle ?? pg.title,
    description: pg.seoDescription ?? undefined,
    path: `/${path}`,
  });
}

export default async function BuilderPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const pg = await getPublishedPageBySlug(slug.join("/"));
  if (!pg) notFound();
  const blocks = parseBlocks(pg.blocks);
  return (
    <div className="py-4">
      <BlockRenderer blocks={blocks} />
    </div>
  );
}
