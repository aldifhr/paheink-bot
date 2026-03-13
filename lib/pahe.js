import { PAHE_BASE_URL } from "./constants.js";
import { decodeHtmlEntities, stripHtml, unwrapTrackingUrl } from "./html.js";

const PAHE_TIMEOUT_MS = 12000;

function isSupportedPost(post) {
  const title = decodeHtmlEntities(post?.title?.rendered || "").trim();
  const link = String(post?.link || "").trim();
  const classes = Array.isArray(post?.class_list) ? post.class_list : [];

  if (!title || !link) {
    return false;
  }

  const blockedCategories = ["category-anime", "category-tv-anime"];
  if (classes.some((item) => blockedCategories.includes(String(item)))) {
    return false;
  }

  return true;
}

async function fetchJson(pathname, params = {}) {
  const url = new URL(pathname, PAHE_BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "pahe-tracker/1.0",
    },
    signal: AbortSignal.timeout(PAHE_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Pahe request failed: ${response.status}`);
  }

  return response.json();
}

function firstMatch(input, pattern) {
  const match = String(input || "").match(pattern);
  return match?.[1] ? decodeHtmlEntities(match[1]).trim() : null;
}

function normalizeYear(value) {
  const text = decodeHtmlEntities(String(value || ""))
    .replace(/[\u2012\u2013\u2014\u2212]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) {
    return null;
  }

  const closedRange = text.match(/\b(\d{4})\s*[-/]\s*(\d{2,4}|present)\b/i);
  if (closedRange) {
    return `${closedRange[1]}-${closedRange[2]}`;
  }

  const openRange = text.match(/\b(\d{4})\s*[-/]\s*$/);
  if (openRange) {
    return `${openRange[1]}-`;
  }

  const singleYear = text.match(/\b(\d{4})\b/);
  if (singleYear) {
    return singleYear[1];
  }

  return text;
}

function extractFooterField(html, label) {
  return firstMatch(html, new RegExp(`<strong>${label}:<\\/strong>\\s*<span>([\\s\\S]*?)<\\/span>`, "i"));
}

function extractMetaSpans(html) {
  const match = html.match(/<div class="imdbwp__meta">([\s\S]*?)<\/div>/i);
  if (!match) {
    return [];
  }

  return [...match[1].matchAll(/<span>([\s\S]*?)<\/span>/gi)].map((item) =>
    decodeHtmlEntities(stripHtml(item[1])),
  );
}

function extractLinks(html) {
  return [...String(html || "").matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].map(
    ([, href, label]) => ({
      href: unwrapTrackingUrl(decodeHtmlEntities(href)),
      label: stripHtml(label) || "Open",
    }),
  );
}

function normalizeTextValue(value) {
  return decodeHtmlEntities(String(value || ""))
    .replace(/&nbsp;/gi, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHeading(html) {
  const cleaned = stripHtml(
    String(html || "")
      .replace(/<a[\s\S]*?<\/a>/gi, "")
      .replace(/&nbsp;/gi, " "),
  );

  return cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .find((line) => /\b(Episode\s+\d+|480p|720p|1080p|2160p|x264|x265|HDR|DD)/i.test(line)) ?? "Download";
}

function parseDownloadLines(blockHtml) {
  const sanitizedHtml = String(blockHtml || "")
    .replace(/<(?!a\b|\/a\b|br\b)[^>]+>/gi, " ");
  const tokenPattern = /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>|<br\s*\/?>|([^<]+)/gi;
  const lines = [];
  let current = { textParts: [], links: [] };

  function flushLine() {
    const text = normalizeTextValue(current.textParts.join(" "));
    if (text || current.links.length) {
      lines.push({ text, links: current.links });
    }
    current = { textParts: [], links: [] };
  }

  function pushText(rawText) {
    const parts = decodeHtmlEntities(String(rawText || ""))
      .replace(/&nbsp;/gi, " ")
      .replace(/\u00a0/g, " ")
      .split(/\r?\n+/);

    parts.forEach((part, index) => {
      const normalized = normalizeTextValue(part);
      if (normalized) {
        if (current.links.length && /^(Episode\s+\d+|Batch\b|Per Episode\b|Source:)/i.test(normalized)) {
          flushLine();
        }
        current.textParts.push(normalized);
      }
      if (index < parts.length - 1 && current.textParts.length > 0) {
        flushLine();
      }
    });
  }

  let match;
  while ((match = tokenPattern.exec(sanitizedHtml))) {
    if (match[1]) {
      current.links.push({
        href: unwrapTrackingUrl(decodeHtmlEntities(match[1])),
        label: stripHtml(match[2]) || "Open",
      });
      continue;
    }

    if (match[0] && /^<br/i.test(match[0])) {
      flushLine();
      continue;
    }

    if (match[3]) {
      pushText(match[3]);
    }
  }

  flushLine();
  return lines;
}

function isHostLabel(label) {
  return /^(1F|GD|MG|VF|PD|1D|MP|OD|KR|DL)/i.test(String(label || ""));
}

function extractDownloadGroupsFromBlock(blockHtml) {
  const lines = parseDownloadLines(blockHtml);
  const groups = [];
  let pendingTexts = [];

  for (const line of lines) {
    const text = normalizeTextValue(line.text);
    const links = line.links.filter((item) => isHostLabel(item.label));

    if (text) {
      pendingTexts.push(text);
    }

    if (!links.length) {
      continue;
    }

    const heading = normalizeTextValue(pendingTexts.join(" ")) || normalizeHeading(blockHtml);
    groups.push({ heading, links });
    pendingTexts = [];
  }

  if (groups.length) {
    return groups;
  }

  const links = extractLinks(blockHtml).filter((item) => isHostLabel(item.label));
  if (!links.length) {
    return [];
  }

  return [{ heading: normalizeHeading(blockHtml), links }];
}

function extractDownloadGroups(renderedContent) {
  const blocks = String(renderedContent || "").split(/<div class="box download/i).slice(1);

  return blocks.flatMap((fragment) => {
    const blockHtml = `<div class="box download${fragment}`;
    return extractDownloadGroupsFromBlock(blockHtml);
  });
}

function pickExcerpt(post) {
  const excerpt = stripHtml(post?.excerpt?.rendered);
  if (excerpt) {
    return excerpt;
  }

  return firstMatch(post?.content?.rendered, /<div class="imdbwp__teaser">([\s\S]*?)<\/div>/i);
}

export function parseMoviePost(post) {
  const content = String(post?.content?.rendered || "");
  const meta = extractMetaSpans(content);

  return {
    id: String(post.id),
    title: decodeHtmlEntities(post?.title?.rendered || "Untitled"),
    link: post?.link || `${PAHE_BASE_URL}/?p=${post?.id ?? ""}`,
    publishedAt: post?.date_gmt || post?.date || null,
    year: normalizeYear(firstMatch(content, /<span class="imdbwp__title">[\s\S]*?<\/span>\s*\(([^)]+)\)/i)),
    poster: firstMatch(content, /class="imdbwp__img" src="([^"]+)"/i),
    imdbUrl: firstMatch(content, /class="imdbwp__link"[^>]*href="([^"]+)"/i),
    rating: firstMatch(content, /<span class="imdbwp__star">([^<]+)<\/span>/i),
    runtime: meta[0] ?? null,
    genres: meta[1] ?? null,
    releaseDate: meta[2] ?? null,
    synopsis: pickExcerpt(post),
    director: extractFooterField(content, "Director"),
    creator: extractFooterField(content, "Creator"),
    actors: extractFooterField(content, "Actors"),
    downloads: extractDownloadGroups(content),
  };
}

export async function searchMovies(query) {
  const posts = await fetchJson("/wp-json/wp/v2/posts", {
    search: query,
    per_page: 10,
  });

  return posts.filter(isSupportedPost).map(parseMoviePost);
}

export async function latestMovies(limit = 10) {
  const perPage = Math.max(limit, 10);
  const posts = await fetchJson("/wp-json/wp/v2/posts", {
    per_page: perPage,
    orderby: "date",
    order: "desc",
  });

  return posts.filter(isSupportedPost).slice(0, limit).map(parseMoviePost);
}

export async function getMovieById(id) {
  const post = await fetchJson(`/wp-json/wp/v2/posts/${id}`);
  if (!isSupportedPost(post)) {
    throw new Error("Post yang dipilih tidak didukung");
  }

  return parseMoviePost(post);
}


