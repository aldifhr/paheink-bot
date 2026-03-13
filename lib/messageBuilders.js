import { MessageFlags } from "./constants.js";

function truncate(input, limit) {
  const text = String(input || "").trim();
  if (!text) return null;
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 3)}...`;
}

function formatLinks(links) {
  return links.map((item) => `[${item.label}](${item.href})`).join(" ");
}

function buildDownloadLines(downloads) {
  const lines = [];

  for (const group of downloads.slice(0, 8)) {
    const line = `• **${truncate(group.heading, 80)}**\n${formatLinks(group.links.slice(0, 8))}`;
    if ((lines.join("\n\n") + "\n\n" + line).length > 1700) {
      break;
    }
    lines.push(line);
  }

  return lines;
}

export function buildMovieEmbed(movie) {
  const description = [
    movie.synopsis,
    movie.genres ? `Genre: ${movie.genres}` : null,
    movie.runtime ? `Runtime: ${movie.runtime}` : null,
    movie.releaseDate ? `Rilis: ${movie.releaseDate}` : null,
    movie.director ? `Director: ${movie.director}` : null,
    movie.actors ? `Actors: ${movie.actors}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    title: truncate(movie.title, 256),
    url: movie.link,
    color: 0x0ea5e9,
    author: {
      name: "Pahe.in",
      url: "https://pahe.ink",
    },
    description: truncate(description, 4000),
    thumbnail: movie.poster ? { url: movie.poster } : undefined,
    footer: {
      text: "pahe-tracker",
    },
    fields: [
      movie.year ? { name: "Year", value: movie.year, inline: true } : null,
      movie.rating ? { name: "IMDb", value: movie.rating, inline: true } : null,
      movie.imdbUrl ? { name: "IMDb Link", value: `[Open IMDb](${movie.imdbUrl})`, inline: true } : null,
    ].filter(Boolean),
  };
}

export function buildMovieResponse(movie) {
  const downloadLines = buildDownloadLines(movie.downloads);
  const content = [
    `**${movie.title}**`,
    movie.link,
    downloadLines.length ? "" : "Link download belum berhasil diparse dari post ini.",
    ...downloadLines,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    flags: MessageFlags.EPHEMERAL,
    content: truncate(content, 1900),
    embeds: [buildMovieEmbed(movie)],
    components: [],
  };
}

export function buildLatestResponse(items) {
  const top = items.slice(0, 5);
  const content = top.length
    ? top.map((item, index) => `${index + 1}. [${item.title}](${item.link})`).join("\n")
    : "Belum ada film atau series terbaru yang berhasil diambil.";

  return {
    flags: MessageFlags.EPHEMERAL,
    content: `**Latest dari pahe.ink**\n${truncate(content, 1800)}`,
    embeds: top.map((item) => buildMovieEmbed(item)),
    components: [],
  };
}

export function buildNotificationMessage(movie) {
  const baseEmbed = buildMovieEmbed(movie);
  const qualitySummary = movie.downloads
    .slice(0, 5)
    .map((item) => item.heading)
    .filter(Boolean)
    .join("\n");

  return {
    content: `Film baru dari pahe.ink: **${movie.title}**`,
    embeds: [
      {
        ...baseEmbed,
        fields: [
          ...baseEmbed.fields,
          qualitySummary
            ? {
                name: "Available",
                value: truncate(qualitySummary, 1024),
                inline: false,
              }
            : null,
        ].filter(Boolean),
      },
    ],
  };
}

export function buildPickerResponse(title, items, customId) {
  const options = items.slice(0, 10).map((item) => ({
    label: truncate(item.title, 100),
    value: item.id,
    description: truncate(
      [item.year, item.rating ? `IMDb ${item.rating}` : null].filter(Boolean).join(" • ") || "Open detail",
      100,
    ),
  }));

  return {
    flags: MessageFlags.EPHEMERAL,
    content: title,
    components: [
      {
        type: 1,
        components: [
          {
            type: 3,
            custom_id: customId,
            placeholder: "Pilih film",
            options,
          },
        ],
      },
    ],
  };
}
