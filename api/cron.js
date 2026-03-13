import { runLatestMovieCheck } from "../lib/notifier.js";
import { methodNotAllowed, unauthorized } from "../lib/apiResponses.js";
import { logApiError, logApiHit, logApiOk } from "../lib/requestLog.js";

function isAuthorizedCronRequest(req) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return true;
  }

  return (req.headers.authorization || "") === `Bearer ${cronSecret}`;
}

export default async function handler(req, res) {
  const reqLogger = logApiHit("cron", req);

  if (req.method !== "GET") {
    return methodNotAllowed(reqLogger, res, logApiOk, "GET");
  }

  if (!isAuthorizedCronRequest(req)) {
    return unauthorized(reqLogger, res, logApiOk);
  }

  try {
    const result = await runLatestMovieCheck();
    logApiOk(reqLogger, {
      status: 200,
      fetchedLatest: result.fetchedLatest,
      todayCount: result.todayCount,
      notified: result.notifiedMovies,
      delivered: result.delivered,
      failed: result.failed,
    });
    return res.status(200).json({
      ok: true,
      ...result,
    });
  } catch (error) {
    logApiError(reqLogger, error, { status: 500 });
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
}
