import { MongoClient } from "mongodb";
import { type Agent, type HeartbeatDocument, type AgentDocument, type EnrollmentToken } from "@better-nexus/shared";

const uri =
  process.env.MONGODB_URI ??
  "mongodb://localhost:27017";

const client = new MongoClient(uri);

const db = client.db("better-nexus");

export const agents = db.collection<AgentDocument>("agents");

export const heartbeats = db.collection<HeartbeatDocument>("heartbeats");

export const enrollmentTokens = db.collection<EnrollmentToken>("enrollmenttokens")

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
  
  await enrollmentTokens.createIndex(
    { hashedEnrollmentToken: 1 },
    { unique: true }
  );

  await enrollmentTokens.createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 }
  );

  console.log("Connected to MongoDB");
}