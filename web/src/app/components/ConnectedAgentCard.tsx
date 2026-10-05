"use client";

import { HeartbeatSchema } from "@better-nexus/shared";
import { z } from "zod";
import AgentCard, { type AgentCardProps, type AgentHistoryRequest } from "./AgentCard";

const historyResponse = z.object({ data: z.array(HeartbeatSchema) });

async function loadHistory({ agentId, range, signal }: AgentHistoryRequest) {
  const response = await fetch(`/api/agents/${encodeURIComponent(agentId)}/history?range=${range}`, { signal, cache: "no-store" });
  if (!response.ok) throw new Error("History unavailable.");
  return historyResponse.parse(await response.json()).data;
}

export default function ConnectedAgentCard(props: Pick<AgentCardProps, "agent" | "status" | "latestHeartbeat">) {
  return <AgentCard {...props} loadHistory={loadHistory} />;
}
