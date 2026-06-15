import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { newId } from "@/src/lib/id";

// Standard JSON Problem-style responses + helpers (API-DESIGN §3.3).

export interface ProblemDetail {
  field?: string;
  issue: string;
}

export interface ProblemBody {
  error: {
    code: string;
    message: string;
    details?: ProblemDetail[];
    requestId: string;
  };
}

interface ProblemOpts {
  details?: ProblemDetail[];
  retryAfter?: number;
  requestId?: string;
  headers?: Record<string, string>;
}

function withMeta(res: NextResponse, requestId: string) {
  res.headers.set("X-Request-Id", requestId);
  res.headers.set("API-Version", "v1");
  return res;
}

export function json<T>(
  data: T,
  status = 200,
  opts?: { requestId?: string; headers?: Record<string, string> },
): NextResponse {
  const rid = opts?.requestId ?? newId();
  const res = NextResponse.json(data, { status });
  for (const [k, v] of Object.entries(opts?.headers ?? {})) res.headers.set(k, v);
  return withMeta(res, rid);
}

export const ok = <T>(data: T, headers?: Record<string, string>) =>
  json(data, 200, { headers });
export const created = <T>(data: T, headers?: Record<string, string>) =>
  json(data, 201, { headers });
export const accepted = <T>(data: T, headers?: Record<string, string>) =>
  json(data, 202, { headers });
export function noContent(): NextResponse {
  return withMeta(new NextResponse(null, { status: 204 }), newId());
}

export function problem(
  status: number,
  code: string,
  message: string,
  opts: ProblemOpts = {},
): NextResponse {
  const rid = opts.requestId ?? newId();
  const body: ProblemBody = {
    error: {
      code,
      message,
      ...(opts.details ? { details: opts.details } : {}),
      requestId: rid,
    },
  };
  const res = NextResponse.json(body, { status });
  for (const [k, v] of Object.entries(opts.headers ?? {})) res.headers.set(k, v);
  if (opts.retryAfter !== undefined)
    res.headers.set("Retry-After", String(opts.retryAfter));
  return withMeta(res, rid);
}

// Common problems
export const unauthorized = (msg = "Authentication required.") =>
  problem(401, "UNAUTHENTICATED", msg);
export const forbidden = (msg = "You do not have permission to do that.") =>
  problem(403, "FORBIDDEN", msg);
export const notFound = (msg = "Not found.") => problem(404, "NOT_FOUND", msg);
export const conflict = (code: string, msg: string) => problem(409, code, msg);
export const gone = (code: string, msg: string) => problem(410, code, msg);
export const tooMany = (retryAfter: number, msg = "Too many requests.") =>
  problem(429, "RATE_LIMITED", msg, { retryAfter });
export const internal = (msg = "Something went wrong.") =>
  problem(500, "INTERNAL", msg);

// Paginated envelope (API-DESIGN §3.1)
export function paginated<T>(
  data: T[],
  page: { nextCursor: string | null; hasMore: boolean; limit: number },
): NextResponse {
  return ok({ data, page });
}

// Parse + validate a JSON body, returning a problem response on failure.
export async function parseJson<T>(
  req: Request,
  schema: ZodType<T>,
): Promise<{ data: T } | { error: NextResponse }> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { error: problem(400, "INVALID_JSON", "Request body must be valid JSON.") };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      error: problem(422, "VALIDATION_ERROR", "Validation failed.", {
        details: parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          issue: i.message,
        })),
      }),
    };
  }
  return { data: parsed.data };
}
