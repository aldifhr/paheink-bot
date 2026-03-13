import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { generateKeyPairSync, sign } from "node:crypto";

process.env.UPSTASH_REDIS_REST_URL ??= "https://test.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN ??= "test-token";
process.env.DISCORD_BOT_TOKEN ??= "test-bot-token";

import dashboardHandler from "../api/dashboard.js";
import cronHandler from "../api/cron.js";
import interactiveHandler from "../api/interactive.js";

function createJsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createTextResponse(text, status = 200) {
  return new Response(text, { status });
}

function createRes() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    ended: false,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      this.ended = true;
      return this;
    },
    end(payload) {
      this.body = payload;
      this.ended = true;
      return this;
    },
  };
}

function createReq({ method = "GET", url = "/", headers = {}, body } = {}) {
  if (body == null) {
    return { method, url, headers };
  }

  const req = Readable.from([Buffer.from(body)]);
  req.method = method;
  req.url = url;
  req.headers = headers;
  return req;
}

function createPahePost({ id = 147563, title = "Sample Movie", date = new Date().toISOString() } = {}) {
  return {
    id,
    link: `https://pahe.ink/post-${id}/`,
    date_gmt: date,
    title: { rendered: `${title} (2024)` },
    excerpt: { rendered: "<p>Synopsis</p>" },
    content: {
      rendered: `
        <div class="imdbwp imdbwp--movie dark">
          <div class="imdbwp__thumb">
            <a class="imdbwp__link" href="https://www.imdb.com/title/tt1234567/">
              <img class="imdbwp__img" src="https://image.test/poster.jpg">
            </a>
          </div>
          <div class="imdbwp__content">
            <div class="imdbwp__header"><span class="imdbwp__title">${title}</span> (2024)</div>
            <div class="imdbwp__meta"><span>120 min</span>|<span>Action</span>|<span>01 Jan 2024</span></div>
            <div class="imdbwp__belt"><span class="imdbwp__star">7.4</span></div>
          </div>
        </div>
      `,
    },
  };
}

function createDiscordSignature(body, timestamp, privateKey) {
  return sign(null, Buffer.from(timestamp + body), privateKey).toString("hex");
}

function getDiscordPublicKeyHex(publicKey) {
  const der = publicKey.export({ format: "der", type: "spki" });
  return Buffer.from(der).subarray(-32).toString("hex");
}

function encodeUpstashValue(value) {
  if (value == null || typeof value === "number") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => encodeUpstashValue(item));
  }

  if (typeof value === "object") {
    return Object.entries(value).flatMap(([key, entryValue]) => [
      Buffer.from(String(key)).toString("base64"),
      Buffer.from(JSON.stringify(entryValue)).toString("base64"),
    ]);
  }

  if (value === "OK") {
    return "OK";
  }

  return Buffer.from(String(value)).toString("base64");
}

function createRedisFetchMock(resolver) {
  return async (url, init = {}) => {
    const href = String(url);
    if (!href.includes("upstash.io")) {
      return null;
    }

    const body = JSON.parse(init.body || "null");
    if (href.endsWith("/pipeline")) {
      return createJsonResponse(body.map((command) => ({ result: encodeUpstashValue(resolver(command)) })));
    }

    return createJsonResponse({ result: encodeUpstashValue(resolver(body)) });
  };
}

test("api/dashboard returns aggregated payload", async (t) => {
  const state = {
    lastNotifiedMovieId: "147563",
    lastScanAt: "2026-03-13T11:18:00.000Z",
  };
  const cronStatus = {
    ok: true,
    timestamp: "2026-03-13T11:18:00.000Z",
    fetchedLatest: 20,
    todayCount: 9,
    queued: 1,
    notifiedMovies: 1,
    delivered: 1,
    failed: 0,
    durationMs: 2412,
    newestId: "147563",
    remaining: 0,
  };

  const redisFetch = createRedisFetchMock((command) => {
    const [name, key] = command;
    if (name === "hgetall") return { guild1: "channel1" };
    if (name === "get" && key === "pahe:state:cron") return state;
    if (name === "get" && key === "pahe:cron:last_run") return cronStatus;
    return null;
  });

  t.mock.method(globalThis, "fetch", async (url, init) => {
    const redisResponse = await redisFetch(url, init);
    if (redisResponse) return redisResponse;

    const href = String(url);
    if (href.includes("discord.com/api/v10/users/@me")) {
      return createTextResponse("ok", 200);
    }
    if (href.includes("/wp-json/wp/v2/posts")) {
      return createJsonResponse([createPahePost()]);
    }
    throw new Error(`Unexpected fetch: ${href}`);
  });

  const res = createRes();
  await dashboardHandler(createReq({ method: "GET", url: "/api/dashboard", headers: {} }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.summary.channelCount, 1);
  assert.equal(res.body.health.discord.ok, true);
  assert.equal(res.body.system.label, "Healthy");
  assert.equal(res.body.latest.length, 1);
});

test("api/cron rejects unauthorized request when CRON_SECRET is set", async () => {
  process.env.CRON_SECRET = "top-secret";
  const res = createRes();

  await cronHandler(createReq({ method: "GET", url: "/api/cron", headers: {} }), res);

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: "unauthorized" });
});

test("api/cron runs notifier flow for authorized request", async (t) => {
  process.env.CRON_SECRET = "top-secret";

  const nowIso = new Date().toISOString();
  const redisOps = [];
  const redisFetch = createRedisFetchMock((command) => {
    const [name, key] = command;
    redisOps.push(command);
    if (name === "hgetall") return { guild1: "channel1" };
    if (name === "sismember") return 0;
    if (name === "sadd") return 1;
    if (name === "expire") return 1;
    if (name === "set") return "OK";
    if (name === "get" && key === "pahe:state:cron") return null;
    return null;
  });

  t.mock.method(globalThis, "fetch", async (url, init) => {
    const redisResponse = await redisFetch(url, init);
    if (redisResponse) return redisResponse;

    const href = String(url);
    if (href.includes("/wp-json/wp/v2/posts")) {
      return createJsonResponse([createPahePost({ date: nowIso })]);
    }
    if (href.includes("/channels/channel1/messages")) {
      return createJsonResponse({ id: "message-1" });
    }
    throw new Error(`Unexpected fetch: ${href}`);
  });

  const res = createRes();
  await cronHandler(createReq({
    method: "GET",
    url: "/api/cron",
    headers: { authorization: "Bearer top-secret" },
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.delivered, 1);
  assert.ok(redisOps.some((command) => command[0] === "set"));
});

test("api/interactive rejects invalid signature", async () => {
  process.env.DISCORD_PUBLIC_KEY = "00".repeat(32);
  const body = JSON.stringify({ type: 1 });
  const req = createReq({
    method: "POST",
    url: "/api/interactive",
    headers: {
      "x-signature-ed25519": "deadbeef",
      "x-signature-timestamp": "123",
    },
    body,
  });
  const res = createRes();

  await interactiveHandler(req, res);

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: "invalid_signature" });
});

test("api/interactive responds to signed ping interaction", async () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const body = JSON.stringify({ type: 1 });
  const timestamp = String(Date.now());
  process.env.DISCORD_PUBLIC_KEY = getDiscordPublicKeyHex(publicKey);

  const req = createReq({
    method: "POST",
    url: "/api/interactive",
    headers: {
      "x-signature-ed25519": createDiscordSignature(body, timestamp, privateKey),
      "x-signature-timestamp": timestamp,
    },
    body,
  });
  const res = createRes();

  await interactiveHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { type: 1 });
});

test("api/interactive handles signed status command", async (t) => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const body = JSON.stringify({
    type: 2,
    guild_id: "guild1",
    data: { name: "status", options: [] },
  });
  const timestamp = String(Date.now());
  process.env.DISCORD_PUBLIC_KEY = getDiscordPublicKeyHex(publicKey);

  const redisFetch = createRedisFetchMock((command) => {
    const [name] = command;
    if (name === "hget") return "channel1";
    return null;
  });

  t.mock.method(globalThis, "fetch", async (url, init) => {
    const redisResponse = await redisFetch(url, init);
    if (redisResponse) return redisResponse;
    throw new Error(`Unexpected fetch: ${String(url)}`);
  });

  const req = createReq({
    method: "POST",
    url: "/api/interactive",
    headers: {
      "x-signature-ed25519": createDiscordSignature(body, timestamp, privateKey),
      "x-signature-timestamp": timestamp,
    },
    body,
  });
  const res = createRes();

  await interactiveHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.type, 4);
  assert.match(res.body.data.content, /<#channel1>/);
});
