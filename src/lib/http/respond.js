// Shared helpers for Route Handlers.

import { cookies } from "next/headers";
import { log } from "../log.js";
import { clientIp, rateLimit } from "./rate-limit.js";
import { SESSION_COOKIE, verifySessionToken } from "../auth/session.js";

export function json(data, init = {}) {
  return Response.json(data, init);
}

export function errorResponse(err, context = {}) {
  if (err?.status === 400 && err.errors) return json({ error: "Validation failed", fields: err.errors }, { status: 400 });
  if (err?.code === "DB_NOT_CONFIGURED") return json({ error: "Database is not configured" }, { status: 503 });
  log.error("request failed", { ...context, error: err?.message, stack: err?.stack?.split("\n").slice(0, 4).join(" | ") });
  return json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

export function limitOr429(request, name, opts) {
  const r = rateLimit(`${name}:${clientIp(request)}`, opts);
  if (r.ok) return null;
  return json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(r.retryAfterS) } });
}

export async function readJson(request, maxBytes = 100_000) {
  const text = await request.text();
  if (text.length > maxBytes) {
    const e = new Error("Body too large");
    e.status = 400;
    e.errors = { body: "Request body too large" };
    throw e;
  }
  try {
    return JSON.parse(text || "{}");
  } catch {
    const e = new Error("Invalid JSON");
    e.status = 400;
    e.errors = { body: "Invalid JSON" };
    throw e;
  }
}

/**
 * Returns the admin session or a 401/403 Response. Mutating requests must
 * also come from our own origin (CSRF defence on top of SameSite=Strict).
 */
export async function requireAdmin(request) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = verifySessionToken(token);
  if (!session) return { response: json({ error: "Unauthorized" }, { status: 401 }) };
  if (request && !["GET", "HEAD"].includes(request.method)) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    if (!origin || new URL(origin).host !== host) return { response: json({ error: "Bad origin" }, { status: 403 }) };
  }
  return { session };
}
