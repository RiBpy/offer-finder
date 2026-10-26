// Registry of source adapters. Each adapter is independent so new providers
// (RSS feeds, affiliate networks, authorised social APIs) can be added in
// Phase 2 without touching the rest of the system.
//
// Adapter contract:
//   id: string, label: string, description: string
//   fetchCandidate(url) -> { finalUrl, status, extracted }      (single URL adapters)
//   discover?(config)   -> AsyncIterable<{ sourceOfferId, fields }> (feed adapters, Phase 2)

import { manualUrlAdapter } from "./adapters/manual-url.js";

const adapters = new Map([[manualUrlAdapter.id, manualUrlAdapter]]);

export function getAdapter(id) {
  return adapters.get(id) ?? null;
}

export function listAdapters() {
  return [...adapters.values()].map(({ id, label, description }) => ({ id, label, description }));
}
