import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import type { AgentDocument, Heartbeat } from "@better-nexus/shared";
import { agents, agentStatusChanges } from "../src/db.js";
import { statusManager } from "../src/statusManager.js";
import { agentId, captureSse, mockIncidentStore } from "./helpers.js";

afterEach(() => mock.restoreAll());

function mockAgent() {
  const agent: AgentDocument = {
    agentId,
    agentName: "test-agent",
    agentNexusVersion: "0.1.0",
    platform: "linux",
    sourceIP: "127.0.0.1",
    ipType: "ipv4",
    registeredOn: Date.now(),
    lastSeenOn: Date.now(),
    hashedAgentSecret: "test-only-secret",
    status: "UP",
  };
  mock.method(agents, "findOne", async () => structuredClone(agent));
  mock.method(agents, "findOneAndUpdate", async (_filter: unknown, update: { $set: Partial<AgentDocument> }) => {
    Object.assign(agent, update.$set);
    return structuredClone(agent);
  });
  mock.method(agentStatusChanges, "insertOne", async () => ({ acknowledged: true }));
  return agent;
}

function heartbeat(cpu: number, memory = 20): Heartbeat {
  return { cpu, memory, temp: 43, timestamp: Date.now() };
}

test("repeated CPU-high heartbeats create only one open CPU_HI incident", async (context) => {
  const agent = mockAgent();
  const store = mockIncidentStore();
  const stream = captureSse(context);

  for (let index = 0; index < 4; index++) {
    await statusManager.onHeartbeat(agentId, heartbeat(95));
  }

  assert.equal(store.documents.length, 1);
  assert.equal(store.documents[0].reason, "CPU_HI");
  assert.equal(store.documents[0].status, "open");
  assert.equal(store.writes, 1);
  assert.equal(stream.incidentUpdates().length, 1);
  assert.equal(agent.status, "DEGRADED");
});

for (const recovered of ["CPU_HI", "MEM_HI"] as const) {
  test(`${recovered} recovery resolves only that incident while the other remains open`, async (context) => {
    const agent = mockAgent();
    const store = mockIncidentStore();
    const stream = captureSse(context);

    await statusManager.onHeartbeat(agentId, heartbeat(95, 95));
    assert.equal(store.documents.length, 2);
    assert.deepEqual(store.documents.map((incident) => incident.reason).sort(), ["CPU_HI", "MEM_HI"]);
    assert.ok(store.documents.every((incident) => incident.status === "open"));
    const remainingReason = recovered === "CPU_HI" ? "MEM_HI" : "CPU_HI";
    const remainingBefore = store.documents.find((incident) => incident.reason === remainingReason)!;

    await statusManager.onHeartbeat(agentId, recovered === "CPU_HI" ? heartbeat(20, 95) : heartbeat(95, 20));

    const resolved = store.documents.find((incident) => incident.reason === recovered)!;
    assert.equal(resolved.status, "resolved");
    assert.ok(resolved.resolvedAt instanceof Date);
    assert.deepEqual(store.documents.find((incident) => incident.reason === remainingReason), remainingBefore);
    assert.equal(agent.status, "DEGRADED");
    assert.equal(store.writes, 3);
    const updates = stream.incidentUpdates();
    assert.equal(updates.length, 3);
    assert.equal(updates[2].incidentId, resolved.incidentId);
    assert.equal(updates[2].status, "resolved");

    await statusManager.onHeartbeat(agentId, heartbeat(20, 20));
    assert.ok(store.documents.every((incident) => incident.status === "resolved"));
    assert.equal(agent.status, "UP");
  });
}
