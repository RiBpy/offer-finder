// Runs one revalidation batch and records it for the admin dashboard.

import { revalidateBatch } from "./revalidate.js";
import { log } from "../log.js";

export async function runRevalidation(db, { trigger, limit = 20 }) {
  const startedAt = new Date();
  const result = await revalidateBatch(db, { limit });
  await db.collection("jobs").insertOne({ type: "revalidate_batch", trigger, status: "succeeded", result, createdAt: startedAt, finishedAt: new Date() });
  log.info("revalidation batch", { trigger, ...result });
  return result;
}
