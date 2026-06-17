import Link from "next/link";
import { Container } from "@/components/ui/container";
import { buildMetadata } from "@/src/lib/seo";
import { getSiteMeta } from "@/src/db/queries/settings";
import {
  ensureCorePagesSeeded,
  getPublishedPageBySlug,
} from "@/src/db/queries/pages";
import { parseBlocks } from "@/src/lib/blocks";
import { BlockRenderer } from "@/components/blocks/block-renderer";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { name } = await getSiteMeta();
  const pg = await getPublishedPageBySlug("about");
  return buildMetadata({
    title: pg?.seoTitle ?? pg?.title ?? "About",
    description: pg?.seoDescription ?? `About ${name}.`,
    path: "/about",
  });
}

// About is now a builder page. It renders from the `page` table (seeded once),
// falling back to the original hardcoded copy if the row is unavailable.
export default async function AboutPage() {
  await ensureCorePagesSeeded();
  const pg = await getPublishedPageBySlug("about");
  if (pg) {
    return (
      <div className="py-4">
        <BlockRenderer blocks={parseBlocks(pg.blocks)} />
      </div>
    );
  }

  // Fallback (DB unavailable): original static content.
  return (
    <Container className="py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">About the studio</h1>
        <div className="mt-6 space-y-4 text-[hsl(var(--muted-foreground))]">
          <p>
            This studio is a self-hosted home for a working photographer&apos;s
            portfolio, private client galleries, and fine-art prints. Portraits,
            events, and the wild places in between — captured and delivered with
            care.
          </p>
          <p>
            Every shoot is organised by category and by the places it was made.
            Clients receive their own private, access-controlled gallery to view,
            favourite, and download their images, and to order prints.
          </p>
        </div>
        <Link
          href="/contact"
          className="mt-8 inline-block rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground"
        >
          Start a conversation
        </Link>
      </div>
    </Container>
  );
}
