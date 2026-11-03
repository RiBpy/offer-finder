// Learning data for a future rule-based reader: every page the AI reads is kept
// with the offers it found, so rules can later be built and compared against
// the AI before they replace it. Nothing here affects published offers.
//
// One document per AI read in `learning_samples`. The page text is gzipped
// (about 4-5x smaller) and documents expire after 60 days (TTL index in
// db/setup.js), so the collection stays at a few tens of MB.

import { gzipSync, gunzipSync } from "node:zlib";
import { log } from "../log.js";

export const LEARNING_TTL_DAYS = 60;

/** Saves one AI read. Never throws: a failure here must not stop discovery. */
export async function saveLearningSample(db, { item, page, offers, model, now }) {
  try {
    await db.collection("learning_samples").insertOne({
      url: page.url,
      itemUrl: item.url,
      sourceName: item.sourceName || page.siteName || null,
      sourceType: item.sourceType || null,
      adapter: item.adapter || null,
      note: item.note || null,
      category: item.category || null,
      title: page.title || null,
      publishedAt: page.publishedAt || null,
      // Banner images (Daraz) are read by the AI but not kept; rules cannot read them.
      imageCount: page.images?.length ?? 0,
      textLength: page.text?.length ?? 0,
      textGz: gzipSync(page.text || ""),
      aiOffers: offers,
      model: model || null,
      createdAt: now,
    });
  } catch (err) {
    log.warn("learning sample not saved", { url: page.url, error: err.message });
  }
}

/** The page text of a saved sample. */
export function sampleText(sample) {
  return sample.textGz ? gunzipSync(sample.textGz.buffer ?? sample.textGz).toString("utf8") : "";
}
