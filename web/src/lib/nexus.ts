import "server-only";
import { AgentSchema, HeartbeatSchema } from "@better-nexus/shared";
import { z } from "zod";
import { incidentsSchema } from "./incidents";

// /agents omits the private sourceIP and ipType fields.
const agentListSchema = z.object({
  success: z.literal(true),
  data: z.array(AgentSchema.pick({
    agentId: true, agentName: true, agentNexusVersion: true,
    platform: true, registeredOn: true, lastSeenOn: true,
  }).extend({ status: z.enum(["UP", "DEGRADED", "DOWN"]).optional() })),
});
const heartbeatListSchema = z.object({ success: z.literal(true), data: z.array(HeartbeatSchema) });

export function nexusUrl(path: string) {
  const variable = process.env.NODE_ENV === "development" ? "DEV_NEXUS_SERVER_URL" : "NEXUS_SERVER_URL";
  const base = process.env[variable];
  if (!base) throw new Error(`${variable} is not configured.`);
  const url = new URL(`${base.replace(/\/$/, "")}/${path}`);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error(`${variable} must use HTTP or HTTPS.`);
  return url;
}

async function request(path: string) {
  const response = await fetch(nexusUrl(path), { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Nexus request failed (${response.status}).`);
  return response.json();
}

export async function getAgents() {
  return agentListSchema.parse(await request("agents")).data;
}

export async function getIncidents(batch?: number, page?: number, status?: "open" | "resolved") {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (batch !== undefined) params.set("batch", String(batch));
  if (page !== undefined) params.set("page", String(page));
  return z.object({ success: z.literal(true), data: incidentsSchema }).parse(await request(`incidents?${params}`)).data;
}

export async function getLatestHeartbeat(agentId: string) {
  return heartbeatListSchema.parse(await request(`hb/${encodeURIComponent(agentId)}?hbCountCap=1`)).data[0] ?? null;
}

export async function getHistory(agentId: string, range: "1M" | "1H" | "1D" | "1W") {
  return heartbeatListSchema.parse(await request(`hb/${encodeURIComponent(agentId)}?range=${range}`)).data;
}

export async function getDashboardSnapshot() {
  const agents = await getAgents();
  const cards = await Promise.all(agents.map(async (agent) => {
    try {
      return { agent, latestHeartbeat: await getLatestHeartbeat(agent.agentId), telemetryFailed: false };
    } catch {
      return { agent, latestHeartbeat: null, telemetryFailed: true };
    }
  }));
  return { cards, snapshotAt: Date.now() };
}

export type DashboardSnapshot = Awaited<ReturnType<typeof getDashboardSnapshot>>;
