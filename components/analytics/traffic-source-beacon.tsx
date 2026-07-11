"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function TrafficSourceBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin") || pathname.startsWith("/api")) {
      return;
    }

    const payload = JSON.stringify({
      path: `${window.location.pathname}${window.location.search}`,
      referrer: document.referrer,
    });

    if ("sendBeacon" in navigator) {
      const sent = navigator.sendBeacon(
        "/api/v1/traffic",
        new Blob([payload], { type: "application/json" }),
      );
      if (sent) return;
    }

    void fetch("/api/v1/traffic", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => undefined);
  }, [pathname]);

  return null;
}
