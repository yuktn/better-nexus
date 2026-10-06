"use client";

import { useEffect, useState } from "react";
import { HeartbeatSchema, type Heartbeat } from "@better-nexus/shared";
import { z } from "zod";
import type { DashboardSnapshot } from "@/lib/nexus";
import HeroNavbar, { type HeroStatus } from "./HeroNavbar";
import ConnectedAgentCard from "./ConnectedAgentCard";

const statusChangeSchema = z.object({
  agentId: z.uuidv4(),
  newStatus: z.enum(["UP", "DEGRADED", "DOWN"]),
  timestamp: z.union([z.number().int(), z.iso.datetime().transform((value) => Date.parse(value))]),
});
const cardStatuses = { UP: "up", DEGRADED: "degraded", DOWN: "down" } as const;
const eventSchema = HeartbeatSchema.extend({
  agentId: z.uuidv4(),
  timestamp: z.union([z.number().int(), z.iso.datetime().transform((value) => Date.parse(value))]),
});

export default function LiveDashboard({ initialSnapshot, initialFailed }: {
  initialSnapshot: DashboardSnapshot;
  initialFailed: boolean;
}) {
  const [cards, setCards] = useState(initialSnapshot.cards);
  const [failed, setFailed] = useState(initialFailed);
  const [connection, setConnection] = useState<"connecting" | "live" | "reconnecting">("connecting");
  const [statuses, setStatuses] = useState<Record<string, z.infer<typeof statusChangeSchema>>>({});
  const [liveHistory, setLiveHistory] = useState<Record<string, Heartbeat[]>>({});

  useEffect(() => {
    const events = new EventSource("/api/events");
    const controller = new AbortController();
    let syncing = false;
    let retrySnapshot = false;
    const knownAgents = new Set(initialSnapshot.cards.map((card) => card.agent.agentId));

    const syncSnapshot = async () => {
      if (syncing || controller.signal.aborted) return;
      syncing = true;
      try {
        const response = await fetch("/api/agents", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Snapshot unavailable");
        const snapshot: DashboardSnapshot = await response.json();
        if (controller.signal.aborted) return;
        knownAgents.clear();
        snapshot.cards.forEach((card) => knownAgents.add(card.agent.agentId));
        setCards((current) => snapshot.cards.map((card) => {
          const existing = current.find((item) => item.agent.agentId === card.agent.agentId);
          // Heartbeats received during the fetch must not be overwritten by older data.
          if (existing && (existing.latestHeartbeat?.timestamp ?? 0) > (card.latestHeartbeat?.timestamp ?? 0)) {
            return { ...card, latestHeartbeat: existing.latestHeartbeat, telemetryFailed: false, agent: { ...card.agent, lastSeenOn: Math.max(card.agent.lastSeenOn, existing.agent.lastSeenOn) } };
          }
          return card;
        }));
        setFailed(false);
        retrySnapshot = false;
      } catch {
        if (!controller.signal.aborted) {
          setFailed(true);
          retrySnapshot = true;
        }
      } finally {
        syncing = false;
      }
    };

    events.onopen = () => {
      setConnection("live");
      void syncSnapshot();
    };
    events.onerror = () => setConnection("reconnecting");
    events.addEventListener("heartbeat", (event) => {
      let parsed;
      try { parsed = eventSchema.safeParse(JSON.parse((event as MessageEvent).data)); } catch { return; }
      if (!parsed.success) return;
      const { agentId, ...heartbeat } = parsed.data;
      const receivedAt = Date.now();
      setCards((current) => current.map((card) => card.agent.agentId !== agentId ? card : {
        ...card,
        agent: { ...card.agent, lastSeenOn: receivedAt },
        latestHeartbeat: heartbeat.timestamp >= (card.latestHeartbeat?.timestamp ?? 0) ? heartbeat : card.latestHeartbeat,
        telemetryFailed: false,
      }));
      setLiveHistory((current) => ({
        ...current,
        [agentId]: [...(current[agentId] ?? []).filter((sample) => sample.timestamp !== heartbeat.timestamp), heartbeat]
          .sort((a, b) => a.timestamp - b.timestamp).slice(-120),
      }));
      if (!knownAgents.has(agentId)) void syncSnapshot();
    });

    events.addEventListener("statusChange", (event) => {
      let parsed;
      try { parsed = statusChangeSchema.safeParse(JSON.parse((event as MessageEvent).data)); } catch { return; }
      if (!parsed.success) return;
      const change = parsed.data;
      setStatuses((current) => {
        const previous = current[change.agentId];
        if (previous && previous.timestamp > change.timestamp) return current;
        return { ...current, [change.agentId]: change };
      });
      if (!knownAgents.has(change.agentId)) void syncSnapshot();
    });

    // Retry failed snapshots only; agent health is owned by the server.
    const retryTimer = setInterval(() => {
      if (retrySnapshot) void syncSnapshot();
    }, 5_000);
    return () => {
      controller.abort();
      events.close();
      clearInterval(retryTimer);
    };
  }, [initialSnapshot]);

  const getStatus = (agent: DashboardSnapshot["cards"][number]["agent"]) =>
    statuses[agent.agentId]?.newStatus ?? agent.status;
  const downCount = cards.filter((card) => getStatus(card.agent) === "DOWN").length;
  const health: HeroStatus = cards.length > 0 && downCount === cards.length
    ? "critical"
    : downCount > 0 || cards.some((card) => getStatus(card.agent) === "DEGRADED")
      ? "partial"
      : failed || cards.some((card) => !getStatus(card.agent))
        ? "unknown" : "operational";

  return (
    <>
      <HeroNavbar status={health} />
      <div className="flex w-full flex-col items-center gap-6 text-left sm:items-start">
        <div className="flex w-full flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
          <p role="status">{connection === "live" ? (failed ? "Connected · snapshot unavailable" : "Live") : connection === "connecting" ? "Connecting to live updates…" : "Reconnecting · showing last received data"}</p>
          <a href="/" className="text-nexus-blue underline underline-offset-4">Refresh data</a>
        </div>
        {cards.length === 0 ? (
          <p role="status" className="w-full rounded-2xl border border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800">{failed ? "Unable to load agents. Retrying the connection." : "No agents registered yet."}</p>
        ) : cards.map(({ agent, latestHeartbeat }) => (
          <ConnectedAgentCard key={agent.agentId} agent={agent} status={getStatus(agent) ? cardStatuses[getStatus(agent)!] : "unknown"} latestHeartbeat={latestHeartbeat} liveHistory={liveHistory[agent.agentId]} />
        ))}
      </div>
    </>
  );
}
