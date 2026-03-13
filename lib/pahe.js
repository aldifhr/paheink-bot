import { PAHE_BASE_URL } from "./constants.js";
import { decodeHtmlEntities, stripHtml, unwrapTrackingUrl } from "./html.js";

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
    .find((line) => /\b(480p|720p|1080p|2160p|x264|x265|HDR|DD)/i.test(line)) ?? "Download";
}

function extractDownloadGroups(renderedContent) {
  const blocks = String(renderedContent || "").split(/<div class="box download/i).slice(1);

  return blocks
    .map((fragment) => {
      const blockHtml = `<div class="box download${fragment}`;
      const heading = normalizeHeading(blockHtml);
      const links = extractLinks(blockHtml).filter((item) =>
        /^(1F|GD|MG|VF|PD|1D|MP|OD|KR|DL)/i.test(item.label),
      );

      if (!links.length) {
        return null;
      }

      return { heading, links };
    })
    .filter(Boolean);
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
    year: firstMatch(content, /<span class="imdbwp__title">[\s\S]*?<\/span>\s*\(([^)]+)\)/i),
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

export async function latestMovies() {
  const posts = await fetchJson("/wp-json/wp/v2/posts", {
    per_page: 20,
    orderby: "date",
    order: "desc",
  });

  return posts.filter(isSupportedPost).slice(0, 10).map(parseMoviePost);
}

export async function getMovieById(id) {
  const post = await fetchJson(`/wp-json/wp/v2/posts/${id}`);
  if (!isSupportedPost(post)) {
    throw new Error("Post yang dipilih tidak didukung");
  }

  return parseMoviePost(post);
}
