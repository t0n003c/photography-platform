// Server component that emits a JSON-LD <script>. The payload is a data block
// (type="application/ld+json"), so it is not executable JS and is CSP-safe.
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
