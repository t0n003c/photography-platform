// Collects CSP violation reports while the policy is in Report-Only mode
// (SECURITY.md §5.2 — report first, then enforce). Logs for review.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.warn("[csp-report]", JSON.stringify(body));
  } catch {
    // ignore malformed reports
  }
  return new Response(null, { status: 204 });
}
