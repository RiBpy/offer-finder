// POST /api/admin/login { email, password }

import { cookies } from "next/headers";
import { checkCredentials, createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { errorResponse, json, limitOr429, readJson } from "@/lib/http/respond";
import { log } from "@/lib/log";
import { clientIp } from "@/lib/http/rate-limit";

export async function POST(request) {
  const limited = limitOr429(request, "login", { limit: 5, windowMs: 15 * 60_000 });
  if (limited) return limited;
  try {
    const { email, password } = await readJson(request, 2000);
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD_HASH || !process.env.SESSION_SECRET) {
      return json({ error: "Admin login is not configured on the server" }, { status: 503 });
    }
    if (!checkCredentials(email, password)) {
      log.warn("admin login failed", { ip: clientIp(request) });
      return json({ error: "Invalid email or password" }, { status: 401 });
    }
    (await cookies()).set(SESSION_COOKIE, createSessionToken(String(email).trim().toLowerCase()), sessionCookieOptions);
    log.info("admin login", { ip: clientIp(request) });
    return json({ ok: true });
  } catch (err) {
    return errorResponse(err, { route: "POST /api/admin/login" });
  }
}
