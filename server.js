const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const SNAPSHOTS_FILE = path.join(DATA_DIR, "snapshots.json");
const INDICATORS_FILE = path.join(DATA_DIR, "indicators.json");

app.use(express.json({ limit: "100kb" }));
app.use(express.static(PUBLIC_DIR));

const LOCATION = {
  name: "Mumbai",
  region: "Maharashtra, India",
  latitude: 19.076,
  longitude: 72.8777
};

const DEFAULT_INDICATORS = [
  { id: "education", name: "Education access", category: "Social", value: 78, unit: "%", status: "demo", description: "Illustrative school-access score. Replace with verified local statistics.", color: "#8b9dff" },
  { id: "healthcare", name: "Healthcare access", category: "Social", value: 64, unit: "/100", status: "demo", description: "Illustrative access score; not an official health statistic.", color: "#62d6b5" },
  { id: "water", name: "Water access", category: "Infrastructure", value: 86, unit: "%", status: "demo", description: "Illustrative access score; not a live municipal reading.", color: "#67b8ff" },
  { id: "roads", name: "Road condition", category: "Infrastructure", value: 71, unit: "/100", status: "demo", description: "Illustrative condition score; not a live civic feed.", color: "#f2bd6b" }
];

function ensureFiles() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(INDICATORS_FILE)) {
    fs.writeFileSync(INDICATORS_FILE, JSON.stringify(DEFAULT_INDICATORS, null, 2));
  }
  if (!fs.existsSync(SNAPSHOTS_FILE)) {
    fs.writeFileSync(SNAPSHOTS_FILE, JSON.stringify([], null, 2));
  }
}
ensureFiles();

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return fallback; }
}
function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}
function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { "Accept": "application/json", "User-Agent": "LocalDevelopmentDashboard/1.0" }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`Data service returned HTTP ${response.status}`);
  return response.json();
}

async function fetchWeather() {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LOCATION.latitude}&longitude=${LOCATION.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&timezone=Asia%2FKolkata`;
  const json = await fetchJson(url);
  const c = json.current;
  if (!c) throw new Error("Weather response did not include current conditions");
  return {
    temperatureC: safeNumber(c.temperature_2m),
    feelsLikeC: safeNumber(c.apparent_temperature),
    humidityPercent: safeNumber(c.relative_humidity_2m),
    windKmh: safeNumber(c.wind_speed_10m),
    precipitationMm: safeNumber(c.precipitation),
    weatherCode: safeNumber(c.weather_code),
    isDay: Boolean(c.is_day),
    observedAt: c.time || null,
    timezone: json.timezone || "Asia/Kolkata",
    source: "Open-Meteo"
  };
}

async function fetchAirQuality() {
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LOCATION.latitude}&longitude=${LOCATION.longitude}&current=european_aqi,pm2_5,pm10,nitrogen_dioxide,ozone&timezone=Asia%2FKolkata`;
  const json = await fetchJson(url);
  const c = json.current;
  if (!c) throw new Error("Air quality response did not include current conditions");
  return {
    europeanAqi: safeNumber(c.european_aqi),
    pm25: safeNumber(c.pm2_5),
    pm10: safeNumber(c.pm10),
    nitrogenDioxide: safeNumber(c.nitrogen_dioxide),
    ozone: safeNumber(c.ozone),
    observedAt: c.time || null,
    source: "Open-Meteo Air Quality"
  };
}

function aqiLabel(value) {
  if (value == null) return "Unavailable";
  if (value <= 20) return "Good";
  if (value <= 40) return "Fair";
  if (value <= 60) return "Moderate";
  if (value <= 80) return "Poor";
  if (value <= 100) return "Very poor";
  return "Extremely poor";
}

async function refreshSnapshot() {
  const results = await Promise.allSettled([fetchWeather(), fetchAirQuality()]);
  const previous = readJson(SNAPSHOTS_FILE, []);
  const oldLatest = previous[previous.length - 1] || {};
  const weather = results[0].status === "fulfilled" ? results[0].value : oldLatest.weather || null;
  const airQuality = results[1].status === "fulfilled" ? results[1].value : oldLatest.airQuality || null;
  const errors = [];
  if (results[0].status === "rejected") errors.push(`Weather: ${results[0].reason.message}`);
  if (results[1].status === "rejected") errors.push(`Air quality: ${results[1].reason.message}`);

  const snapshot = {
    id: Date.now(),
    fetchedAt: new Date().toISOString(),
    location: LOCATION,
    weather,
    airQuality,
    aqiLabel: aqiLabel(airQuality?.europeanAqi ?? null),
    liveStatus: {
      weather: results[0].status === "fulfilled" ? "live" : weather ? "stale" : "unavailable",
      airQuality: results[1].status === "fulfilled" ? "live" : airQuality ? "stale" : "unavailable"
    },
    errors
  };

  // Save a bounded history so charts survive a server restart without growing forever.
  const history = [...previous, snapshot].slice(-500);
  writeJson(SNAPSHOTS_FILE, history);
  return snapshot;
}

function getLatestSnapshot() {
  const snapshots = readJson(SNAPSHOTS_FILE, []);
  return snapshots[snapshots.length - 1] || null;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, app: "Local Development Dashboard", node: process.version, timestamp: new Date().toISOString() });
});

app.get("/api/dashboard", async (_req, res) => {
  let latest = getLatestSnapshot();
  const isFresh = latest && (Date.now() - new Date(latest.fetchedAt).getTime() < 10 * 60 * 1000);
  if (!isFresh) {
    try { latest = await refreshSnapshot(); }
    catch (error) { console.error("Refresh error:", error.message); }
  }
  const snapshots = readJson(SNAPSHOTS_FILE, []);
  const indicators = readJson(INDICATORS_FILE, DEFAULT_INDICATORS);
  res.json({
    location: LOCATION,
    latest,
    history: snapshots.slice(-24).map(s => ({
      fetchedAt: s.fetchedAt,
      temperatureC: s.weather?.temperatureC ?? null,
      europeanAqi: s.airQuality?.europeanAqi ?? null
    })),
    indicators,
    api: { weather: "Open-Meteo", airQuality: "Open-Meteo Air Quality" }
  });
});

app.post("/api/refresh", async (_req, res) => {
  try {
    const snapshot = await refreshSnapshot();
    res.json({ ok: true, latest: snapshot, history: readJson(SNAPSHOTS_FILE, []).slice(-24) });
  } catch (error) {
    res.status(502).json({ ok: false, error: error.message });
  }
});

app.get("/api/indicators", (_req, res) => {
  res.json(readJson(INDICATORS_FILE, DEFAULT_INDICATORS));
});

// Update only the illustrative indicator values. The endpoint intentionally does not label these as official/live data.
app.patch("/api/indicators/:id", (req, res) => {
  const id = String(req.params.id);
  const value = Number(req.body.value);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return res.status(400).json({ error: "value must be a number from 0 to 100" });
  }
  const indicators = readJson(INDICATORS_FILE, DEFAULT_INDICATORS);
  const index = indicators.findIndex(item => item.id === id);
  if (index < 0) return res.status(404).json({ error: "Indicator not found" });
  indicators[index].value = value;
  indicators[index].updatedAt = new Date().toISOString();
  indicators[index].status = "demo";
  writeJson(INDICATORS_FILE, indicators);
  res.json({ ok: true, indicator: indicators[index] });
});

app.get("/api/history.csv", (_req, res) => {
  const history = readJson(SNAPSHOTS_FILE, []);
  const rows = [["timestamp_ist", "temperature_c", "humidity_percent", "wind_kmh", "european_aqi", "pm25_ug_m3"]];
  for (const s of history) {
    rows.push([
      s.weather?.observedAt || s.fetchedAt,
      s.weather?.temperatureC ?? "",
      s.weather?.humidityPercent ?? "",
      s.weather?.windKmh ?? "",
      s.airQuality?.europeanAqi ?? "",
      s.airQuality?.pm25 ?? ""
    ]);
  }
  const csv = rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="mumbai-live-indicator-history.csv"');
  res.send(csv);
});

app.get("*", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "index.html")));

app.listen(PORT, () => {
  console.log(`\nLocal Development Dashboard is running: http://localhost:${PORT}`);
  console.log("Press Ctrl+C to stop.\n");
});