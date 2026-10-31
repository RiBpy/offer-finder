// One-off: sets `audience` (men / women / kids; empty = everyone) on offers
// published before the field existed, from the words in each offer.
// Usage: node --env-file=.env.local scripts/backfill-audience.js
import { getDb, closeDb } from "../src/lib/db/mongo.js";
import { inferAudience } from "../src/lib/text.js";

const db = await getDb();
try {
  const offers = db.collection("offers");
  const counts = { updated: 0, men: 0, women: 0, kids: 0 };
  for await (const o of offers.find({ audience: { $exists: false } }, { projection: { title: 1, description: 1, terms: 1, businessName: 1 } })) {
    const audience = inferAudience([o.title, o.description, o.terms, o.businessName].join(" "));
    await offers.updateOne({ _id: o._id }, { $set: { audience } });
    counts.updated++;
    for (const a of audience) counts[a]++;
  }
  console.log(`Offers updated: ${counts.updated} (men ${counts.men}, women ${counts.women}, kids ${counts.kids}; the rest are for everyone).`);
} finally {
  await closeDb();
}
