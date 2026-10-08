import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, afterEach, before, mock, test } from "node:test";
import type { Incident } from "@better-nexus/shared";
import { api } from "../src/api.js";
import { incidents } from "../src/db.js";

const fixtures: Incident[] = Array.from({ length: 12 }, (_, index) => {
  const timestamp = new Date(Date.UTC(2026, 9, 8, 0, Math.floor(index / 2)));
  return {
    incidentId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    agentId: "00000000-0000-4000-8000-000000000099",
    title: `Incident ${index + 1}`,
    status: index % 3 === 0 ? "resolved" : "open",
    severity: "DOWN",
    reason: "TIMEOUT",
    startedAt: timestamp,
    resolvedAt: index % 3 === 0 ? timestamp : null,
    messages: [{ message: "Agent stopped responding.", timestamp }],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
});
const expectedIds = fixtures.map((incident) => incident.incidentId).reverse();
let server: Server;
let baseUrl: string;

before(async () => {
  // Importing api does not start the production server or connect to MongoDB.
  server = api.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(() => mock.restoreAll());
after(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

function mockIncidentQuery() {
  mock.method(incidents, "find", (filter: Record<string, unknown> = {}) => {
    let offset = 0;
    let limit: number | undefined;
    let ordering: Record<string, number> = {};
    const cursor = {
      sort(value: Record<string, number>) { ordering = value; return cursor; },
      skip(value: number) { offset = value; return cursor; },
      limit(value: number) { limit = value; return cursor; },
      async toArray() {
        const rows = fixtures.filter((incident) => !filter.status || incident.status === filter.status);
        rows.sort((a, b) => {
          for (const [key, direction] of Object.entries(ordering)) {
            const left = a[key as keyof Incident];
            const right = b[key as keyof Incident];
            const difference = left instanceof Date && right instanceof Date
              ? left.getTime() - right.getTime()
              : String(left).localeCompare(String(right));
            if (difference) return difference * direction;
          }
          return 0;
        });
        return rows.slice(offset, limit === undefined ? undefined : offset + limit);
      },
    };
    return cursor as unknown as ReturnType<typeof incidents.find>;
  });
}

async function get(path: string) {
  const response = await fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(5_000) });
  return { status: response.status, body: await response.json() };
}

test("batch/page returns five records per page, newest first, without overlap", async () => {
  mockIncidentQuery();
  const pages: string[][] = [];
  for (let page = 1; page <= 4; page++) {
    const { status, body } = await get(`/incidents?batch=5&page=${page}`);
    assert.equal(status, 200);
    assert.equal(body.success, true);
    pages.push(body.data.map((incident: Incident) => incident.incidentId));
  }
  assert.deepEqual(pages.map((page) => page.length), [5, 5, 2, 0]);
  assert.deepEqual(pages.flat(), expectedIds);
  assert.equal(new Set(pages.flat()).size, 12);
});

test("status filtering happens before pagination", async () => {
  mockIncidentQuery();
  const { status, body } = await get("/incidents?status=resolved&batch=2&page=2");
  assert.equal(status, 200);
  assert.deepEqual(body.data.map((incident: Incident) => incident.incidentId), [fixtures[3].incidentId, fixtures[0].incidentId]);
  assert.ok(body.data.every((incident: Incident) => incident.status === "resolved"));
});

test("countCap remains supported independently of batch/page", async () => {
  mockIncidentQuery();
  const { status, body } = await get("/incidents?countCap=3");
  assert.equal(status, 200);
  assert.deepEqual(body.data.map((incident: Incident) => incident.incidentId), expectedIds.slice(0, 3));
});

test("requests without pagination return the complete history", async () => {
  mockIncidentQuery();
  const { status, body } = await get("/incidents");
  assert.equal(status, 200);
  assert.deepEqual(body.data.map((incident: Incident) => incident.incidentId), expectedIds);
});

test("invalid pagination returns 400 before querying the database", async () => {
  const find = mock.method(incidents, "find", () => { throw new Error("Database must not be queried"); });
  for (const query of [
    "batch=5&page=1&countCap=5", "batch=5", "page=1", "batch=0&page=1",
    "batch=5&page=-1", "batch=1.5&page=1", "batch=abc&page=1", "countCap=0", "status=unknown",
  ]) {
    const { status, body } = await get(`/incidents?${query}`);
    assert.equal(status, 400, query);
    assert.equal(body.success, false);
  }
  assert.equal(find.mock.callCount(), 0);
});

test("an incident lookup returns one incident rather than a list", async () => {
  const findOne = mock.method(incidents, "findOne", async () => fixtures[0]);
  const { status, body } = await get(`/incidents/${fixtures[0].incidentId}`);
  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.incidentId, fixtures[0].incidentId);
  assert.equal(Array.isArray(body.data), false);
  assert.deepEqual(findOne.mock.calls[0].arguments[0], { incidentId: fixtures[0].incidentId });
});

test("an unknown incident returns 404", async () => {
  mock.method(incidents, "findOne", async () => null);
  const { status, body } = await get("/incidents/00000000-0000-4000-8000-000000000000");
  assert.equal(status, 404);
  assert.equal(body.success, false);
});
