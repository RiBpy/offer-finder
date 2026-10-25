// Creates collections, the schema validator and indexes. Safe to run repeatedly.
// Usage: npm run db:init   (reads MONGODB_URI / MONGODB_DB from .env.local)
import { getDb, closeDb } from "../src/lib/db/mongo.js";

const db = await getDb();
const indexes = await db.collection("offers").indexes();
console.log(`Database "${db.databaseName}" ready. Offer indexes: ${indexes.map((i) => i.name).join(", ")}`);
await closeDb();
