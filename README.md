# Cincinnati / NKY House Location Assistant

An interactive map for exploring neighborhoods in the Cincinnati and Northern Kentucky area. Requires a local web server to run (see Setup below) — you cannot just double-click the HTML file.

## Features

Each layer is tagged **LOCAL** or **API** in the UI. LOCAL layers load instantly from files in the repo — toggle freely. API layers make external requests and can be slow or rate-limited if several are toggled at once.

| Layer | Source | Type |
|---|---|---|
| Crime Heatmap | Cincinnati Open Data (Socrata) | 🌐 API |
| FEMA Flood Zones | FEMA NFHL (cached) | 💾 LOCAL |
| Schools (POI) | OpenStreetMap / Overpass | 🌐 API |
| Hospitals & Medical | OpenStreetMap / Overpass | 🌐 API |
| Grocery Stores | OpenStreetMap / Overpass | 🌐 API |
| Parks & Green Space | OpenStreetMap / Overpass | 🌐 API |
| Transit Stops | OpenStreetMap / Overpass | 🌐 API |
| Fire Stations | OpenStreetMap / Overpass | 🌐 API |
| Restaurants & Dining | OpenStreetMap / Overpass | 🌐 API |
| Neighborhoods | CAGIS + Overpass | 🌐 API |
| Income & Home Value | US Census ACS 2023 + TIGER | 🌐 API |
| Zoning | Hamilton County CAGIS | 💾 LOCAL |
| School Districts | Hamilton County CAGIS | 💾 LOCAL |
| Police Districts | Cincinnati CAGIS | 💾 LOCAL |
| Historic Districts | Cincinnati CAGIS | 💾 LOCAL |

> **Tip:** The Overpass API (OpenStreetMap) can return a 429 rate-limit error if several API layers are toggled simultaneously. The app will retry automatically, but toggle them one at a time if you're in a hurry.

**Other features:**
- **Work address** — Enter a work address to see straight-line distance from any clicked point
- **Neighborhood boundaries** — 53 Cincinnati + 54 NKY city boundaries with crime/school/park stats
- 3 base maps: Street, Satellite, Terrain

## Setup

> **A local server is required.** The app fetches local GeoJSON files which browsers block over `file://`. You cannot just double-click `standalone.html`.

### Quickstart (Python — no installs needed)
```bash
cd "House Location Assistant"
python -m http.server 5173
```
Then open **http://localhost:5173/standalone.html** in your browser.

### Refreshing the local data files
The GeoJSON files are included in the repo. If you want to re-download them from the source:
```bash
python download_layers.py
```
Requires Python 3, no extra packages.

### Option — Vite dev server
Requires Node.js 18+.
```bash
npm install
npm run dev
```

## Data Sources

| Layer | Source | Refresh |
|---|---|---|
| Crime | [Cincinnati Open Data](https://data.cincinnati-oh.gov) | Live |
| Flood zones | FEMA NFHL via CAGIS (cached locally) | Rarely changes |
| Income / home value | US Census ACS 5-Year 2023 | Live |
| Zoning | [Hamilton County CAGIS](https://www.cagis.org) | Run `download_layers.py` |
| School districts | Hamilton County CAGIS | Run `download_layers.py` |
| Police districts | Cincinnati CAGIS | Run `download_layers.py` |
| Historic districts | Cincinnati CAGIS | Run `download_layers.py` |
| POIs | OpenStreetMap / Overpass API | Live |
| Geocoding | Nominatim / OSM | Live |

No API keys required. All data sources are public.
