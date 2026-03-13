import { MessageFlags } from "./constants.js";

function truncate(input, limit) {
  const text = String(input || "").trim();
  if (!text) return null;
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 3)}...`;
}

function ratingStars(rating) {
  const num = Number.parseFloat(String(rating || ""));
  if (Number.isNaN(num)) {
    return "N/A";
  }

  const filled = Math.max(0, Math.min(5, Math.round(num / 2)));
  const stars = "?".repeat(filled) + "?".repeat(5 - filled);
  return `${stars} ${num.toFixed(1)}/10`;
}

function inferKind(title) {
  const text = String(title || "").toLowerCase();
  if (/season|episode|eps|complete/.test(text)) {
    return "Series";
  }
  return "Movie";
}

function formatLinks(links) {
  return links.map((item) => `[${item.label}](${item.href})`).join(" ");
}

function splitHeadingParts(heading) {
  const text = String(heading || "")
    .replace(/\s+/g, " ")
    .replace(/\s*\|\s*/g, " | ")
    .trim();

  if (!text) {
    return [];
  }

  const marked = text
    .replace(/\s*(Episode\s+\d+)/gi, "\n$1")
    .replace(/\s*(Batch\s+\d)/gi, "\n$1")
    .replace(/\s*(Per Episode)/gi, "\n$1")
    .replace(/\s*(Source:)/gi, "\n$1")
    .replace(/\s+(?=(?:480p|720p|1080p|2160p)\s+x26[45])/gi, "\n");

  return marked
    .split("\n")
    .map((part) => part.trim())
    .filter(Boolean);
}

function formatDownloadHeading(heading, { compact = false } = {}) {
  const parts = splitHeadingParts(heading);
  if (!parts.length) {
    return "Download";
  }

  if (compact) {
    const primary = [];
    const extras = [];

    for (const part of parts) {
      if (/^Source:/i.test(part)) {
        extras.push(part);
        continue;
      }

      primary.push(part);
    }

    const firstLine = truncate(primary.slice(0, 4).join(" • "), 220);
    const extraLine = extras.length ? truncate(extras[0], 120) : null;
    return [firstLine, extraLine].filter(Boolean).join("\n");
  }

  return parts
    .map((part) => (/^(Episode\s+\d+|Batch|Per Episode|Source:)/i.test(part) ? `**${part}**` : part))
    .join("\n");
}

function buildDownloadLines(downloads, { compact = false } = {}) {
  const lines = [];
  const groupLimit = compact ? 3 : 6;
  const linkLimit = compact ? 5 : 8;

  for (const group of downloads.slice(0, groupLimit)) {
    const heading = formatDownloadHeading(group.heading, { compact });
    const hosts = formatLinks(group.links.slice(0, linkLimit));
    const line = compact ? heading : `${heading}\n${hosts}`;

    if ((lines.join("\n\n") + "\n\n" + line).length > 900) {
      break;
    }

    lines.push(line);
  }

  return lines;
}

function buildInfoValue(movie, { compact = false } = {}) {
  const parts = [
    movie.genres ? `Genre: ${movie.genres}` : null,
    movie.runtime ? `Runtime: ${movie.runtime}` : null,
    movie.releaseDate ? `Release: ${movie.releaseDate}` : null,
  ].filter(Boolean);

  if (!parts.length) return null;
  return truncate(parts.join("\n"), compact ? 240 : 1024);
}

function buildCreditsValue(movie, { compact = false } = {}) {
  const parts = [
    movie.director ? `Director: ${movie.director}` : null,
    movie.actors ? `Cast: ${movie.actors}` : null,
  ].filter(Boolean);

  if (!parts.length) return null;
  return truncate(parts.join("\n"), compact ? 240 : 1024);
}

function buildLinksValue(movie) {
  const links = [`[Pahe Post](${movie.link})`];
  if (movie.imdbUrl) {
    links.push(`[IMDb](${movie.imdbUrl})`);
  }
  return links.join(" • ");
}

function formatEmbedTitle(movie) {
  const kind = inferKind(movie.title);
  const prefix = kind === "Series" ? "[Series]" : "[Movie]";
  return truncate(`${prefix} ${movie.title}`, 256);
}

function buildBaseFields(movie, { compact = false } = {}) {
  const fields = [
    {
      name: "Type",
      value: inferKind(movie.title),
      inline: true,
    },
    movie.year
      ? {
          name: "Year",
          value: movie.year,
          inline: true,
        }
      : null,
    movie.rating
      ? {
          name: "IMDb",
          value: ratingStars(movie.rating),
          inline: true,
        }
      : null,
  ].filter(Boolean);

  const infoValue = buildInfoValue(movie, { compact });
  if (infoValue) {
    fields.push({
      name: "Info",
      value: infoValue,
      inline: compact,
    });
  }

  const creditsValue = buildCreditsValue(movie, { compact });
  if (creditsValue && !compact) {
    fields.push({
      name: "Credits",
      value: creditsValue,
      inline: false,
    });
  }

  fields.push({
    name: "Links",
    value: buildLinksValue(movie),
    inline: false,
  });

  return fields;
}

export function buildMovieEmbed(movie, options = {}) {
  const compact = Boolean(options.compact);
  const description = truncate(movie.synopsis, compact ? 220 : 700);
  const fields = buildBaseFields(movie, { compact });
  const downloadLines = buildDownloadLines(movie.downloads || [], { compact });

  if (downloadLines.length) {
    fields.push({
      name: compact ? "Available" : "Download Options",
      value: truncate(downloadLines.join(compact ? "\n\n" : "\n\n"), 1024),
      inline: false,
    });
  }

  return {
    title: formatEmbedTitle(movie),
    url: movie.link,
    color: inferKind(movie.title) === "Series" ? 0x22c55e : 0x0ea5e9,
    author: {
      name: "Pahe.in Release Feed",
      url: "https://pahe.ink",
    },
    description,
    thumbnail: movie.poster ? { url: movie.poster } : undefined,
    footer: {
      text: compact ? "pahe-tracker latest" : "pahe-tracker",
    },
    timestamp: movie.publishedAt || undefined,
    fields,
  };
}

export function buildMovieResponse(movie) {
  return {
    flags: MessageFlags.EPHEMERAL,
    content: `Post: ${movie.link}`,
    embeds: [buildMovieEmbed(movie)],
    components: [],
  };
}

export function buildLatestResponse(items) {
  const top = items.slice(0, 10);

  return {
    flags: MessageFlags.EPHEMERAL,
    content: undefined,
    embeds: top.map((item) => buildMovieEmbed(item, { compact: true })),
    components: [],
  };
}

export function buildNotificationMessage(movie) {
  const kind = inferKind(movie.title);
  return {
    content: `${kind} baru dari pahe.ink: **${movie.title}**`,
    embeds: [buildMovieEmbed(movie, { compact: true })],
  };
}

export function buildPickerResponse(title, items, customId) {
  const options = items.slice(0, 10).map((item) => ({
    label: truncate(item.title, 100),
    value: item.id,
    description: truncate(
      [inferKind(item.title), item.year, item.rating ? `IMDb ${item.rating}` : null].filter(Boolean).join(" • ") || "Open detail",
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
            placeholder: "Pilih judul",
            options,
          },
        ],
      },
    ],
  };
}

