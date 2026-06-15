import { Container } from "@/components/ui/container";
import { ContactForm } from "@/components/forms/contact-form";
import { buildMetadata } from "@/src/lib/seo";

export const metadata = buildMetadata({
  title: "Contact",
  description: "Inquiries about portraits, events, travel sessions and prints.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <Container className="py-16">
      <div className="mx-auto max-w-xl">
        <h1 className="text-3xl font-semibold tracking-tight">Get in touch</h1>
        <p className="mt-2 text-[hsl(var(--muted-foreground))]">
          Tell me about your session, event, or print order and I&apos;ll be in
          touch soon.
        </p>
        <div className="mt-8">
          <ContactForm />
        </div>
      </div>
    </Container>
  );
}
