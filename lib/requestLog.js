function buildReqMeta(req) {
  const method = req?.method ?? "UNKNOWN";
  const path = req?.url ?? "";
  const reqId =
    req?.headers?.["x-vercel-id"] ||
    req?.headers?.["x-request-id"] ||
    req?.headers?.["cf-ray"] ||
    null;
  const ip =
    req?.headers?.["x-forwarded-for"] ||
    req?.headers?.["x-real-ip"] ||
    null;

  return { method, path, reqId, ip };
}

function logEvent(level, payload) {
  const message = JSON.stringify({ level, ...payload });
  const logger = level === "error" ? console.error : console.info;
  logger(message);
}

function buildLogPayload(ctx, event, extra = {}) {
  return {
    endpoint: ctx.endpoint,
    event,
    durationMs: Date.now() - ctx.startedAt,
    method: ctx.method,
    path: ctx.path,
    reqId: ctx.reqId,
    ip: ctx.ip,
    ...extra,
  };
}

export function logApiHit(name, req) {
  const meta = buildReqMeta(req);
  logEvent("info", { endpoint: name, event: "request_start", ...meta });
  return { endpoint: name, ...meta, startedAt: Date.now() };
}

export function logApiOk(ctx, extra = {}) {
  if (!ctx) return;
  logEvent("info", buildLogPayload(ctx, "request_ok", extra));
}

export function logApiError(ctx, err, extra = {}) {
  if (!ctx) return;
  logEvent(
    "error",
    buildLogPayload(ctx, "request_error", {
      error: err?.message || String(err),
      code: err?.code || null,
      ...extra,
    }),
  );
}
