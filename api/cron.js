import { runLatestMovieCheck } from "../lib/notifier.js";
import { logApiError, logApiHit, logApiOk } from "../lib/requestLog.js";

export default async function handler(req, res) {
  const reqLogger = logApiHit("cron", req);

  if (req.method !== "GET") {
    logApiOk(reqLogger, { status: 405 });
    return res.status(405).end();
  }

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.authorization || "";
    if (authHeader !== `Bearer ${cronSecret}`) {
      logApiOk(reqLogger, { status: 401, reason: "unauthorized" });
      return res.status(401).json({ error: "unauthorized" });
    }
  }

  try {
    const result = await runLatestMovieCheck();
    logApiOk(reqLogger, { status: 200, scanned: result.scanned, notified: result.notifiedMovies, delivered: result.delivered, failed: result.failed });
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
