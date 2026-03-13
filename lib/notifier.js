import { sendChannelMessage } from "./discord.js";
import { buildNotificationMessage } from "./messageBuilders.js";
import { latestMovies } from "./pahe.js";
import { getChannels, getState, removeGuildChannel, setState } from "./store.js";

const MIN_SCAN_INTERVAL_MS = 24 * 60 * 60 * 1000;

function sortAscendingById(items) {
  return [...items].sort((left, right) => Number(left.id) - Number(right.id));
}

function isUnknownChannelError(message) {
  return /unknown channel/i.test(String(message || ""));
}

function shouldSkipScan(lastScanAt) {
  if (!lastScanAt) return false;

  const lastScanMs = new Date(lastScanAt).getTime();
  if (Number.isNaN(lastScanMs)) return false;

  return Date.now() - lastScanMs < MIN_SCAN_INTERVAL_MS;
}

export async function runLatestMovieCheck() {
  const [channels, state] = await Promise.all([
    getChannels(),
    getState(),
  ]);

  if (shouldSkipScan(state.lastScanAt)) {
    return {
      skipped: true,
      reason: "less_than_24h",
      scanned: 0,
      notifiedMovies: 0,
      delivered: 0,
      channelCount: channels.length,
      lastScanAt: state.lastScanAt,
    };
  }

  const latest = await latestMovies();

  if (!latest.length) {
    await setState({ lastScanAt: new Date().toISOString() });
    return {
      skipped: false,
      scanned: 0,
      notifiedMovies: 0,
      delivered: 0,
      channelCount: channels.length,
    };
  }

  const newestId = latest[0].id;
  const unseen = state.lastNotifiedMovieId
    ? latest.filter((movie) => Number(movie.id) > Number(state.lastNotifiedMovieId))
    : [];
  const queue = sortAscendingById(unseen);

  let delivered = 0;
  for (const movie of queue) {
    const payload = buildNotificationMessage(movie);
    for (const target of channels) {
      try {
        await sendChannelMessage(target.channelId, payload);
        delivered += 1;
      } catch (error) {
        if (isUnknownChannelError(error.message)) {
          await removeGuildChannel(target.guildId);
        }
      }
    }
  }

  const now = new Date().toISOString();
  await setState({
    lastNotifiedMovieId: newestId,
    lastScanAt: now,
  });

  return {
    skipped: false,
    scanned: latest.length,
    notifiedMovies: queue.length,
    delivered,
    channelCount: channels.length,
    newestId,
    lastScanAt: now,
  };
}
