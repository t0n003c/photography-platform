import Link from "next/link";
import { Container } from "@/components/ui/container";
import { buildMetadata, SITE } from "@/src/lib/seo";

export const metadata = buildMetadata({
  title: "About",
  description: `About ${SITE.name}.`,
  path: "/about",
});

export default function AboutPage() {
  return (
    <Container className="py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">About the studio</h1>
        <div className="mt-6 space-y-4 text-[hsl(var(--muted-foreground))]">
          <p>
            {SITE.name} is a self-hosted home for a working photographer&apos;s
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
