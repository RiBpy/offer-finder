// Runs automatic offer discovery from the command line, without the time
// limits of a serverless function.
// Usage: npm run discover                 (collect sources when due, read up to 40 pages)
//        npm run discover -- --force      (re-check every source now)
//        npm run discover -- --max 100    (read up to 100 pages)
import { getDb, closeDb } from "../src/lib/db/mongo.js";
import { runDiscovery } from "../src/lib/discovery/run.js";
import { aiModel, aiProvider } from "../src/lib/discovery/ai-extract.js";

const args = process.argv.slice(2);
const maxIdx = args.indexOf("--max");
const maxItems = maxIdx >= 0 ? Number(args[maxIdx + 1]) || 40 : 40;

// Overloaded or rate-limited AI service: the free Gemini tier often answers 503
// "high demand" for a minute or two, so wait and carry on with the batch.
const TEMPORARY_AI_STATUS = new Set([429, 500, 502, 503, 504]);
const PAUSES_MS = [60_000, 120_000, 240_000];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const db = await getDb();
try {
  const total = { processed: 0, unchanged: 0, failed: 0, published: 0, held: 0, duplicates: 0, inputTokens: 0, outputTokens: 0 };
  let processed;
  for (let attempt = 0; ; attempt++) {
    const run = await runDiscovery(db, {
      trigger: "cli",
      budgetMs: 30 * 60 * 1000,
      maxItems: maxItems - total.processed,
      forceCollect: attempt === 0 && args.includes("--force"),
    });
    if (attempt === 0) {
      const { collected } = run;
      console.log(`Sources checked: ${collected.sources}, new pages queued: ${collected.queued}, listed offers refreshed: ${collected.refreshed}`);
      for (const e of collected.errors) console.log(`  source error: ${e}`);
    }
    processed = run.processed;
    for (const k of Object.keys(total)) total[k] += processed[k] || 0;

    const temporary = processed.aiError && TEMPORARY_AI_STATUS.has(processed.aiStatus);
    if (!temporary || total.processed >= maxItems || attempt >= PAUSES_MS.length) break;
    console.log(`The ${aiProvider()} API is busy (HTTP ${processed.aiStatus}); retrying in ${PAUSES_MS[attempt] / 1000} s.`);
    await sleep(PAUSES_MS[attempt]);
  }

  console.log(
    `Pages read: ${total.processed} (failed ${total.failed}), unchanged and skipped: ${total.unchanged}. Offers published: ${total.published}, held back: ${total.held}, duplicates: ${total.duplicates}.`,
  );
  console.log(`AI (${aiProvider()} / ${aiModel()}) tokens: ${total.inputTokens} in / ${total.outputTokens} out. Pages still queued: ${processed.queued}`);
  if (processed.aiError) {
    if (TEMPORARY_AI_STATUS.has(processed.aiStatus)) {
      // Not a setup problem: the remaining pages stay queued for the next run.
      console.log(`\nStopped early: the ${aiProvider()} API is still busy (HTTP ${processed.aiStatus}). The next run continues.`);
    } else {
      console.log(`\nSTOPPED: the ${aiProvider()} API rejected the request: ${processed.aiError}`);
      process.exitCode = 1;
    }
  }
} finally {
  await closeDb();
}
