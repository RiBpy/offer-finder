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

const db = await getDb();
try {
  const { collected, processed } = await runDiscovery(db, {
    trigger: "cli",
    budgetMs: 30 * 60 * 1000,
    maxItems,
    forceCollect: args.includes("--force"),
  });
  console.log(`Sources checked: ${collected.sources}, new pages queued: ${collected.queued}, listed offers refreshed: ${collected.refreshed}`);
  for (const e of collected.errors) console.log(`  source error: ${e}`);
  console.log(
    `Pages read: ${processed.processed} (failed ${processed.failed}). Offers published: ${processed.published}, held back: ${processed.held}, duplicates: ${processed.duplicates}.`,
  );
  console.log(`AI (${aiProvider()} / ${aiModel()}) tokens: ${processed.inputTokens} in / ${processed.outputTokens} out. Pages still queued: ${processed.queued}`);
  if (processed.aiError) {
    console.log(`\nSTOPPED: the ${aiProvider()} API rejected the request: ${processed.aiError}`);
    process.exitCode = 1;
  }
} finally {
  await closeDb();
}
