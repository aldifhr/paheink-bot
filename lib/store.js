import { redis } from "./redis.js";

const CHANNEL_HASH_KEY = "pahe:channels:guild-map";
const STATE_KEY = "pahe:state:cron";
const CRON_STATUS_KEY = "pahe:cron:last_run";
const NOTIFIED_SET_PREFIX = "pahe:notified";
const NOTIFIED_SET_TTL_SECONDS = 7 * 24 * 60 * 60;

function getNotifiedSetKey(dateKey) {
  return `${NOTIFIED_SET_PREFIX}:${String(dateKey || "unknown")}`;
}

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

export async function hasPostBeenNotified(postId, dateKey) {
  try {
    return await redis.sismember(getNotifiedSetKey(dateKey), String(postId));
  } catch (error) {
    console.error(`[hasPostBeenNotified] dateKey=${dateKey} postId=${postId}:`, error);
    return false;
  }
}

export async function markPostAsNotified(postId, dateKey) {
  const key = getNotifiedSetKey(dateKey);
  await redis.sadd(key, String(postId));
  await redis.expire(key, NOTIFIED_SET_TTL_SECONDS);
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

export async function getCronStatus() {
  try {
    const status = await redis.get(CRON_STATUS_KEY);
    return status && typeof status === "object" ? status : null;
  } catch (error) {
    console.error("[getCronStatus] Redis error:", error);
    return null;
  }
}

export async function setCronStatus(status) {
  await redis.set(CRON_STATUS_KEY, status);
}
