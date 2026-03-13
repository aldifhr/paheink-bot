import { redis } from "./redis.js";

const CHANNEL_HASH_KEY = "pahe:channels:guild-map";
const STATE_KEY = "pahe:state:cron";

function normalizeChannelMap(map) {
  if (!map || typeof map !== "object") return {};

  return Object.fromEntries(
    Object.entries(map)
      .map(([guildId, channelId]) => [String(guildId), channelId == null ? null : String(channelId)])
      .filter(([, channelId]) => Boolean(channelId)),
  );
}

export async function getChannels() {
  try {
    const map = normalizeChannelMap(await redis.hgetall(CHANNEL_HASH_KEY));
    return Object.entries(map).map(([guildId, channelId]) => ({
      guildId,
      channelId,
    }));
  } catch (error) {
    console.error("[getChannels] Redis error:", error);
    return [];
  }
}

export async function setGuildChannel({ guildId, channelId }) {
  const value = String(channelId).trim();
  await redis.hset(CHANNEL_HASH_KEY, { [String(guildId)]: value });
  return {
    guildId: String(guildId),
    channelId: value,
  };
}

export async function getGuildChannel(guildId) {
  try {
    const value = await redis.hget(CHANNEL_HASH_KEY, String(guildId));
    if (value === null || value === undefined) return null;
    return {
      guildId: String(guildId),
      channelId: String(value),
    };
  } catch (error) {
    console.error(`[getGuildChannel] guildId=${guildId}:`, error);
    return null;
  }
}

export async function removeGuildChannel(guildId) {
  await redis.hdel(CHANNEL_HASH_KEY, String(guildId));
}

export async function getState() {
  try {
    const state = await redis.get(STATE_KEY);
    if (!state || typeof state !== "object") {
      return {
        lastNotifiedMovieId: null,
        lastScanAt: null,
      };
    }

    return {
      lastNotifiedMovieId: state.lastNotifiedMovieId ?? null,
      lastScanAt: state.lastScanAt ?? null,
    };
  } catch (error) {
    console.error("[getState] Redis error:", error);
    return {
      lastNotifiedMovieId: null,
      lastScanAt: null,
    };
  }
}

export async function setState(patch) {
  const current = await getState();
  const next = {
    ...current,
    ...patch,
  };
  await redis.set(STATE_KEY, next);
  return next;
}
