import { InteractionResponseType, MessageFlags } from "./constants.js";
import { editInteractionResponse } from "./discord.js";
import { latestMovies, searchMovies, getMovieById } from "./pahe.js";
import { buildMovieResponse, buildPickerResponse } from "./messageBuilders.js";
import { getGuildChannel, setGuildChannel } from "./store.js";

function getStringOption(options, name) {
  return String(options?.find((item) => item.name === name)?.value || "").trim();
}

function getChannelOption(options, name) {
  return options?.find((item) => item.name === name)?.value ?? null;
}

export async function handlePing(res) {
  return res.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      flags: MessageFlags.EPHEMERAL,
      content: "Bot aktif.",
    },
  });
}

export async function handleStatus(payload, res) {
  const guildId = payload.guild_id;
  const current = guildId ? await getGuildChannel(guildId) : null;

  return res.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      flags: MessageFlags.EPHEMERAL,
      content: current
        ? `Channel notifikasi saat ini: <#${current.channelId}>`
        : "Belum ada channel notifikasi yang diset untuk server ini.",
    },
  });
}

export async function handleSetChannel(payload, options, res) {
  if (!payload.guild_id) {
    return res.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        flags: MessageFlags.EPHEMERAL,
        content: "Command ini hanya bisa dipakai di server.",
      },
    });
  }

  const channelId = getChannelOption(options, "channel");
  if (!channelId) {
    return res.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        flags: MessageFlags.EPHEMERAL,
        content: "Channel tidak valid.",
      },
    });
  }

  await setGuildChannel({
    guildId: payload.guild_id,
    channelId: String(channelId),
  });

  return res.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      flags: MessageFlags.EPHEMERAL,
      content: `Channel notifikasi diset ke <#${channelId}>.`,
    },
  });
}

export function handleSearch(payload, options, res) {
  const query = getStringOption(options, "query");
  if (!query) {
    return res.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        flags: MessageFlags.EPHEMERAL,
        content: "Isi query film dulu.",
      },
    });
  }

  res.json({
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    data: { flags: MessageFlags.EPHEMERAL },
  });

  void (async () => {
    try {
      const items = await searchMovies(query);
      if (!items.length) {
        await editInteractionResponse(payload.token, {
          flags: MessageFlags.EPHEMERAL,
          content: `Tidak ada film yang cocok untuk **${query}**.`,
          components: [],
        });
        return;
      }

      await editInteractionResponse(
        payload.token,
        buildPickerResponse(`Hasil pencarian untuk **${query}**`, items, "movie_select"),
      );
    } catch (error) {
      await editInteractionResponse(payload.token, {
        flags: MessageFlags.EPHEMERAL,
        content: `Gagal cari film: ${error.message}`,
        components: [],
      });
    }
  })();
}

export function handleLatest(payload, res) {
  res.json({
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    data: { flags: MessageFlags.EPHEMERAL },
  });

  void (async () => {
    try {
      const items = await latestMovies();
      if (!items.length) {
        await editInteractionResponse(payload.token, {
          flags: MessageFlags.EPHEMERAL,
          content: "Belum ada film terbaru yang berhasil diambil.",
          components: [],
        });
        return;
      }

      await editInteractionResponse(
        payload.token,
        buildPickerResponse("Film terbaru dari pahe.ink", items, "movie_select"),
      );
    } catch (error) {
      await editInteractionResponse(payload.token, {
        flags: MessageFlags.EPHEMERAL,
        content: `Gagal ambil latest: ${error.message}`,
        components: [],
      });
    }
  })();
}

export async function handleMovieSelect(payload, res) {
  const movieId = String(payload?.data?.values?.[0] || "").trim();
  if (!movieId) {
    return res.json({
      type: InteractionResponseType.UPDATE_MESSAGE,
      data: {
        flags: MessageFlags.EPHEMERAL,
        content: "Pilihan film tidak valid.",
        components: [],
      },
    });
  }

  const movie = await getMovieById(movieId);
  return res.json({
    type: InteractionResponseType.UPDATE_MESSAGE,
    data: buildMovieResponse(movie),
  });
}
