import { MongoClient, type Db } from "mongodb";

declare global {
  // preserve connection across hot-reloads in dev

  var _mongoClient: MongoClient | undefined;
}

let client: MongoClient;

function getClient(): MongoClient {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI environment variable is not set");

  if (globalThis._mongoClient) return globalThis._mongoClient;

  client = new MongoClient(uri, {
    connectTimeoutMS: 10_000,
    serverSelectionTimeoutMS: 10_000,
  });

  globalThis._mongoClient = client;
  return client;
}

let indexesEnsured = false;

async function ensureIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  indexesEnsured = true;
  await Promise.all([
    db.collection("users").createIndex({ contact: 1 }, { unique: true }),
    db.collection("users").createIndex({ userId: 1 }),
    db.collection("admin_logs").createIndex({ timestamp: -1 }),
    db.collection("rate_limits").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]).catch((err) => {
    indexesEnsured = false;
    console.error("Failed to ensure indexes", err);
  });
}

export async function getDb(): Promise<Db> {
  const c = getClient();
  await c.connect();
  const db = c.db();
  void ensureIndexes(db);
  return db;
}
