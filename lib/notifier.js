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

function sortAscendingById(items) {
  return [...items].sort((left, right) => Number(left.id) - Number(right.id));
}

function isUnknownChannelError(message) {
  return /unknown channel/i.test(String(message || ""));
}

export async function runLatestMovieCheck() {
  const startedAt = Date.now();
  const [channels, latest] = await Promise.all([
    getChannels(),
    latestMovies(LATEST_SCAN_LIMIT),
  ]);

  if (!latest.length) {
    const now = new Date().toISOString();
    const status = {
      ok: true,
      scanned: 0,
      queued: 0,
      remaining: 0,
      notifiedMovies: 0,
      delivered: 0,
      failed: 0,
      channelCount: channels.length,
      lastScanAt: now,
      timestamp: now,
      durationMs: Date.now() - startedAt,
    };
    await Promise.all([
      setState({ lastScanAt: now }),
      setCronStatus(status),
    ]);
    return status;
  }

  const ordered = sortAscendingById(latest);
  const notifyFlags = await Promise.all(
    ordered.map((movie) => hasPostBeenNotified(movie.id)),
  );
  const unseen = ordered.filter((_, index) => !notifyFlags[index]);
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
      await markPostAsNotified(movie.id);
      notifiedMovies += 1;
    }
  }

  const newestId = String(latest[0].id);
  const now = new Date().toISOString();
  const status = {
    ok: true,
    scanned: latest.length,
    queued: queue.length,
    remaining,
    notifiedMovies,
    delivered,
    failed,
    channelCount: channels.length,
    newestId,
    lastScanAt: now,
    timestamp: now,
    durationMs: Date.now() - startedAt,
  };

  await Promise.all([
    setState({
      lastNotifiedMovieId: newestId,
      lastScanAt: now,
    }),
    setCronStatus(status),
  ]);

  return status;
}
