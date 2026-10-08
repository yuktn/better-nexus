import type { Response } from "express";
import { mock, type TestContext } from "node:test";
import { ObjectId } from "mongodb";
import type { Incident } from "@better-nexus/shared";
import { incidents } from "../src/db.js";
import { addSseClient, removeSseClient } from "../src/sse.js";

type SseIncident = Omit<Incident, "startedAt" | "resolvedAt" | "createdAt" | "updatedAt" | "messages"> & {
  startedAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  messages: { message: string; timestamp: string }[];
};

export const agentId = "00000000-0000-4000-8000-000000000099";
export const incidentFixture: Incident = {
  incidentId: "00000000-0000-4000-8000-000000000001",
  agentId,
  title: "High CPU Usage",
  reason: "CPU_HI",
  severity: "DEGRADED",
  status: "open",
  startedAt: new Date("2026-10-08T00:00:00Z"),
  resolvedAt: null,
  messages: [{ message: "CPU usage exceeded the threshold.", timestamp: new Date("2026-10-08T00:00:00Z") }],
  createdAt: new Date("2026-10-08T00:00:00Z"),
  updatedAt: new Date("2026-10-08T00:00:00Z"),
};

// Preserve state across calls and return detached documents, as MongoDB does.
export function mockIncidentStore(initial: Incident[] = []) {
  const documents = structuredClone(initial);
  let writes = 0;
  const matches = (document: Incident, filter: Record<string, unknown>) =>
    Object.entries(filter).every(([key, value]) => document[key as keyof Incident] === value);

  mock.method(incidents, "findOne", async (filter: Record<string, unknown>) =>
    structuredClone(documents.find((document) => matches(document, filter)) ?? null));
  mock.method(incidents, "find", (filter: Record<string, unknown>) => ({
    async toArray() { return structuredClone(documents.filter((document) => matches(document, filter))); },
  }) as unknown as ReturnType<typeof incidents.find>);
  mock.method(incidents, "insertOne", async (document: Incident) => {
    documents.push(structuredClone(document));
    writes++;
    return { acknowledged: true, insertedId: new ObjectId() };
  });
  mock.method(incidents, "findOneAndUpdate", async (
    filter: Record<string, unknown>,
    update: { $set?: Partial<Incident>; $push?: { messages: Incident["messages"][number] } },
    options?: { returnDocument?: string },
  ) => {
    const document = documents.find((candidate) => matches(candidate, filter));
    if (!document) return null;
    const before = structuredClone(document);
    if (update.$set) Object.assign(document, structuredClone(update.$set));
    if (update.$push?.messages) document.messages.push(structuredClone(update.$push.messages));
    writes++;
    return options?.returnDocument === "after" ? structuredClone(document) : before;
  });

  return {
    get documents() { return structuredClone(documents); },
    get writes() { return writes; },
  };
}

export function captureSse(context: TestContext) {
  const frames: string[] = [];
  const response = { write(payload: string) { frames.push(payload); return true; } } as unknown as Response;
  addSseClient(response);
  context.after(() => removeSseClient(response));
  return {
    get frames() { return [...frames]; },
    incidentUpdates(): SseIncident[] {
      return frames.filter((frame) => frame.startsWith("event: incidentUpdate\n"))
        .map((frame) => JSON.parse(frame.split("\ndata: ")[1].trim()));
    },
  };
}
