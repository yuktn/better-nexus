import "server-only";
import { AgentSchema, HeartbeatSchema } from "@better-nexus/shared";
import { z } from "zod";

// /agents omits the private sourceIP and ipType fields.
const agentListSchema = z.object({
  success: z.literal(true),
  data: z.array(AgentSchema.pick({
    agentId: true, agentName: true, agentNexusVersion: true,
    platform: true, registeredOn: true, lastSeenOn: true,
  })),
});
const heartbeatListSchema = z.object({ success: z.literal(true), data: z.array(HeartbeatSchema) });

async function request(path: string) {
  const base = process.env.NEXUS_SERVER_URL;
  if (!base) throw new Error("NEXUS_SERVER_URL is not configured.");
  const url = new URL(`${base.replace(/\/$/, "")}/${path}`);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("NEXUS_SERVER_URL must use HTTP or HTTPS.");
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Nexus request failed (${response.status}).`);
  return response.json();
}

export async function getAgents() {
  return agentListSchema.parse(await request("agents")).data;
}

export async function getLatestHeartbeat(agentId: string) {
  return heartbeatListSchema.parse(await request(`hb/${encodeURIComponent(agentId)}?hbCountCap=1`)).data[0] ?? null;
}

export async function getHistory(agentId: string, range: "1M" | "1H" | "1D" | "1W") {
  return heartbeatListSchema.parse(await request(`hb/${encodeURIComponent(agentId)}?range=${range}`)).data;
}
