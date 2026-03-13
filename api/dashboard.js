import { latestMovies } from "../lib/pahe.js";
import { getChannels, getCronStatus, getState } from "../lib/store.js";
import { logApiError, logApiHit, logApiOk } from "../lib/requestLog.js";

export default async function handler(req, res) {
  const reqLogger = logApiHit("dashboard", req);

  if (req.method !== "GET") {
    logApiOk(reqLogger, { status: 405 });
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    const [channels, state, latest, cronStatus] = await Promise.all([
      getChannels(),
      getState(),
      latestMovies(),
      getCronStatus(),
    ]);

    const payload = {
      ok: true,
      summary: {
        channelCount: channels.length,
        lastScanAt: state.lastScanAt,
        lastNotifiedMovieId: state.lastNotifiedMovieId,
      },
      cronStatus,
      channels,
      latest: latest.slice(0, 6).map((movie) => ({
        id: movie.id,
        title: movie.title,
        year: movie.year,
        rating: movie.rating,
        link: movie.link,
        poster: movie.poster,
      })),
    };

    logApiOk(reqLogger, { status: 200, channels: channels.length });
    return res.status(200).json(payload);
  } catch (error) {
    logApiError(reqLogger, error, { status: 500 });
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
}
