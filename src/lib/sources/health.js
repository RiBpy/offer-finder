// Tracks per-host fetch health for the admin "Source health" view.

export async function recordSourceResult(db, url, { ok, status = null, error = null, adapter = "manual-url", now = new Date() }) {
  let host;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return;
  }
  await db.collection("sources").updateOne(
    { host },
    {
      $set: {
        lastFetchedAt: now,
        lastStatus: status,
        lastError: ok ? null : error,
        lastOk: ok,
        adapter,
        ...(ok ? { lastSuccessAt: now, consecutiveFailures: 0 } : {}),
      },
      $inc: ok ? { successCount: 1 } : { failureCount: 1, consecutiveFailures: 1 },
      $setOnInsert: { host, createdAt: now },
    },
    { upsert: true },
  );
}

export async function listSources(db) {
  return db.collection("sources").find({}).sort({ lastFetchedAt: -1 }).limit(200).toArray();
}
