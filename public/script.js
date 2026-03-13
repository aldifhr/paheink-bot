const DATE_FORMATTER = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

const CRON_DEFAULTS = {
  timestamp: "Never",
  fetchedLatest: "0",
  todayCount: "0",
  queued: "0",
  notifiedMovies: "0",
  delivered: "0",
  failed: "0",
  durationMs: "-",
  newestId: "-",
  remaining: "0",
  statusText: "Never Run",
  nextRunText: "Next run: -",
};

const elements = {
  botState: document.getElementById("botState"),
  botDot: document.getElementById("botDot"),
  channelCount: document.getElementById("channelCount"),
  lastScan: document.getElementById("lastScan"),
  lastMovieId: document.getElementById("lastMovieId"),
  channelList: document.getElementById("channelList"),
  movieList: document.getElementById("movieList"),
  errorBox: document.getElementById("errorBox"),
  refreshBtn: document.getElementById("refreshBtn"),
  runCronBtn: document.getElementById("runCronBtn"),
  cronTimestamp: document.getElementById("cronTimestamp"),
  cronFetchedLatest: document.getElementById("cronFetchedLatest"),
  cronTodayCount: document.getElementById("cronTodayCount"),
  cronQueued: document.getElementById("cronQueued"),
  cronNotified: document.getElementById("cronNotified"),
  cronDelivered: document.getElementById("cronDelivered"),
  cronFailed: document.getElementById("cronFailed"),
  cronDuration: document.getElementById("cronDuration"),
  cronNewestId: document.getElementById("cronNewestId"),
  cronRemaining: document.getElementById("cronRemaining"),
  cronStatusText: document.getElementById("cronStatusText"),
  cronNextRun: document.getElementById("cronNextRun"),
};

const healthElements = {
  redis: {
    value: document.getElementById("healthRedis"),
    hint: document.getElementById("healthRedisHint"),
  },
  pahe: {
    value: document.getElementById("healthPahe"),
    hint: document.getElementById("healthPaheHint"),
  },
  discord: {
    value: document.getElementById("healthDiscord"),
    hint: document.getElementById("healthDiscordHint"),
  },
};

const cronMetricElements = {
  timestamp: elements.cronTimestamp,
  fetchedLatest: elements.cronFetchedLatest,
  todayCount: elements.cronTodayCount,
  queued: elements.cronQueued,
  notifiedMovies: elements.cronNotified,
  delivered: elements.cronDelivered,
  failed: elements.cronFailed,
  durationMs: elements.cronDuration,
  newestId: elements.cronNewestId,
  remaining: elements.cronRemaining,
};

function formatDate(value) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${DATE_FORMATTER.format(date)} WIB`;
}

function inferKind(title) {
  return /season|episode|eps|complete/i.test(String(title || "")) ? "Series" : "Movie";
}

function setText(target, value, fallback = "-") {
  target.textContent = value == null || value === "" ? fallback : String(value);
}

function safeUrl(value, fallback = "#") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;

  try {
    const url = new URL(raw, window.location.origin);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {}

  return fallback;
}

function createElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = String(text);
  return node;
}

function renderEmptyState(target, message) {
  target.innerHTML = `<div class="row"><span class="muted">${message}</span></div>`;
}

function setBotState(mode, label) {
  elements.botDot.classList.remove("offline", "degraded");
  if (mode === "error") {
    elements.botDot.classList.add("offline");
  } else if (mode === "degraded") {
    elements.botDot.classList.add("degraded");
  }
  elements.botState.textContent = label;
}

function renderChannels(channels = []) {
  elements.channelList.innerHTML = "";
  if (!channels.length) {
    renderEmptyState(elements.channelList, "Belum ada channel notifikasi yang tersimpan.");
    return;
  }

  for (const item of channels) {
    const row = createElement("div", "row");
    const left = createElement("span");
    left.append("Guild ");
    left.appendChild(createElement("strong", "", item.guildId || "-"));
    const right = createElement("span", "muted", item.channelId ? `#${item.channelId}` : "-");
    row.append(left, right);
    elements.channelList.appendChild(row);
  }
}

function createMovieCard(movie) {
  const card = createElement("article", "movie");
  const inner = createElement("div", "movie-inner");
  const body = createElement("div", "movie-body");
  const head = createElement("div", "movie-head");
  const meta = createElement("div", "movie-meta");
  const kind = inferKind(movie.title);

  const img = document.createElement("img");
  img.src = safeUrl(movie.poster, "https://placehold.co/600x800/e7dcc9/3f3a35?text=No+Poster");
  img.alt = String(movie.title || "No title");

  head.append(
    createElement("h3", "", movie.title || "Untitled"),
    createElement("span", `pill ${kind.toLowerCase()}`, kind),
  );

  meta.append(
    createElement("span", "pill", `Year ${movie.year || "N/A"}`),
    createElement("span", "pill", `IMDb ${movie.rating || "N/A"}`),
  );

  const link = createElement("a", "button movie-link", "Open Post");
  link.href = safeUrl(movie.link);
  link.target = "_blank";
  link.rel = "noreferrer";

  body.append(head, meta, link);
  inner.append(img, body);
  card.appendChild(inner);
  return card;
}

function renderMovies(movies = []) {
  elements.movieList.innerHTML = "";
  if (!movies.length) {
    renderEmptyState(elements.movieList, "Belum ada preview title.");
    return;
  }

  for (const movie of movies) {
    elements.movieList.appendChild(createMovieCard(movie));
  }
}

function renderCronStatus(status) {
  if (!status) {
    setText(cronMetricElements.timestamp, CRON_DEFAULTS.timestamp);
    setText(cronMetricElements.fetchedLatest, CRON_DEFAULTS.fetchedLatest);
    setText(cronMetricElements.todayCount, CRON_DEFAULTS.todayCount);
    setText(cronMetricElements.queued, CRON_DEFAULTS.queued);
    setText(cronMetricElements.notifiedMovies, CRON_DEFAULTS.notifiedMovies);
    setText(cronMetricElements.delivered, CRON_DEFAULTS.delivered);
    setText(cronMetricElements.failed, CRON_DEFAULTS.failed);
    setText(cronMetricElements.durationMs, CRON_DEFAULTS.durationMs);
    setText(cronMetricElements.newestId, CRON_DEFAULTS.newestId);
    setText(cronMetricElements.remaining, CRON_DEFAULTS.remaining);
    setText(elements.cronStatusText, CRON_DEFAULTS.statusText);
    setText(elements.cronNextRun, CRON_DEFAULTS.nextRunText);
    return;
  }

  setText(cronMetricElements.timestamp, formatDate(status.timestamp));
  setText(cronMetricElements.fetchedLatest, status.fetchedLatest ?? 0);
  setText(cronMetricElements.todayCount, status.todayCount ?? 0);
  setText(cronMetricElements.queued, status.queued ?? 0);
  setText(cronMetricElements.notifiedMovies, status.notifiedMovies ?? 0);
  setText(cronMetricElements.delivered, status.delivered ?? 0);
  setText(cronMetricElements.failed, status.failed ?? 0);
  setText(cronMetricElements.durationMs, status.durationMs != null ? `${status.durationMs} ms` : "-");
  setText(cronMetricElements.newestId, status.newestId || "-");
  setText(cronMetricElements.remaining, status.remaining ?? 0);
  setText(elements.cronStatusText, status.ok === false ? "Error" : "Healthy");
}

function renderHealth(statusMap = {}) {
  for (const [key, refs] of Object.entries(healthElements)) {
    const status = statusMap[key];
    const ok = Boolean(status?.ok);
    refs.value.textContent = ok ? "OK" : "Error";
    refs.value.className = `health-state ${ok ? "ok" : "fail"}`;
    refs.hint.textContent = status?.label || "-";
  }
}

function renderSchedule(schedule) {
  if (!schedule?.nextRunAt) {
    setText(elements.cronNextRun, CRON_DEFAULTS.nextRunText);
    return;
  }

  const intervalText = schedule.intervalMinutes ? ` (${schedule.intervalMinutes}m)` : "";
  setText(elements.cronNextRun, `Next run: ${formatDate(schedule.nextRunAt)}${intervalText}`);
}

function setError(message) {
  setText(elements.cronNextRun, CRON_DEFAULTS.nextRunText);
  elements.errorBox.textContent = message;
  elements.errorBox.style.display = "block";
}

function clearError() {
  elements.errorBox.style.display = "none";
  elements.errorBox.textContent = "";
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }

  return data;
}

function applySummary(summary = {}) {
  setText(elements.channelCount, summary.channelCount ?? 0);
  setText(elements.lastScan, formatDate(summary.lastScanAt));
  setText(elements.lastMovieId, summary.lastNotifiedMovieId || "None");
}

function deriveBotState(health = {}, cronStatus) {
  const services = Object.values(health);
  const hasFailures = services.some((item) => !item?.ok);
  const hasCron = Boolean(cronStatus);

  if (!hasCron) {
    return { mode: hasFailures ? "degraded" : "ok", label: "Awaiting First Run" };
  }

  return {
    mode: hasFailures ? "degraded" : "ok",
    label: hasFailures ? "Degraded" : "Healthy",
  };
}

async function runCronNow() {
  const secret = window.prompt("Masukkan CRON_SECRET untuk jalankan cron sekarang:");
  if (!secret) return;

  elements.runCronBtn.disabled = true;
  elements.runCronBtn.textContent = "Running...";
  clearError();

  try {
    await fetchJson("/api/cron", {
      method: "GET",
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
    await loadDashboard();
  } catch (error) {
    setError(error.message);
  } finally {
    elements.runCronBtn.disabled = false;
    elements.runCronBtn.textContent = "Run Cron Now";
  }
}

async function loadDashboard() {
  clearError();
  setBotState("loading", "Refreshing");

  try {
    const data = await fetchJson("/api/dashboard", { cache: "no-store" });
    const bot = deriveBotState(data.health, data.cronStatus);

    setBotState(bot.mode, bot.label);
    applySummary(data.summary);
    renderCronStatus(data.cronStatus);
    renderSchedule(data.schedule);
    renderHealth(data.health);
    renderChannels(data.channels);
    renderMovies(data.latest);
  } catch (error) {
    setBotState("error", "Error");
    setError(error.message);
  }
}

elements.refreshBtn.addEventListener("click", loadDashboard);
elements.runCronBtn.addEventListener("click", runCronNow);
loadDashboard();
