import { sendChannelMessage } from "./discord.js";
import { buildNotificationMessage } from "./messageBuilders.js";
import { latestMovies } from "./pahe.js";
import { getChannels, getState, removeGuildChannel, setState } from "./store.js";

function sortAscendingById(items) {
  return [...items].sort((left, right) => Number(left.id) - Number(right.id));
}

function isUnknownChannelError(message) {
  return /unknown channel/i.test(String(message || ""));
}

export async function runLatestMovieCheck() {
  const [channels, state, latest] = await Promise.all([
    getChannels(),
    getState(),
    latestMovies(),
  ]);

  if (!latest.length) {
    await setState({ lastScanAt: new Date().toISOString() });
    return {
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

  await setState({
    lastNotifiedMovieId: newestId,
    lastScanAt: new Date().toISOString(),
  });

  return {
    scanned: latest.length,
    notifiedMovies: queue.length,
    delivered,
    channelCount: channels.length,
    newestId,
  };
}
