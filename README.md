# Pulse — Local Development Dashboard (Full Stack)

A responsive full-stack CEP project dashboard for Mumbai. It includes a front end, an Express backend, public weather/air-quality API integration, JSON persistence, charting, status transparency, and CSV export.

## What works

- **Front end:** responsive dashboard, navigation, current-weather cards, pollutant snapshot, charts, community indicators, source status.
- **Back end:** Express server, API proxy endpoints, validation, refresh route, health check.
- **Live public data:** Open-Meteo weather + air-quality services (no API key needed for this prototype).
- **Persistence:** live snapshots and editable demonstration indicators are stored in `data/snapshots.json` and `data/indicators.json`.
- **CSV export:** download recorded history from `/api/history.csv`.
- **Refresh:** manual refresh button and automatic refresh every 10 minutes.
- **Honest data labels:** education, healthcare, water and road values are demonstration values, not official or live municipal readings.

## Requirements

- Node.js 18 or newer
- Internet connection for live weather/AQI and CDN-hosted Chart.js/fonts

## Start the website (Windows / macOS / Linux)

1. Download and extract the ZIP.
2. Install Node.js 18+ from the official Node.js website if it is not already installed.
3. Open a terminal/command prompt in the extracted project folder (the folder containing `package.json`).
4. Run:

   ```bash
   npm install
   npm start
   ```

5. Open this address in your browser:

   `http://localhost:3000`

6. Keep the terminal running while using the website. Press `Ctrl+C` to stop it.

### Development mode

```bash
npm run dev
```

Node's watch mode restarts the server when files change.

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Confirms backend is running |
| GET | `/api/dashboard` | Returns latest live snapshot, history, and indicators |
| POST | `/api/refresh` | Fetches fresh weather/AQI and stores a snapshot |
| GET | `/api/indicators` | Returns community demo indicators |
| PATCH | `/api/indicators/:id` | Updates a demo indicator value (0–100) |
| GET | `/api/history.csv` | Exports saved weather/AQI history as CSV |

Example health check:

```bash
curl http://localhost:3000/api/health
```

Example update of the education demo score:

```bash
curl -X PATCH http://localhost:3000/api/indicators/education \
  -H "Content-Type: application/json" \
  -d '{"value":82}'
```

## Project structure

```text
local-development-dashboard/
├── server.js
├── package.json
├── README.md
├── .gitignore
├── data/
│   ├── indicators.json
│   └── snapshots.json
└── public/
    ├── index.html
    ├── styles.css
    └── app.js
```

## Data and limitations

- Default coordinates are approximate Mumbai coordinates (19.0760, 72.8777).
- Weather is retrieved from the Open-Meteo Forecast API.
- Air quality uses Open-Meteo's air-quality API and European AQI; these are modelled grid estimates, not a street-level monitor.
- The backend records a snapshot whenever it refreshes. The chart will have more history after the server is used over time; it does not fabricate historical observations.
- The community indicator values are illustrative examples. Replace them with verified official data and citations if you present them as factual findings.
- Public API/CDN availability and their terms/limits are outside this project. A network connection is required for live readings.
- This is a student prototype, not a production monitoring service. It has no user accounts or authentication; do not expose the indicator-edit endpoint to the public internet without adding access control.

## Common problems

- **`npm` is not recognized:** install Node.js 18+ and reopen the terminal.
- **Live readings unavailable:** verify internet connectivity, then press Refresh data. The dashboard shows an error rather than inventing readings.
- **Chart or fonts missing:** CDN access may be blocked; the rest of the page and backend can still run.
- **Port 3000 is in use:** on macOS/Linux use `PORT=3001 npm start`; in Windows PowerShell use `$env:PORT=3001; npm start`, then visit `http://localhost:3001`.

## Customization

- Change default Mumbai coordinates in `server.js` under `LOCATION`.
- Change sample indicator values/text in `data/indicators.json`.
- Edit interface in `public/index.html` and `public/styles.css`.
- Edit browser behavior and chart rendering in `public/app.js`.
