import { PageTransition } from "@/components/transitions/page-transition";

// A template re-mounts on every navigation (unlike layout), so wrapping children
// here gives each public route an enter transition.
export default function PublicTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageTransition>{children}</PageTransition>;
}
