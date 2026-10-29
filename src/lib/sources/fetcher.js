// Polite, defensive HTTP fetching for source pages:
// - only http(s), no credentials in URLs
// - refuses private/loopback addresses (SSRF protection for admin-submitted URLs)
// - honours robots.txt for our user agent
// - timeouts, size limit, manual redirect handling with re-checks
// - retry with exponential backoff on network errors and 5xx/429

import dns from "node:dns/promises";
import net from "node:net";
import { log } from "../log.js";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 5;

export function userAgent() {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://example.invalid";
  return `OfferFinderBot/0.1 (+${site.replace(/\/$/, "")}/about-bot)`;
}

export class FetchError extends Error {
  constructor(message, { code, status, retryable = false } = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224
    );
  }
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
}

async function assertPublicUrl(url) {
  const u = new URL(url);
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new FetchError("Only http(s) URLs are allowed", { code: "BAD_PROTOCOL" });
  if (u.username || u.password) throw new FetchError("URLs with credentials are not allowed", { code: "BAD_URL" });
  if (process.env.FETCH_ALLOW_PRIVATE_HOSTS === "1") return; // local tests only
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new FetchError("Private hosts are not allowed", { code: "PRIVATE_HOST" });
  }
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true }).catch(() => {
    throw new FetchError(`Could not resolve ${host}`, { code: "DNS", retryable: true });
  });
  if (addrs.some((a) => isPrivateIp(a.address))) throw new FetchError("Private addresses are not allowed", { code: "PRIVATE_HOST" });
}

async function readLimited(res) {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
}

async function rawFetch(url, { timeoutMs = 10000, accept = "text/html,application/xhtml+xml" } = {}) {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(current);
    let res;
    try {
      res = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
        headers: { "User-Agent": userAgent(), Accept: accept, "Accept-Language": "en" },
      });
    } catch (err) {
      const timeout = err?.name === "TimeoutError";
      throw new FetchError(timeout ? "Request timed out" : `Network error: ${err?.cause?.code || err.message}`, {
        code: timeout ? "TIMEOUT" : "NETWORK",
        retryable: true,
      });
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location"), current).toString();
      continue;
    }
    const body = await readLimited(res);
    return { status: res.status, url: current, headers: res.headers, body };
  }
  throw new FetchError("Too many redirects", { code: "REDIRECTS" });
}

// --- robots.txt -----------------------------------------------------------

const robotsCache = new Map(); // origin -> { rules, expires }

export function parseRobots(text, agent = "offerfinderbot") {
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") {
      if (!lastWasAgent) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (current && (key === "allow" || key === "disallow")) current.rules.push({ allow: key === "allow", path: value });
    }
  }
  const specific = groups.filter((g) => g.agents.some((a) => a !== "*" && agent.includes(a)));
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes("*"));
  return chosen.flatMap((g) => g.rules).filter((r) => r.path !== "" || !r.allow);
}

function ruleMatches(pattern, path) {
  if (pattern === "") return false;
  const re = new RegExp(
    "^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"),
  );
  return re.test(path);
}

export function isAllowedByRobots(rules, pathWithQuery) {
  let best = null;
  for (const r of rules) {
    if (!ruleMatches(r.path, pathWithQuery)) continue;
    if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow)) best = r;
  }
  return !best || best.allow;
}

export async function robotsAllows(url) {
  const u = new URL(url);
  const cached = robotsCache.get(u.origin);
  let rules = cached && cached.expires > Date.now() ? cached.rules : null;
  if (!rules) {
    try {
      const res = await rawFetch(`${u.origin}/robots.txt`, { timeoutMs: 5000, accept: "text/plain" });
      if (res.status >= 200 && res.status < 300) rules = parseRobots(res.body);
      else if (res.status >= 400 && res.status < 500) rules = []; // no robots.txt: allowed
      else rules = [{ allow: false, path: "/" }]; // server error: treat as disallowed for now
    } catch (err) {
      if (err.code === "PRIVATE_HOST" || err.code === "BAD_PROTOCOL") throw err;
      rules = [{ allow: false, path: "/" }];
    }
    robotsCache.set(u.origin, { rules, expires: Date.now() + 60 * 60 * 1000 });
  }
  return isAllowedByRobots(rules, u.pathname + u.search);
}

// --- public API -------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetches a source page politely. Returns { status, url, body, headers }.
 * Throws FetchError with code ROBOTS_DISALLOWED when robots.txt forbids it.
 */
export async function politeFetch(url, { retries = 2, baseDelayMs = 1000, timeoutMs, accept } = {}) {
  if (!(await robotsAllows(url))) {
    throw new FetchError("robots.txt disallows fetching this URL", { code: "ROBOTS_DISALLOWED" });
  }
  let attempt = 0;
  for (;;) {
    try {
      const res = await rawFetch(url, { timeoutMs, ...(accept ? { accept } : {}) });
      if ((res.status >= 500 || res.status === 429) && attempt < retries) throw new FetchError(`HTTP ${res.status}`, { status: res.status, retryable: true });
      return res;
    } catch (err) {
      if (!err.retryable || attempt >= retries) throw err;
      const delay = baseDelayMs * 2 ** attempt;
      log.warn("fetch retry", { url, attempt: attempt + 1, delay, error: err.message });
      await sleep(delay);
      attempt++;
    }
  }
}

export { isPrivateIp };
