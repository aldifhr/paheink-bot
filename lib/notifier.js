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
    latestMovies(50),
  ]);

  if (!latest.length) {
    const now = new Date().toISOString();
    const status = {
      ok: true,
      scanned: 0,
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
  const queue = [];
  for (const movie of ordered) {
    const alreadyNotified = await hasPostBeenNotified(movie.id);
    if (!alreadyNotified) {
      queue.push(movie);
    }
  }

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
