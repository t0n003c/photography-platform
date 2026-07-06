"use client";

import Link from "next/link";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PackingSlipActions({ backHref }: { backHref: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
      <Link
        href={backHref}
        className="text-sm text-[hsl(var(--muted-foreground))] underline-offset-4 hover:underline"
      >
        Back to store
      </Link>
      <Button type="button" onClick={() => window.print()}>
        <Printer className="h-4 w-4" />
        Print packing slip
      </Button>
    </div>
  );
}
