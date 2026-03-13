import { sendChannelMessage } from "./discord.js";
import { buildNotificationMessage } from "./messageBuilders.js";
import { latestMovies } from "./pahe.js";
import {
  getChannels,
  hasPostBeenNotified,
  markPostAsNotified,
  removeGuildChannel,
  setCronStatus,
  setState,
} from "./store.js";

const LATEST_SCAN_LIMIT = 20;
const MAX_NOTIFY_PER_RUN = 5;
const WIB_TIMEZONE = "Asia/Jakarta";

function sortAscendingById(items) {
  return [...items].sort((left, right) => Number(left.id) - Number(right.id));
}

function isUnknownChannelError(message) {
  return /unknown channel/i.test(String(message || ""));
}

function getWibDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: WIB_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function isPublishedTodayWib(movie, todayWibKey) {
  if (!movie?.publishedAt || !todayWibKey) return false;
  const published = new Date(movie.publishedAt);
  if (Number.isNaN(published.getTime())) return false;
  return getWibDateKey(published) === todayWibKey;
}

export async function runLatestMovieCheck() {
  const startedAt = Date.now();
  const [channels, latest] = await Promise.all([
    getChannels(),
    latestMovies(LATEST_SCAN_LIMIT),
  ]);

  const now = new Date();
  const nowIso = now.toISOString();
  const todayWibKey = getWibDateKey(now);

  if (!latest.length) {
    const status = {
      ok: true,
      dateWib: todayWibKey,
      fetchedLatest: 0,
      todayCount: 0,
      queued: 0,
      remaining: 0,
      notifiedMovies: 0,
      delivered: 0,
      failed: 0,
      channelCount: channels.length,
      lastScanAt: nowIso,
      timestamp: nowIso,
      durationMs: Date.now() - startedAt,
    };
    await Promise.all([
      setState({ lastScanAt: nowIso }),
      setCronStatus(status),
    ]);
    return status;
  }

  const todaysItems = sortAscendingById(latest.filter((movie) => isPublishedTodayWib(movie, todayWibKey)));
  const notifyFlags = await Promise.all(
    todaysItems.map((movie) => hasPostBeenNotified(movie.id, todayWibKey)),
  );
  const unseen = todaysItems.filter((_, index) => !notifyFlags[index]);
  const queue = unseen.slice(0, MAX_NOTIFY_PER_RUN);
  const remaining = Math.max(0, unseen.length - queue.length);

  let delivered = 0;
  let notifiedMovies = 0;
  let failed = 0;

  for (const movie of queue) {
    const payload = buildNotificationMessage(movie);
    let deliveredForMovie = 0;

    for (const target of channels) {
      try {
        await sendChannelMessage(target.channelId, payload);
        delivered += 1;
        deliveredForMovie += 1;
      } catch (error) {
        failed += 1;
        if (isUnknownChannelError(error.message)) {
          await removeGuildChannel(target.guildId);
        }
      }
    }

    if (deliveredForMovie > 0 || channels.length === 0) {
      await markPostAsNotified(movie.id, todayWibKey);
      notifiedMovies += 1;
    }
  }

  const newestId = latest[0]?.id ? String(latest[0].id) : null;
  const status = {
    ok: true,
    dateWib: todayWibKey,
    fetchedLatest: latest.length,
    todayCount: todaysItems.length,
    queued: queue.length,
    remaining,
    notifiedMovies,
    delivered,
    failed,
    channelCount: channels.length,
    newestId,
    lastScanAt: nowIso,
    timestamp: nowIso,
    durationMs: Date.now() - startedAt,
  };

  await Promise.all([
    setState({
      lastNotifiedMovieId: newestId,
      lastScanAt: nowIso,
    }),
    setCronStatus(status),
  ]);

  return status;
}
