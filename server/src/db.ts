import { MongoClient } from "mongodb";
import type { Agent, Heartbeat } from "@better-nexus/shared";

const uri =
  process.env.MONGODB_URI ??
  "mongodb://localhost:27017";

const client = new MongoClient(uri);

const db = client.db("better-nexus");

export const agents = db.collection<Agent>("agents");

export const heartbeats = db.collection<Heartbeat>("heartbeats");

export async function initDb() {
  await client.connect();

  await db.command({ ping: 1 });

  await agents.createIndex(
    { agentId: 1 },
    { unique: true }
  );
  
  await heartbeats.createIndex({
    agentId: 1,
    timestamp: -1,
  });

  console.log("Connected to MongoDB");
}