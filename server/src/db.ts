import { MongoClient } from "mongodb";
import type { Agent, HeartbeatDocument, AgentDocument } from "@better-nexus/shared";

const uri =
  process.env.MONGODB_URI ??
  "mongodb://localhost:27017";

const client = new MongoClient(uri);

const db = client.db("better-nexus");

export const agents = db.collection<AgentDocument>("agents");

export const heartbeats = db.collection<HeartbeatDocument>("heartbeats");

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