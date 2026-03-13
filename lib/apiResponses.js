export function jsonError(res, status, error) {
  return res.status(status).json({ error });
}

export function methodNotAllowed(reqLogger, res, logApiOk, allowedMethod) {
  logApiOk(reqLogger, { status: 405 });
  if (allowedMethod) {
    res.setHeader("Allow", allowedMethod);
  }
  return res.status(405).json({ error: "method_not_allowed" });
}

export function unauthorized(reqLogger, res, logApiOk, reason = "unauthorized") {
  logApiOk(reqLogger, { status: 401, reason });
  return res.status(401).json({ error: reason });
}

export function serverMisconfigured(reqLogger, res, logApiError, message = "misconfigured_server") {
  logApiError(reqLogger, new Error(message), { status: 500 });
  return res.status(500).json({ error: message });
}
