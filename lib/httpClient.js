function parseRetryAfterMs(retryAfterHeader) {
  if (!retryAfterHeader) return null;
  const raw = String(retryAfterHeader).trim();
  const asSeconds = Number(raw);
  if (Number.isFinite(asSeconds)) return Math.max(0, asSeconds * 1000);
  const asDate = Date.parse(raw);
  if (Number.isFinite(asDate)) return Math.max(0, asDate - Date.now());
  return null;
}

function shouldRetry(status) {
  if (!status) return true;
  return new Set([408, 425, 429, 500, 502, 503, 504]).has(status);
}

export async function fetchWithRetry(url, init = {}, options = {}) {
  const retries = Number.isFinite(options.retries) ? options.retries : 3;
  const baseDelayMs = Number.isFinite(options.baseDelayMs) ? options.baseDelayMs : 350;
  const maxDelayMs = Number.isFinite(options.maxDelayMs) ? options.maxDelayMs : 6000;
  const jitterMs = Number.isFinite(options.jitterMs) ? options.jitterMs : 200;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const response = await fetch(url, init);
    if (response.ok) {
      return response;
    }

    if (attempt === retries || !shouldRetry(response.status)) {
      const text = await response.text();
      throw new Error(text || `HTTP ${response.status}`);
    }

    const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
    const backoff = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
    const jitter = Math.floor(Math.random() * jitterMs);
    const delayMs = Math.max(retryAfterMs ?? 0, backoff) + jitter;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error("fetchWithRetry exhausted retries");
}
