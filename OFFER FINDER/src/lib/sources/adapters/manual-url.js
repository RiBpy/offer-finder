// Adapter for a single URL submitted by an administrator. It fetches the page
// (respecting robots.txt) and returns extracted candidate fields for the admin
// to confirm. It never publishes anything by itself.

import { extractFromHtml } from "../../extract/html.js";
import { politeFetch } from "../fetcher.js";

export const manualUrlAdapter = {
  id: "manual-url",
  label: "Administrator-submitted URL",
  // What this adapter is allowed to do; shown in the admin UI.
  description: "Fetches one public page an administrator submitted, if robots.txt allows it.",

  async fetchCandidate(url) {
    const res = await politeFetch(url);
    if (res.status >= 400) {
      const err = new Error(`Source returned HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    const contentType = res.headers.get("content-type") || "";
    if (!/html|xml/i.test(contentType)) {
      const err = new Error(`Unsupported content type: ${contentType || "unknown"}`);
      err.status = res.status;
      throw err;
    }
    return { finalUrl: res.url, status: res.status, extracted: extractFromHtml(res.body, res.url) };
  },
};
