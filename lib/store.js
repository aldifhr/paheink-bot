import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");
const channelsFile = path.join(dataDir, "channels.json");
const stateFile = path.join(dataDir, "state.json");

async function ensureDir() {
  await mkdir(dataDir, { recursive: true });
}

async function readJson(filePath, fallback) {
  await ensureDir();

  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return fallback;
    }

    throw error;
  }
}

async function writeJson(filePath, value) {
  await ensureDir();
  await writeFile(filePath, JSON.stringify(value, null, 2));
}

export async function getChannels() {
  return readJson(channelsFile, []);
}

export async function setGuildChannel({ guildId, channelId }) {
  const channels = await getChannels();
  const next = channels.filter((item) => item.guildId !== guildId);
  next.push({
    guildId,
    channelId,
    updatedAt: new Date().toISOString(),
  });
  await writeJson(channelsFile, next);
  return next.find((item) => item.guildId === guildId) ?? null;
}

export async function getGuildChannel(guildId) {
  const channels = await getChannels();
  return channels.find((item) => item.guildId === guildId) ?? null;
}

export async function removeGuildChannel(guildId) {
  const channels = await getChannels();
  const next = channels.filter((item) => item.guildId !== guildId);
  await writeJson(channelsFile, next);
}

export async function getState() {
  return readJson(stateFile, {
    lastNotifiedMovieId: null,
    lastScanAt: null,
  });
}

export async function setState(patch) {
  const current = await getState();
  const next = {
    ...current,
    ...patch,
  };
  await writeJson(stateFile, next);
  return next;
}
