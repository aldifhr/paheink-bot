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
const WIB_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: WIB_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function sortAscendingById(items) {
  return [...items].sort((left, right) => Number(left.id) - Number(right.id));
}

function isUnknownChannelError(message) {
  return /unknown channel/i.test(String(message || ""));
}

function getWibDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return WIB_DATE_FORMATTER.format(date);
}

function isPublishedTodayWib(movie, todayWibKey) {
  if (!movie?.publishedAt || !todayWibKey) return false;
  const published = new Date(movie.publishedAt);
  if (Number.isNaN(published.getTime())) return false;
  return getWibDateKey(published) === todayWibKey;
}

function buildCronStatus({
  nowIso,
  startedAt,
  todayWibKey,
  channels,
  latest = [],
  todaysItems = [],
  queue = [],
  remaining = 0,
  notifiedMovies = 0,
  delivered = 0,
  failed = 0,
}) {
  const newestId = latest[0]?.id ? String(latest[0].id) : null;

  return {
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
}

async function persistRun({ nowIso, newestId, status }) {
  await Promise.all([
    setState({
      lastNotifiedMovieId: newestId ?? null,
      lastScanAt: nowIso,
    }),
    setCronStatus(status),
  ]);
}

async function notifyMovie(movie, channels, todayWibKey) {
  const payload = buildNotificationMessage(movie);
  let delivered = 0;
  let failed = 0;

  for (const target of channels) {
    try {
      await sendChannelMessage(target.channelId, payload);
      delivered += 1;
    } catch (error) {
      failed += 1;
      if (isUnknownChannelError(error.message)) {
        await removeGuildChannel(target.guildId);
      }
    }
  }

  const notified = delivered > 0 || channels.length === 0;
  if (notified) {
    await markPostAsNotified(movie.id, todayWibKey);
  }

  return { delivered, failed, notified };
}

export async function runLatestMovieCheck() {
  const startedAt = Date.now();
  const [channels, latest] = await Promise.all([
    getChannels(),
    latestMovies(LATEST_SCAN_LIMIT),
  ]);

  const nowIso = new Date().toISOString();
  const todayWibKey = getWibDateKey(nowIso);

  if (!latest.length) {
    const status = buildCronStatus({
      nowIso,
      startedAt,
      todayWibKey,
      channels,
    });
    await persistRun({ nowIso, status });
    return status;
  }

  const todaysItems = sortAscendingById(latest.filter((movie) => isPublishedTodayWib(movie, todayWibKey)));
  const notifyFlags = await Promise.all(todaysItems.map((movie) => hasPostBeenNotified(movie.id, todayWibKey)));
  const unseen = todaysItems.filter((_, index) => !notifyFlags[index]);
  const queue = unseen.slice(0, MAX_NOTIFY_PER_RUN);
  const remaining = Math.max(0, unseen.length - queue.length);

  let delivered = 0;
  let notifiedMovies = 0;
  let failed = 0;

  for (const movie of queue) {
    const result = await notifyMovie(movie, channels, todayWibKey);
    delivered += result.delivered;
    failed += result.failed;
    notifiedMovies += result.notified ? 1 : 0;
  }

  const status = buildCronStatus({
    nowIso,
    startedAt,
    todayWibKey,
    channels,
    latest,
    todaysItems,
    queue,
    remaining,
    notifiedMovies,
    delivered,
    failed,
  });

  await persistRun({ nowIso, newestId: status.newestId, status });
  return status;
}
