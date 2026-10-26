import { MongoClient } from "mongodb";
import { ensureCollections } from "./setup.js";

// One client per server process. In development Next.js reloads modules, so the
// promise is cached on globalThis to avoid opening a new pool on every reload.
const g = globalThis;

function getConfig() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    const err = new Error("MONGODB_URI is not configured");
    err.code = "DB_NOT_CONFIGURED";
    throw err;
  }
  return { uri, dbName: process.env.MONGODB_DB || "offer_finder" };
}

export async function getDb() {
  const { uri, dbName } = getConfig();
  if (!g.__offerFinderMongo || g.__offerFinderMongo.uri !== uri) {
    const client = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 8000,
      appName: "offer-finder",
    });
    g.__offerFinderMongo = { uri, promise: client.connect(), setup: new Map() };
  }
  const client = await g.__offerFinderMongo.promise;
  const db = client.db(dbName);
  // Create validators and indexes once per process and database.
  const setup = g.__offerFinderMongo.setup;
  if (!setup.has(dbName)) {
    setup.set(
      dbName,
      ensureCollections(db).catch((err) => {
        setup.delete(dbName);
        throw err;
      }),
    );
  }
  await setup.get(dbName);
  return db;
}

export async function closeDb() {
  if (g.__offerFinderMongo) {
    const client = await g.__offerFinderMongo.promise;
    await client.close();
    g.__offerFinderMongo = undefined;
  }
}
