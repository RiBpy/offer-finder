import { MongoClient } from "mongodb";
import { ensureCollections } from "./setup.js";
import { log } from "../log.js";

// One client per server process. In development Next.js reloads modules, so the
// promise is cached on globalThis to avoid opening a new pool on every reload.
const g = globalThis;

function getConfig() {
  // Dashboards often keep surrounding whitespace or quotes from a paste.
  const uri = process.env.MONGODB_URI?.trim().replace(/^(["'])(.*)\1$/s, "$2");
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
    let client;
    try {
      client = new MongoClient(uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 8000,
        appName: "offer-finder",
      });
    } catch (err) {
      // Show the URI's structure with letters and digits masked, never the secret itself.
      log.error("MONGODB_URI could not be parsed", { shape: JSON.stringify(uri.replace(/[A-Za-z0-9]/g, "x")), length: uri.length });
      throw err;
    }
    const entry = { uri, setup: new Map() };
    // Drop a failed connection so the next request retries instead of reusing the rejection.
    entry.promise = client.connect().catch((err) => {
      if (g.__offerFinderMongo === entry) g.__offerFinderMongo = undefined;
      throw err;
    });
    g.__offerFinderMongo = entry;
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
