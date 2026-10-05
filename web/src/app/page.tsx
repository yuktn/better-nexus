import HeroNavbar, { type HeroStatus } from "@/app/components/HeroNavbar";
import ConnectedAgentCard from "@/app/components/ConnectedAgentCard";
import { getAgents, getLatestHeartbeat } from "@/lib/nexus";

// Agents send every three seconds; allow a short interruption.
const STALE_AFTER_MS = 30_000;

export default async function Home() {
  let agents: Awaited<ReturnType<typeof getAgents>> = [];
  let failed = false;
  try {
    agents = await getAgents();
  } catch {
    failed = true;
  }

  const snapshotAt = Date.now();
  const cards = await Promise.all(agents.map(async (agent) => {
    const status = snapshotAt - agent.lastSeenOn <= STALE_AFTER_MS ? "up" : "down";
    try {
      return { agent, status, latestHeartbeat: await getLatestHeartbeat(agent.agentId), telemetryFailed: false } as const;
    } catch {
      return { agent, status, latestHeartbeat: null, telemetryFailed: true } as const;
    }
  }));
  const downCount = cards.filter((card) => card.status === "down").length;
  const health: HeroStatus = failed || (cards.length > 0 && downCount === cards.length)
    ? "critical"
    : downCount > 0 || cards.some((card) => card.telemetryFailed)
      ? "partial"
      : "operational";

  return (
    <div className="flex min-h-[120svh] flex-1 flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-5xl flex-1 flex-col items-center px-6 pb-16 dark:bg-black sm:px-16">
        <HeroNavbar status={health} />
        <div className="flex w-full flex-col items-center gap-6 text-left sm:items-start">
          <div className="flex w-full flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
            <p>Snapshot · {new Date(snapshotAt).toISOString().replace("T", " ").slice(0, 19)} UTC</p>
            <a href="/" className="text-nexus-blue underline underline-offset-4">Refresh data</a>
          </div>
          {failed ? (
            <p role="status" className="w-full rounded-2xl border border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800">Unable to load agents. Check the Nexus server connection and refresh.</p>
          ) : cards.length === 0 ? (
            <p className="w-full rounded-2xl border border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800">No agents registered yet.</p>
          ) : cards.map(({ agent, status, latestHeartbeat }) => (
            <ConnectedAgentCard key={agent.agentId} agent={agent} status={status} latestHeartbeat={latestHeartbeat} />
          ))}
        </div>
      </main>
    </div>
  );
}
