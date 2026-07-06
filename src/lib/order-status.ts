import { getEnv } from "@/src/lib/env";

function trimSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function orderStatusPath(token: string) {
  return `/orders/status?token=${encodeURIComponent(token)}`;
}

export function orderStatusUrl(token: string) {
  return `${trimSlash(getEnv().APP_BASE_URL)}${orderStatusPath(token)}`;
}
