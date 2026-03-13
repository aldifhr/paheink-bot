import { latestMovies } from "../lib/pahe.js";
import { getChannels, getState } from "../lib/store.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    const [channels, state, latest] = await Promise.all([
      getChannels(),
      getState(),
      latestMovies(),
    ]);

    return res.status(200).json({
      ok: true,
      summary: {
        channelCount: channels.length,
        lastScanAt: state.lastScanAt,
        lastNotifiedMovieId: state.lastNotifiedMovieId,
      },
      channels,
      latest: latest.slice(0, 6).map((movie) => ({
        id: movie.id,
        title: movie.title,
        year: movie.year,
        rating: movie.rating,
        link: movie.link,
        poster: movie.poster,
      })),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
}
