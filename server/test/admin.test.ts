import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, afterEach, before, beforeEach, mock, test } from "node:test";
import { generate } from "otplib";
import { enrollmentTokens } from "../src/db.js";
import { captureSse, incidentFixture, mockIncidentStore } from "./helpers.js";

const secret = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
const originalConfigDir = process.env.NEXUS_CONFIG_DIR;
let configDir: string;
let server: Server;
let baseUrl: string;

before(async () => {
  configDir = await mkdtemp(join(tmpdir(), "better-nexus-admin-test-"));
  process.env.NEXUS_CONFIG_DIR = configDir;
  await writeFile(join(configDir, "server.token"), secret, { mode: 0o600 });
  // Import after setting the isolated token path; never read the real token.
  const { admin } = await import("../src/admin.js");
  server = admin.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

beforeEach(() => {
  // Keep TOTP generation and verification in the same time step.
  mock.timers.enable({ apis: ["Date"], now: Date.UTC(2026, 9, 8, 1) });
});
afterEach(() => {
  mock.restoreAll();
  mock.timers.reset();
});
after(async () => {
  try {
    if (server) {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  } finally {
    if (originalConfigDir === undefined) delete process.env.NEXUS_CONFIG_DIR;
    else process.env.NEXUS_CONFIG_DIR = originalConfigDir;
    if (configDir) await rm(configDir, { recursive: true, force: true });
  }
});

async function post(path: string, body: unknown, token?: string) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5_000),
  });
  return { status: response.status, body: await response.json() };
}

test("editing a title persists it and broadcasts the complete updated incident", async (context) => {
  const store = mockIncidentStore([incidentFixture]);
  const stream = captureSse(context);
  const token = await generate({ secret });
  const result = await post("/admin/incidents", { incidentId: incidentFixture.incidentId, field: "title", value: "CPU saturation investigated" }, token);

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.equal(store.documents[0].title, "CPU saturation investigated");
  assert.deepEqual(store.documents[0].messages, incidentFixture.messages);
  assert.equal(store.documents[0].updatedAt.getTime(), Date.now());
  assert.equal(store.writes, 1);
  const expected = JSON.parse(JSON.stringify(store.documents[0]));
  assert.deepEqual(result.body.data, expected);
  assert.deepEqual(stream.incidentUpdates(), [expected]);
});

test("adding a message persists the timestamp and broadcasts the complete updated incident", async (context) => {
  const store = mockIncidentStore([incidentFixture]);
  const stream = captureSse(context);
  const token = await generate({ secret });
  const result = await post("/admin/incidents", { incidentId: incidentFixture.incidentId, field: "message", value: "Restarted the affected workload." }, token);

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  const document = store.documents[0];
  assert.equal(document.title, incidentFixture.title);
  assert.deepEqual(document.messages, [...incidentFixture.messages, { message: "Restarted the affected workload.", timestamp: new Date(Date.now()) }]);
  assert.equal(document.updatedAt.getTime(), Date.now());
  assert.equal(store.writes, 1);
  const expected = JSON.parse(JSON.stringify(document));
  assert.deepEqual(result.body.data, expected);
  assert.deepEqual(stream.incidentUpdates(), [expected]);
});

for (const authentication of ["missing", "invalid"] as const) {
  for (const path of ["/admin/register", "/admin/incidents"]) {
    test(`${path} rejects ${authentication} TOTP without writes or SSE broadcasts`, async (context) => {
      const store = mockIncidentStore([incidentFixture]);
      const stream = captureSse(context);
      const insertToken = mock.method(enrollmentTokens, "insertOne", async () => { throw new Error("Enrollment must not be modified"); });
      const validToken = await generate({ secret });
      const invalidToken = String((Number(validToken) + 1) % 1_000_000).padStart(6, "0");
      const result = await post(path, { incidentId: incidentFixture.incidentId, field: "title", value: "Unauthorized edit" }, authentication === "invalid" ? invalidToken : undefined);

      assert.equal(result.status, 401);
      assert.equal(result.body.success, false);
      assert.deepEqual(store.documents, [incidentFixture]);
      assert.equal(store.writes, 0);
      assert.equal(insertToken.mock.callCount(), 0);
      assert.deepEqual(stream.frames, []);
    });
  }
}
