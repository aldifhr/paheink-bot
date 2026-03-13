import { InteractionResponseType, MessageFlags } from "./constants.js";
import { editInteractionResponse } from "./discord.js";
import { latestMovies, searchMovies, getMovieById } from "./pahe.js";
import { buildLatestResponse, buildMovieResponse, buildPickerResponse } from "./messageBuilders.js";
import { getGuildChannel, setGuildChannel } from "./store.js";

function getStringOption(options, name) {
  return String(options?.find((item) => item.name === name)?.value || "").trim();
}

function getChannelOption(options, name) {
  return options?.find((item) => item.name === name)?.value ?? null;
}

function ephemeralData(content, extra = {}) {
  return {
    flags: MessageFlags.EPHEMERAL,
    content,
    ...extra,
  };
}

function respondEphemeral(res, content, extra = {}) {
  return res.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: ephemeralData(content, extra),
  });
}

function deferEphemeral(res) {
  return res.json({
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    data: { flags: MessageFlags.EPHEMERAL },
  });
}

function updateEphemeral(res, content, extra = {}) {
  return res.json({
    type: InteractionResponseType.UPDATE_MESSAGE,
    data: ephemeralData(content, { components: [], ...extra }),
  });
}

async function editEphemeral(token, content, extra = {}) {
  await editInteractionResponse(token, ephemeralData(content, { components: [], ...extra }));
}

async function resolveSearchResponse(payload, query) {
  try {
    const items = await searchMovies(query);
    if (!items.length) {
      await editEphemeral(payload.token, `Tidak ada film yang cocok untuk **${query}**.`);
      return;
    }

    await editInteractionResponse(
      payload.token,
      buildPickerResponse(`Hasil pencarian untuk **${query}**`, items, "movie_select"),
    );
  } catch (error) {
    await editEphemeral(payload.token, `Gagal cari film: ${error.message}`);
  }
}

async function resolveLatestResponse(payload) {
  try {
    const items = await latestMovies();
    await editInteractionResponse(payload.token, buildLatestResponse(items));
  } catch (error) {
    await editEphemeral(payload.token, `Gagal ambil latest: ${error.message}`);
  }
}

export async function handlePing(res) {
  return respondEphemeral(res, "Bot aktif.");
}

export async function handleStatus(payload, res) {
  const guildId = payload.guild_id;
  const current = guildId ? await getGuildChannel(guildId) : null;

  return respondEphemeral(
    res,
    current
      ? `Channel notifikasi saat ini: <#${current.channelId}>`
      : "Belum ada channel notifikasi yang diset untuk server ini.",
  );
}

export async function handleSetChannel(payload, options, res) {
  if (!payload.guild_id) {
    return respondEphemeral(res, "Command ini hanya bisa dipakai di server.");
  }

  const channelId = getChannelOption(options, "channel");
  if (!channelId) {
    return respondEphemeral(res, "Channel tidak valid.");
  }

  await setGuildChannel({
    guildId: payload.guild_id,
    channelId: String(channelId),
  });

  return respondEphemeral(res, `Channel notifikasi diset ke <#${channelId}>.`);
}

export function handleSearch(payload, options, res, waitUntil) {
  const query = getStringOption(options, "query");
  if (!query) {
    return respondEphemeral(res, "Isi query film dulu.");
  }

  deferEphemeral(res);
  return waitUntil(resolveSearchResponse(payload, query));
}

export function handleLatest(payload, res, waitUntil) {
  deferEphemeral(res);
  return waitUntil(resolveLatestResponse(payload));
}

export async function handleMovieSelect(payload, res) {
  const movieId = String(payload?.data?.values?.[0] || "").trim();
  if (!movieId) {
    return updateEphemeral(res, "Pilihan film tidak valid.");
  }

  const movie = await getMovieById(movieId);
  return res.json({
    type: InteractionResponseType.UPDATE_MESSAGE,
    data: buildMovieResponse(movie),
  });
}
