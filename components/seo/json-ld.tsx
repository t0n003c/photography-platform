// Server component that emits a JSON-LD <script>. It carries the CSP nonce so
// it is allowed under the enforced nonce-based policy.
export function JsonLd({ data, nonce }: { data: unknown; nonce?: string }) {
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
