import { MongoClient } from "mongodb";
import { type Agent, type HeartbeatDocument, type AgentDocument, type EnrollmentToken, type AgentStatusChange, type Incident } from "@better-nexus/shared";

const uri =
  process.env.MONGODB_URI ??
  "mongodb://localhost:27017";

const client = new MongoClient(uri);

const db = client.db(process.env.NODE_ENV === "development" ? "better-nexus-dev" : "better-nexus");

export const agents = db.collection<AgentDocument>("agents");

export const heartbeats = db.collection<HeartbeatDocument>("heartbeats");

export const enrollmentTokens = db.collection<EnrollmentToken>("enrollmenttokens")

export const agentStatusChanges = db.collection<AgentStatusChange>("agentStatusChanges")

export const incidents = db.collection<Incident>("incidents")

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

  await heartbeats.createIndex(
  { timestamp: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 7 }
);
  
  await enrollmentTokens.createIndex(
    { hashedEnrollmentToken: 1 },
    { unique: true }
  );

  await enrollmentTokens.createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 }
  );

  await incidents.createIndex(
    { startedAt: -1, incidentId: -1 }
  );

  console.log("Connected to MongoDB");
}
