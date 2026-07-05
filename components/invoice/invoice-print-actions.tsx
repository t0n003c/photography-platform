"use client";

import { useState } from "react";
import { Check, Copy, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InvoicePrintActions({ label }: { label: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-wrap justify-end gap-2 print:hidden">
      <Button type="button" variant="outline" onClick={copyLink}>
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copied" : "Copy link"}
      </Button>
      <Button type="button" onClick={() => window.print()}>
        <Printer className="h-4 w-4" />
        Print / Save PDF
      </Button>
      <span className="sr-only">{label}</span>
    </div>
  );
}
