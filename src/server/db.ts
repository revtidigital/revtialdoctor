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

export async function getDb(): Promise<Db> {
  const c = getClient();
  await c.connect();
  return c.db();
}
