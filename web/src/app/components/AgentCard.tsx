"use client";

import { useEffect, useId, useState } from "react";
import type { Agent, Heartbeat } from "@better-nexus/shared";

const metrics = ["cpu", "memory", "temp"] as const;
type Metric = (typeof metrics)[number];
export type AgentTimeRange = "1M" | "1H" | "1D" | "1W";

const ranges: Record<AgentTimeRange, number> = {
  "1M": 60_000,
  "1H": 3_600_000,
  "1D": 86_400_000,
  "1W": 604_800_000,
};
const labels: Record<Metric, string> = { cpu: "CPU", memory: "MEM", temp: "TEMP" };
const EMPTY_HISTORY: readonly Heartbeat[] = [];

// Fixed sample data keeps the design preview identical across server and client.
const DEMO_AGENT = {
  agentId: "00000000-0000-4000-8000-000000000001",
  agentName: "nexus-node-01",
  agentNexusVersion: "0.1.0",
};
const DEMO_LATEST: Heartbeat = {
  cpu: 14,
  memory: 27,
  temp: 43,
  timestamp: Date.UTC(2026, 9, 5, 12),
};
const DEMO_HISTORY = Object.fromEntries(
  Object.entries(ranges).map(([range, duration], rangeIndex) => [
    range,
    Array.from({ length: 61 }, (_, index): Heartbeat => {
      const wave = Math.sin(index * 0.43 + rangeIndex) * Math.sin((60 - index) * 0.17);
      const spike = Math.exp(-((index - 36) ** 2) / 30);
      return {
        timestamp: DEMO_LATEST.timestamp - duration + (index / 60) * duration,
        cpu: index === 60 ? 14 : 14 + wave * 9 + spike * 32,
        memory: index === 60 ? 27 : 27 + wave * 3 + spike * 7,
        temp: index === 60 ? 43 : 43 + wave * 4 + spike * 9,
      };
    }),
  ]),
) as Record<AgentTimeRange, Heartbeat[]>;

export type AgentHistoryRequest = {
  agentId: string;
  range: AgentTimeRange;
  from: number;
  to: number;
  signal: AbortSignal;
};

export type AgentCardProps = {
  /** Omit all data props to display a labeled design preview. */
  agent?: Pick<Agent, "agentId" | "agentName" | "agentNexusVersion">;
  status?: "up" | "down" | "unknown";
  /** Update this prop as new live heartbeats arrive. */
  latestHeartbeat?: Heartbeat | null;
  /** Raw or server-downsampled samples, with timestamps in milliseconds. */
  history?: readonly Heartbeat[];
  /** Optional loader for the complete selected window. Keep its reference stable. */
  loadHistory?: (request: AgentHistoryRequest) => Promise<readonly Heartbeat[]>;
};

function formatValue(value: number | undefined, metric: Metric) {
  return value !== undefined && Number.isFinite(value)
    ? `${Math.round(value)}${metric === "temp" ? "°C" : "%"}`
    : "—";
}

function HistoryGraph({ samples, metric, from, to }: {
  samples: readonly Heartbeat[];
  metric: Metric;
  from: number;
  to: number;
}) {
  const points = samples
    .filter((sample) => Number.isFinite(sample.timestamp) && Number.isFinite(sample[metric]) && sample.timestamp >= from && sample.timestamp <= to)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (points.length === 0) {
    return <div className="flex h-72 items-center justify-center text-sm text-zinc-500 sm:h-80">No history in this range.</div>;
  }

  const min = metric === "temp" ? points.reduce((lowest, point) => Math.min(lowest, Math.floor(point.temp / 10) * 10), 0) : 0;
  const max = metric === "temp" ? points.reduce((highest, point) => Math.max(highest, Math.ceil(point.temp / 10) * 10), 50) : 100;
  const x = (timestamp: number) => 52 + ((timestamp - from) / (to - from)) * 824;
  const y = (value: number) => 260 - ((value - min) / (max - min)) * 240;
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(point.timestamp)},${y(point[metric])}`).join(" ");
  const timeLabel = (timestamp: number) => {
    const date = new Date(timestamp);
    return to - from >= ranges["1D"]
      ? date.toISOString().slice(5, 16).replace("T", " ")
      : date.toISOString().slice(11, to - from <= ranges["1M"] ? 19 : 16);
  };

  return (
    <div className="overflow-x-auto">
      <svg viewBox="0 0 900 300" role="img" aria-label={`${labels[metric]} history, ${points.length} samples. Times in UTC.`} className="h-72 w-full min-w-[480px] sm:h-80">
        <title>{`${labels[metric]} history`}</title>
        <desc>{points.length} samples from {new Date(from).toISOString()} to {new Date(to).toISOString()}. Latest plotted value: {formatValue(points[points.length - 1][metric], metric)}.</desc>
        {[0, 0.5, 1].map((fraction) => (
          <g key={fraction}>
            <line x1="52" x2="876" y1={20 + fraction * 240} y2={20 + fraction * 240} stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" />
            <text x="40" y={24 + fraction * 240} textAnchor="end" fill="currentColor" className="text-[11px] text-zinc-500">{Math.round(max - fraction * (max - min))}{metric === "temp" ? "°" : "%"}</text>
          </g>
        ))}
        <path d={path} fill="none" stroke="var(--color-nexus-blue)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {points.length === 1 && <circle cx={x(points[0].timestamp)} cy={y(points[0][metric])} r="3" fill="var(--color-nexus-blue)" />}
        {[from, (from + to) / 2, to].map((timestamp, index) => (
          <text key={index} x={x(timestamp)} y="288" textAnchor={index === 0 ? "start" : index === 2 ? "end" : "middle"} fill="currentColor" className="text-[11px] text-zinc-500">{timeLabel(timestamp)}</text>
        ))}
      </svg>
    </div>
  );
}

export default function AgentCard(props: AgentCardProps = {}) {
  const isDemo = props.agent === undefined && props.status === undefined && props.latestHeartbeat === undefined && props.history === undefined && props.loadHistory === undefined;
  const agent = props.agent ?? (isDemo ? DEMO_AGENT : { agentId: "", agentName: "Unknown agent", agentNexusVersion: "unknown" });
  const status = props.status ?? (isDemo ? "up" : "unknown");
  const latestHeartbeat = isDemo ? DEMO_LATEST : props.latestHeartbeat;
  const loadHistory = props.loadHistory;
  const [expanded, setExpanded] = useState(false);
  const [metric, setMetric] = useState<Metric>("cpu");
  const [range, setRange] = useState<AgentTimeRange>("1M");
  const history = isDemo ? DEMO_HISTORY[range] : props.history ?? EMPTY_HISTORY;
  const [remote, setRemote] = useState<{
    agentId: string;
    range: AgentTimeRange;
    samples: readonly Heartbeat[];
    to: number;
    error: boolean;
  } | null>(null);
  const detailsId = useId();
  const titleId = useId();

  useEffect(() => {
    if (!expanded || !loadHistory) return;
    const controller = new AbortController();

    const refresh = async () => {
      const to = Date.now();
      try {
        const samples = await loadHistory({ agentId: agent.agentId, range, from: to - ranges[range], to, signal: controller.signal });
        if (!controller.signal.aborted) setRemote({ agentId: agent.agentId, range, samples, to, error: false });
      } catch {
        if (!controller.signal.aborted) setRemote({ agentId: agent.agentId, range, samples: [], to, error: true });
      }
    };

    void refresh();
    return () => {
      controller.abort();
    };
  }, [expanded, loadHistory, agent.agentId, range]);

  const result = remote?.agentId === agent.agentId && remote.range === range ? remote : null;
  const samples = loadHistory ? result?.samples ?? EMPTY_HISTORY : history;
  const newest = samples.reduce<Heartbeat | undefined>((latest, sample) => !latest || sample.timestamp > latest.timestamp ? sample : latest, undefined);
  const live = latestHeartbeat;
  const to = loadHistory ? result?.to ?? 0 : Math.max(latestHeartbeat?.timestamp ?? 0, newest?.timestamp ?? 0);
  const loading = Boolean(loadHistory && !result);
  const error = Boolean(loadHistory && result?.error);
  const statusLabel = status === "up" ? "UP" : status === "down" ? "DOWN" : "—";
  const choiceClass = (selected: boolean) => `border-b-2 px-2 py-2 text-xs font-semibold tracking-wider transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-nexus-blue motion-reduce:transition-none ${selected ? "border-nexus-blue text-nexus-blue" : "border-transparent text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-100"}`;

  return (
    <article aria-labelledby={titleId} aria-label={isDemo ? "Demo agent preview" : undefined} className="w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white text-zinc-950 dark:border-zinc-800 dark:bg-black dark:text-zinc-50">
      <div className={`relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 px-6 py-5 transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none sm:gap-x-8 sm:px-8 sm:py-6 ${expanded ? "grid-rows-[minmax(1.5rem,auto)_minmax(1.5rem,auto)_1.5rem]" : "grid-rows-[minmax(1.5rem,auto)_minmax(1.5rem,auto)_0rem]"}`}>
        <button type="button" aria-label={`${agent.agentName}: ${expanded ? "collapse" : "expand"} monitoring overview`} aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded(!expanded)} className="absolute inset-0 cursor-pointer transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-nexus-blue motion-reduce:transition-none dark:hover:bg-zinc-950" />
        <h2 id={titleId} className="pointer-events-none relative col-start-1 row-start-1 row-span-2 self-center break-words text-left text-3xl font-bold leading-none tracking-tighter sm:text-5xl">
          {agent.agentName}
        </h2>
        <div aria-hidden={!expanded} inert={!expanded} className={`relative col-start-1 row-start-3 flex min-h-0 min-w-0 items-center gap-2 overflow-hidden text-xs text-zinc-500 transition-opacity duration-300 motion-reduce:transition-none ${expanded ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          <span title={agent.agentId} className="min-w-0 truncate text-zinc-500"><span className="sr-only">Agent ID: </span>{agent.agentId}</span>
          <span className="shrink-0">v{agent.agentNexusVersion.replace(/^v/, "")}</span>
        </div>
        <span aria-hidden={expanded} className={`pointer-events-none absolute right-6 top-5 text-3xl font-black leading-none tracking-tighter transition-[translate,opacity] duration-300 ease-in-out motion-reduce:transition-none sm:right-8 sm:top-6 sm:text-5xl ${status === "up" ? "text-nexus-blue" : "text-zinc-500"} ${expanded ? "translate-y-12 opacity-0" : "translate-y-0 opacity-100"}`}>{statusLabel}</span>
        <dl aria-hidden={!expanded} className={`pointer-events-none relative col-start-2 row-start-1 row-span-3 grid grid-rows-subgrid text-lg leading-none transition-[translate,opacity] duration-300 ease-in-out motion-reduce:transition-none sm:text-xl ${expanded ? "translate-y-0 opacity-100" : "-translate-y-8 opacity-0"}`}>
          {metrics.map((item) => <div key={item} className="flex min-h-0 items-center justify-between gap-3 overflow-hidden sm:gap-6"><dt className="text-zinc-500">{labels[item]}</dt><dd className="text-right font-semibold tabular-nums text-nexus-blue">{formatValue(live?.[item], item)}</dd></div>)}
        </dl>
      </div>

      <div id={detailsId} inert={!expanded} aria-hidden={!expanded} className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out motion-reduce:transition-none ${expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="min-h-0 overflow-hidden">
          <div className="px-6 pb-4 sm:px-8 sm:pb-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-zinc-200 dark:border-zinc-800">
              <div role="group" aria-label="Telemetry metric" className="flex gap-2">
                {metrics.map((item) => <button key={item} type="button" aria-pressed={metric === item} onClick={() => setMetric(item)} className={choiceClass(metric === item)}>{labels[item]}</button>)}
              </div>
              <div role="group" aria-label="History time range" className="flex gap-2">
                {(Object.keys(ranges) as AgentTimeRange[]).map((item) => <button key={item} type="button" aria-label={{ "1M": "Last minute", "1H": "Last hour", "1D": "Last day", "1W": "Last week" }[item]} aria-pressed={range === item} onClick={() => setRange(item)} className={choiceClass(range === item)}>{item}</button>)}
              </div>
            </div>
            <div aria-busy={loading}>
              {loading || error ? <div role="status" className="flex h-72 items-center justify-center text-sm text-zinc-500 sm:h-80">{error ? "History unavailable. Reopen the card to retry." : "Loading history…"}</div> : <HistoryGraph samples={samples} metric={metric} from={to - ranges[range]} to={to} />}
            </div>
            <p className="mt-1 text-right text-[10px] tracking-wide text-zinc-400">{isDemo ? "DEMO DATA · UTC" : "UTC"}</p>
          </div>
        </div>
      </div>
    </article>
  );
}
