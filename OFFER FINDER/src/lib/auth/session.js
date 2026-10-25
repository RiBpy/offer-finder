// Admin authentication: a single administrator account configured through
// environment variables, scrypt password hash, HMAC-signed session cookie.

import crypto from "node:crypto";

export const SESSION_COOKIE = "of_admin";
const SESSION_TTL_S = 8 * 60 * 60;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set to at least 32 characters");
  return s;
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex");
  // ":" rather than "$" so .env loaders do not treat parts as variables.
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (typeof password !== "string" || typeof stored !== "string") return false;
  const [scheme, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  const expected = Buffer.from(hash, "hex");
  return expected.length === candidate.length && crypto.timingSafeEqual(candidate, expected);
}

export function checkCredentials(email, password) {
  const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const adminHash = process.env.ADMIN_PASSWORD_HASH || "";
  if (!adminEmail || !adminHash) return false;
  const emailOk = crypto.timingSafeEqual(
    crypto.createHash("sha256").update(String(email || "").trim().toLowerCase()).digest(),
    crypto.createHash("sha256").update(adminEmail).digest(),
  );
  const passOk = verifyPassword(password, adminHash);
  return emailOk && passOk;
}

function sign(payload) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionToken(email, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ sub: email, exp: Math.floor(now / 1000) + SESSION_TTL_S })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token, now = Date.now()) {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  let expected;
  try {
    expected = sign(payload);
  } catch {
    return null;
  }
  const a = Buffer.from(sig || "");
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return data.exp > now / 1000 ? data : null;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "strict",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_S,
};
