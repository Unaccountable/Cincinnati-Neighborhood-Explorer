# Cincinnati / NKY House Location Assistant

An interactive map for exploring neighborhoods in the Cincinnati and Northern Kentucky area. No build step required — just open `standalone.html` in a browser.

## Features

- **Crime heatmap** — 5,000 most recent Cincinnati PD incidents (live)
- **FEMA flood zones** — 100-year flood risk polygons (local)
- **Income & home value** — Census ACS 2023 median household income and home value by tract (live)
- **Zoning** — Hamilton County zoning classifications (local)
- **School districts** — Public school district boundaries (local)
- **Police districts** — Cincinnati Police District boundaries (local)
- **Historic districts** — Cincinnati historic districts and landmarks (local)
- **POI layers** — Schools, hospitals, grocery, parks, transit, fire stations, restaurants (OpenStreetMap)
- **Neighborhood boundaries** — 53 Cincinnati + 54 NKY city boundaries
- **Work address** — Enter a work address to see driving distance from any clicked location

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
