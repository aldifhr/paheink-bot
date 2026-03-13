const ENTITY_MAP = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'",
  nbsp: " ",
  hellip: "...",
  mdash: "-",
  ndash: "-",
};

export function decodeHtmlEntities(input) {
  return String(input || "").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity) => {
    if (entity[0] === "#") {
      const isHex = entity[1]?.toLowerCase() === "x";
      const value = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isNaN(value) ? _ : String.fromCodePoint(value);
    }

    return ENTITY_MAP[entity.toLowerCase()] ?? _;
  });
}

export function stripHtml(input) {
  return decodeHtmlEntities(String(input || ""))
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function unwrapTrackingUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return raw;

  if (/^https:\/\/href\.li\/\?/i.test(raw)) {
    return raw.replace(/^https:\/\/href\.li\/\?/i, "");
  }

  try {
    const parsed = new URL(raw);
    if (parsed.hostname === "href.li" && parsed.search) {
      return parsed.search.slice(1) || raw;
    }
  } catch {
    return raw;
  }

  return raw;
}
