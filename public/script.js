const botState = document.getElementById("botState");
const botDot = document.getElementById("botDot");
const channelCount = document.getElementById("channelCount");
const lastScan = document.getElementById("lastScan");
const lastMovieId = document.getElementById("lastMovieId");
const channelList = document.getElementById("channelList");
const movieList = document.getElementById("movieList");
const errorBox = document.getElementById("errorBox");
const refreshBtn = document.getElementById("refreshBtn");
const runCronBtn = document.getElementById("runCronBtn");
const cronTimestamp = document.getElementById("cronTimestamp");
const cronFetchedLatest = document.getElementById("cronFetchedLatest");
const cronTodayCount = document.getElementById("cronTodayCount");
const cronQueued = document.getElementById("cronQueued");
const cronNotified = document.getElementById("cronNotified");
const cronDelivered = document.getElementById("cronDelivered");
const cronFailed = document.getElementById("cronFailed");
const cronDuration = document.getElementById("cronDuration");
const cronNewestId = document.getElementById("cronNewestId");
const cronRemaining = document.getElementById("cronRemaining");
const cronStatusText = document.getElementById("cronStatusText");
const cronNextRun = document.getElementById("cronNextRun");
const healthRedis = document.getElementById("healthRedis");
const healthRedisHint = document.getElementById("healthRedisHint");
const healthPahe = document.getElementById("healthPahe");
const healthPaheHint = document.getElementById("healthPaheHint");
const healthDiscord = document.getElementById("healthDiscord");
const healthDiscordHint = document.getElementById("healthDiscordHint");

function formatDate(value) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta"
  }).format(date) + " WIB";
}

function inferKind(title) {
  return /season|episode|eps|complete/i.test(String(title || "")) ? "Series" : "Movie";
}

function inferKindClass(title) {
  return inferKind(title).toLowerCase();
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

function setBotState(mode, label) {
  botDot.classList.remove("offline", "degraded");
  if (mode === "error") {
    botDot.classList.add("offline");
  } else if (mode === "degraded") {
    botDot.classList.add("degraded");
  }
  botState.textContent = label;
}

function renderChannels(channels) {
  channelList.innerHTML = "";
  if (!channels.length) {
    channelList.innerHTML = '<div class="row"><span class="muted">Belum ada channel notifikasi yang tersimpan.</span></div>';
    return;
  }

  for (const item of channels) {
    const row = createElement("div", "row");
    const left = createElement("span");
    left.append("Guild ");
    left.appendChild(createElement("strong", "", item.guildId || "-"));
    const right = createElement("span", "muted", item.channelId ? `#${item.channelId}` : "-");
    row.append(left, right);
    channelList.appendChild(row);
  }
}

function renderMovies(movies) {
  movieList.innerHTML = "";
  if (!movies.length) {
    movieList.innerHTML = '<div class="row"><span class="muted">Belum ada preview title.</span></div>';
    return;
  }

  for (const movie of movies) {
    const card = createElement("article", "movie");
    const inner = createElement("div", "movie-inner");
    const img = document.createElement("img");
    img.src = safeUrl(movie.poster, "https://placehold.co/600x800/e7dcc9/3f3a35?text=No+Poster");
    img.alt = String(movie.title || "No title");

    const body = createElement("div", "movie-body");
    const head = createElement("div", "movie-head");
    const title = createElement("h3", "", movie.title || "Untitled");
    const kind = createElement("span", `pill ${inferKindClass(movie.title)}`, inferKind(movie.title));
    head.append(title, kind);

    const meta = createElement("div", "movie-meta");
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
    movieList.appendChild(card);
  }
}

function renderCronStatus(status) {
  if (!status) {
    setText(cronTimestamp, "Never");
    setText(cronFetchedLatest, "0");
    setText(cronTodayCount, "0");
    setText(cronQueued, "0");
    setText(cronNotified, "0");
    setText(cronDelivered, "0");
    setText(cronFailed, "0");
    setText(cronDuration, "-");
    setText(cronNewestId, "-");
    setText(cronRemaining, "0");
    setText(cronStatusText, "Never Run");
    setText(cronNextRun, "Next run: -");
    return;
  }

  cronTimestamp.textContent = formatDate(status?.timestamp);
  cronFetchedLatest.textContent = String(status?.fetchedLatest ?? 0);
  cronTodayCount.textContent = String(status?.todayCount ?? 0);
  cronQueued.textContent = String(status?.queued ?? 0);
  cronNotified.textContent = String(status?.notifiedMovies ?? 0);
  cronDelivered.textContent = String(status?.delivered ?? 0);
  cronFailed.textContent = String(status?.failed ?? 0);
  cronDuration.textContent = status?.durationMs != null ? `${status.durationMs} ms` : "-";
  cronNewestId.textContent = status?.newestId || "-";
  cronRemaining.textContent = String(status?.remaining ?? 0);
  cronStatusText.textContent = status?.ok === false ? "Error" : "Healthy";
}

function renderHealthItem(target, hintTarget, status) {
  const ok = Boolean(status?.ok);
  target.textContent = ok ? "OK" : "Error";
  target.className = `health-state ${ok ? "ok" : "fail"}`;
  hintTarget.textContent = status?.label || "-";
}

function renderSchedule(schedule) {
  if (!schedule?.nextRunAt) {
    cronNextRun.textContent = "Next run: -";
    return;
  }

  const intervalText = schedule?.intervalMinutes ? ` (${schedule.intervalMinutes}m)` : "";
  cronNextRun.textContent = `Next run: ${formatDate(schedule.nextRunAt)}${intervalText}`;
}

async function runCronNow() {
  const secret = window.prompt("Masukkan CRON_SECRET untuk jalankan cron sekarang:");
  if (!secret) return;

  runCronBtn.disabled = true;
  runCronBtn.textContent = "Running...";
  errorBox.style.display = "none";

  try {
    const response = await fetch("/api/cron", {
      method: "GET",
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store"
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Cron run failed");
    }

    await loadDashboard();
  } catch (error) {
    cronNextRun.textContent = "Next run: -";
    errorBox.textContent = error.message;
    errorBox.style.display = "block";
  } finally {
    runCronBtn.disabled = false;
    runCronBtn.textContent = "Run Cron Now";
  }
}

async function loadDashboard() {
  errorBox.style.display = "none";
  setBotState("loading", "Refreshing");

  try {
    const response = await fetch("/api/dashboard", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Failed to load dashboard");
    }

    const services = [data.health?.redis, data.health?.pahe, data.health?.discord];
    const okCount = services.filter((item) => item?.ok).length;
    const hasFailures = okCount < services.length;
    const hasCron = Boolean(data.cronStatus);
    setBotState(hasFailures ? "degraded" : "ok", hasCron ? (hasFailures ? "Degraded" : "Healthy") : "Awaiting First Run");
    channelCount.textContent = String(data.summary.channelCount ?? 0);
    lastScan.textContent = formatDate(data.summary.lastScanAt);
    lastMovieId.textContent = data.summary.lastNotifiedMovieId || "None";
    renderCronStatus(data.cronStatus || null);
    renderSchedule(data.schedule || null);
    renderHealthItem(healthRedis, healthRedisHint, data.health?.redis);
    renderHealthItem(healthPahe, healthPaheHint, data.health?.pahe);
    renderHealthItem(healthDiscord, healthDiscordHint, data.health?.discord);
    renderChannels(data.channels || []);
    renderMovies(data.latest || []);
  } catch (error) {
    setBotState("error", "Error");
    cronNextRun.textContent = "Next run: -";
    errorBox.textContent = error.message;
    errorBox.style.display = "block";
  }
}

refreshBtn.addEventListener("click", loadDashboard);
runCronBtn.addEventListener("click", runCronNow);
loadDashboard();
