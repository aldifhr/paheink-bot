import { latestMovies } from "../lib/pahe.js";
import { redis } from "../lib/redis.js";
import { getChannels, getCronStatus, getState } from "../lib/store.js";
import { logApiError, logApiHit, logApiOk } from "../lib/requestLog.js";

async function checkRedisHealth() {
  try {
    await redis.get("pahe:state:cron");
    return { ok: true, label: "OK" };
  } catch (error) {
    return { ok: false, label: error.message || "Redis error" };
  }
}

async function checkDiscordHealth() {
  if (!process.env.DISCORD_BOT_TOKEN) {
    return { ok: false, label: "Missing token" };
  }

  try {
    const response = await fetch("https://discord.com/api/v10/users/@me", {
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      },
    });

    if (!response.ok) {
      return { ok: false, label: `HTTP ${response.status}` };
    }

    return { ok: true, label: "OK" };
  } catch (error) {
    return { ok: false, label: error.message || "Discord error" };
  }
}

function getSettledValue(result, fallback) {
  return result?.status === "fulfilled" ? result.value : fallback;
}

function mapLatest(items) {
  return items.slice(0, 10).map((movie) => ({
    id: movie.id,
    title: movie.title,
    year: movie.year,
    rating: movie.rating,
    link: movie.link,
    poster: movie.poster,
  }));
}

export default async function handler(req, res) {
  const reqLogger = logApiHit("dashboard", req);

  if (req.method !== "GET") {
    logApiOk(reqLogger, { status: 405 });
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    const [channelsResult, stateResult, latestResult, cronStatusResult, redisHealthResult, discordHealthResult] = await Promise.allSettled([
      getChannels(),
      getState(),
      latestMovies(),
      getCronStatus(),
      checkRedisHealth(),
      checkDiscordHealth(),
    ]);

    const channels = getSettledValue(channelsResult, []);
    const state = getSettledValue(stateResult, { lastScanAt: null, lastNotifiedMovieId: null });
    const latest = getSettledValue(latestResult, []);
    const cronStatus = getSettledValue(cronStatusResult, null);
    const redisHealth = getSettledValue(redisHealthResult, { ok: false, label: "Redis error" });
    const discordHealth = getSettledValue(discordHealthResult, { ok: false, label: "Discord error" });
    const paheHealth = latestResult?.status === "fulfilled"
      ? { ok: true, label: "OK" }
      : { ok: false, label: latestResult?.reason?.message || "Fetch error" };

    const payload = {
      ok: true,
      summary: {
        channelCount: Array.isArray(channels) ? channels.length : 0,
        lastScanAt: state?.lastScanAt ?? null,
        lastNotifiedMovieId: state?.lastNotifiedMovieId ?? null,
      },
      health: {
        redis: redisHealth,
        pahe: paheHealth,
        discord: discordHealth,
      },
      cronStatus,
      channels: Array.isArray(channels) ? channels : [],
      latest: Array.isArray(latest) ? mapLatest(latest) : [],
    };

    logApiOk(reqLogger, {
      status: 200,
      channels: payload.summary.channelCount,
      redisOk: redisHealth.ok,
      paheOk: paheHealth.ok,
      discordOk: discordHealth.ok,
    });
    return res.status(200).json(payload);
  } catch (error) {
    logApiError(reqLogger, error, { status: 500 });
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
}
