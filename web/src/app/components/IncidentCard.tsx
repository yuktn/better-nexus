"use client";

import { useId, useState, useSyncExternalStore } from "react";
import type { DashboardIncident } from "@/lib/incidents";

const subscribeToTimezone = () => () => {};
const serverTimezone = () => "UTC";
function clientTimezone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
  catch { return "UTC"; }
}

function IncidentEntry({ incident, name, formatTime }: {
  incident: DashboardIncident;
  name: string;
  formatTime: (value: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const color = incident.status === "resolved" ? "text-nexus-blue" : "text-nexus-red";
  const timeline = [
    ...incident.messages.map((entry, index) => ({ ...entry, key: `message-${index}` })),
    ...(incident.resolvedAt ? [{ message: "Incident resolved.", timestamp: incident.resolvedAt, key: "resolved" }] : []),
  ].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

  return (
    <li className="border-t border-zinc-200 dark:border-zinc-800">
      <button type="button" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-nexus-blue motion-reduce:transition-none dark:hover:bg-zinc-950 sm:px-8">
        <div className="min-w-0">
          <h3 className="break-words text-lg font-bold leading-tight tracking-tight sm:text-xl">{incident.title || "Incident"} <span className={color}>{incident.status === "resolved" ? "resolved" : "ongoing"}</span></h3>
          <p className="mt-1 text-xs text-zinc-500">{name} <span aria-hidden="true">·</span> <time dateTime={incident.startedAt}>{formatTime(incident.startedAt)}</time></p>
        </div>
      </button>
      <div id={detailsId} aria-hidden={!expanded} inert={!expanded}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out motion-reduce:transition-none ${expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="min-h-0 overflow-hidden">
          <div className="px-6 pb-5 pt-1 sm:px-8">
            <ol aria-label="Incident message timeline, newest first">
              {timeline.map((entry, index) => (
                <li key={entry.key} className="relative pb-5 pl-7 last:pb-0">
                  {index < timeline.length - 1 && <span aria-hidden="true" className="absolute -bottom-2 left-[5px] top-2 w-px bg-zinc-200 dark:bg-zinc-800" />}
                  <span aria-hidden="true" className={`absolute left-0 top-1.5 h-3 w-3 rounded-full border-2 border-current bg-white dark:bg-black ${entry.key === "resolved" ? "text-nexus-blue" : color}`} />
                  <p className="text-sm leading-relaxed">{entry.message}</p>
                  <time dateTime={entry.timestamp} className="mt-1 block text-xs tabular-nums text-zinc-500">{formatTime(entry.timestamp)}</time>
                </li>
              ))}
            </ol>
            {timeline.length === 0 && <p className="text-sm text-zinc-500">No messages recorded.</p>}
          </div>
        </div>
      </div>
    </li>
  );
}

export default function IncidentCard({ incidents, agents, loading, failed, countCap, hasMore, onShowMore }: {
  incidents: DashboardIncident[];
  agents: { agentId: string; agentName: string }[];
  loading: boolean;
  failed: boolean;
  countCap: number;
  hasMore: boolean;
  onShowMore: () => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const titleId = useId();
  const historyId = useId();
  const timeZone = useSyncExternalStore(subscribeToTimezone, clientTimezone, serverTimezone);
  const open = incidents.filter((incident) => incident.status === "open");
  const expanded = showHistory;
  const color = open.length === 0 ? "text-nexus-blue" : open.some((incident) => incident.severity === "DOWN") ? "text-nexus-red" : "text-nexus-yellow";
  // Keep the entire list mounted so closing can animate without replacing it.
  const visible = incidents.slice().sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt) || b.incidentId.localeCompare(a.incidentId)).slice(0, countCap);
  const names = new Map(agents.map((agent) => [agent.agentId, agent.agentName]));
  const formatter = new Intl.DateTimeFormat("en-GB", { timeZone, dateStyle: "medium", timeStyle: "short" });
  const formatTime = (value: string) => formatter.format(new Date(value));

  return (
    <article aria-labelledby={titleId} className="w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white text-zinc-950 dark:border-zinc-800 dark:bg-black dark:text-zinc-50">
      <button type="button" aria-expanded={expanded} aria-controls={historyId} aria-label={showHistory ? "Hide incident history" : "Show all incident history"}
        onClick={() => setShowHistory(!showHistory)}
        className="flex w-full items-center justify-between gap-4 px-6 py-3 text-left transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-nexus-blue motion-reduce:transition-none dark:hover:bg-zinc-950 sm:px-8 sm:py-4">
        <h2 id={titleId} className="text-2xl font-bold leading-none tracking-tighter sm:text-3xl">Incidents</h2>
        <div className="flex items-center gap-3 sm:gap-5">
          {open.length > 0 && <span className={`text-lg font-black leading-none tracking-tight sm:text-2xl ${color}`}>{open.length} ongoing</span>}
        </div>
      </button>
      {failed && <p role="status" className="px-6 pb-3 text-xs text-zinc-500 sm:px-8">Incidents unavailable. Retrying; showing last received data.</p>}
      <div id={historyId} aria-hidden={!expanded} inert={!expanded} aria-busy={loading}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out motion-reduce:transition-none ${expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="min-h-0 overflow-hidden">
          {visible.length === 0 ? <p role="status" className="px-6 pb-5 text-sm text-zinc-500 sm:px-8">{loading ? "Loading incidents…" : failed ? "History is currently unavailable." : "No incidents recorded."}</p> : (
            <ul>
              {visible.map((incident) => <IncidentEntry key={incident.incidentId} incident={incident} name={names.get(incident.agentId) ?? incident.agentId} formatTime={formatTime} />)}
            </ul>
          )}
          {hasMore && (
            <button type="button" onClick={onShowMore} disabled={loading}
              className="w-full border-t border-zinc-200 px-6 py-4 text-left text-sm text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-nexus-blue focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-nexus-blue disabled:cursor-wait disabled:opacity-50 motion-reduce:transition-none dark:border-zinc-800 dark:hover:bg-zinc-950 sm:px-8">
              {loading ? "Loading…" : "Show more"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
