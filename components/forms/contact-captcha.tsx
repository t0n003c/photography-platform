"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    },
  ) => string;
  reset: (id?: string) => void;
}

const TURNSTILE_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function getTurnstile(): TurnstileApi | undefined {
  return (window as Window & { turnstile?: TurnstileApi }).turnstile;
}

export interface ContactCaptchaState {
  enabled: boolean;
  token: string | null;
  widgetRef: RefObject<HTMLDivElement | null>;
  reset: () => void;
}

export function useContactCaptcha(): ContactCaptchaState {
  const [enabled, setEnabled] = useState(false);
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/v1/contact-config", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        const captcha = data?.captcha;
        setEnabled(Boolean(captcha?.enabled && captcha?.siteKey));
        setSiteKey(captcha?.siteKey ?? null);
      })
      .catch(() => {
        if (!active) return;
        setEnabled(false);
        setSiteKey(null);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled || !siteKey) return;
    let cancelled = false;

    const renderWidget = () => {
      const turnstile = getTurnstile();
      if (cancelled || !widgetRef.current || !turnstile) return;
      if (widgetIdRef.current) return;
      widgetIdRef.current = turnstile.render(widgetRef.current, {
        sitekey: siteKey,
        callback: (nextToken) => setToken(nextToken),
        "expired-callback": () => setToken(null),
        "error-callback": () => setToken(null),
      });
    };

    if (getTurnstile()) {
      renderWidget();
    } else if (!document.querySelector(`script[src="${TURNSTILE_SRC}"]`)) {
      const script = document.createElement("script");
      script.src = TURNSTILE_SRC;
      script.async = true;
      script.defer = true;
      script.onload = renderWidget;
      document.head.appendChild(script);
    } else {
      const timer = window.setInterval(() => {
        if (getTurnstile()) {
          window.clearInterval(timer);
          renderWidget();
        }
      }, 200);
      return () => window.clearInterval(timer);
    }

    return () => {
      cancelled = true;
    };
  }, [enabled, siteKey]);

  return {
    enabled,
    token,
    widgetRef,
    reset: () => {
      setToken(null);
      const turnstile = getTurnstile();
      if (widgetIdRef.current && turnstile) {
        turnstile.reset(widgetIdRef.current);
      }
    },
  };
}

export function ContactCaptchaWidget({
  captcha,
  className = "",
}: {
  captcha: ContactCaptchaState;
  className?: string;
}) {
  if (!captcha.enabled) return null;
  return <div ref={captcha.widgetRef} className={className} />;
}
