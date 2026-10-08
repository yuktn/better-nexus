import assert from "node:assert/strict";
import { test } from "node:test";
import { HeartbeatSchema, IncidentRequestSchema, PlatformSchema } from "../dist/index.js";

test("incident requests allow all statuses with either pagination mode", () => {
  for (const pagination of [{}, { countCap: 5 }, { batch: 5, page: 1 }]) {
    assert.equal(IncidentRequestSchema.safeParse({ pagination }).success, true);
  }
  for (const status of ["open", "resolved"]) {
    assert.equal(IncidentRequestSchema.safeParse({ status, pagination: { batch: 5, page: 2 } }).success, true);
  }
});

test("incident requests reject mixed, incomplete, and invalid pagination", () => {
  const invalid = [
    { countCap: 5, batch: 5, page: 1 },
    { countCap: 5, page: 1 },
    { batch: 5 },
    { page: 1 },
    { batch: 0, page: 1 },
    { batch: 5, page: 0 },
    { batch: 1.5, page: 1 },
    { batch: 5, page: 1.5 },
    { countCap: -1 },
    { countCap: "5" },
  ];
  for (const pagination of invalid) {
    assert.equal(IncidentRequestSchema.safeParse({ pagination }).success, false, JSON.stringify(pagination));
  }
  assert.equal(IncidentRequestSchema.safeParse({ status: "unknown", pagination: {} }).success, false);
});

test("heartbeats accept percentage boundaries and reject invalid telemetry", () => {
  const heartbeat = { cpu: 0, memory: 100, temp: 43, timestamp: 1_791_417_600_000 };
  assert.deepEqual(HeartbeatSchema.parse(heartbeat), heartbeat);
  assert.equal(HeartbeatSchema.safeParse({ ...heartbeat, cpu: 100, memory: 0 }).success, true);
  for (const override of [{ cpu: -1 }, { cpu: 101 }, { memory: -1 }, { memory: 101 }, { temp: NaN }, { timestamp: 1.5 }]) {
    assert.equal(HeartbeatSchema.safeParse({ ...heartbeat, ...override }).success, false);
  }
});

test("agent platforms accept the three supported names", () => {
  for (const platform of ["linux", "mac", "windows"]) {
    assert.equal(PlatformSchema.parse(platform), platform);
  }
  assert.equal(PlatformSchema.safeParse("darwin").success, false);
});
