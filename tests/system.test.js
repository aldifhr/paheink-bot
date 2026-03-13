import test from "node:test";
import assert from "node:assert/strict";
import { buildScheduleInfo, summarizeSystemHealth } from "../api/dashboard.js";
import { componentErrorResponse, parseJsonBody } from "../api/interactive.js";
import { buildCronStatus, getWibDateKey } from "../lib/notifier.js";

test("summarizeSystemHealth marks degraded when cron failed", () => {
  const result = summarizeSystemHealth(
    {
      redis: { ok: true },
      pahe: { ok: true },
      discord: { ok: true },
    },
    { ok: false },
  );

  assert.deepEqual(result, { ok: false, label: "Degraded" });
});

test("buildScheduleInfo adds default 30 minute interval", () => {
  const result = buildScheduleInfo({
    state: { lastScanAt: "2026-03-13T11:18:00.000Z" },
    cronStatus: null,
  });

  assert.equal(result.intervalMinutes, 30);
  assert.equal(result.lastRunAt, "2026-03-13T11:18:00.000Z");
  assert.equal(result.nextRunAt, "2026-03-13T11:48:00.000Z");
});

test("parseJsonBody returns null for invalid json", () => {
  assert.equal(parseJsonBody("{"), null);
});

test("componentErrorResponse builds ephemeral update payload", () => {
  const result = componentErrorResponse("boom");

  assert.equal(result.type, 7);
  assert.equal(result.data.flags, 64);
  assert.equal(result.data.content, "boom");
  assert.deepEqual(result.data.components, []);
});

test("getWibDateKey uses Asia Jakarta day boundary", () => {
  assert.equal(getWibDateKey("2026-03-13T17:30:00.000Z"), "2026-03-14");
});

test("buildCronStatus computes newest id and duration", () => {
  const startedAt = Date.now() - 50;
  const result = buildCronStatus({
    nowIso: "2026-03-13T11:18:00.000Z",
    startedAt,
    todayWibKey: "2026-03-13",
    channels: [{ guildId: "1", channelId: "2" }],
    latest: [{ id: 147563 }, { id: 147562 }],
    todaysItems: [{ id: 147562 }, { id: 147563 }],
    queue: [{ id: 147563 }],
    remaining: 2,
    notifiedMovies: 1,
    delivered: 1,
    failed: 0,
  });

  assert.equal(result.newestId, "147563");
  assert.equal(result.fetchedLatest, 2);
  assert.equal(result.todayCount, 2);
  assert.equal(result.queued, 1);
  assert.equal(result.remaining, 2);
  assert.equal(result.channelCount, 1);
  assert.ok(result.durationMs >= 0);
});
