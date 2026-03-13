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

export function logApiHit(name, req) {
  const meta = buildReqMeta(req);
  console.info(JSON.stringify({ level: "info", endpoint: name, event: "request_start", ...meta }));
  return { endpoint: name, ...meta, startedAt: Date.now() };
}

export function logApiOk(ctx, extra = {}) {
  if (!ctx) return;
  console.info(
    JSON.stringify({
      level: "info",
      endpoint: ctx.endpoint,
      event: "request_ok",
      durationMs: Date.now() - ctx.startedAt,
      method: ctx.method,
      path: ctx.path,
      reqId: ctx.reqId,
      ip: ctx.ip,
      ...extra,
    }),
  );
}

export function logApiError(ctx, err, extra = {}) {
  if (!ctx) return;
  console.error(
    JSON.stringify({
      level: "error",
      endpoint: ctx.endpoint,
      event: "request_error",
      durationMs: Date.now() - ctx.startedAt,
      method: ctx.method,
      path: ctx.path,
      reqId: ctx.reqId,
      ip: ctx.ip,
      error: err?.message || String(err),
      code: err?.code || null,
      ...extra,
    }),
  );
}
