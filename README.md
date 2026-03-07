# Cincinnati / NKY House Location Assistant

An interactive map for exploring neighborhoods in the Cincinnati and Northern Kentucky area.

## Setup

Clone the repo, then start a local server and open `map.html`:

```bash
cd Cincinnati-Neighborhood-Explorer
python -m http.server 5173
```

Open **http://localhost:5173/map.html** in your browser. Python 3 is required — no extra packages needed.

> The GeoJSON data files are included in the repo. Run `python download_layers.py` if you ever want to refresh them from the source.

**Alternative — Vite dev server** (requires Node.js 18+):
```bash
npm install && npm run dev
```

## Layers

Each layer is tagged **LOCAL** or **API** in the sidebar. LOCAL layers load instantly from files in the repo — toggle freely. API layers make external requests and can be slow or rate-limited if several are toggled at once.

| Layer | Source | Type |
|---|---|---|
| Crime Heatmap | Cincinnati Open Data (Socrata) | 🌐 API |
| FEMA Flood Zones | FEMA NFHL (cached locally) | 💾 LOCAL |
| Schools | Hamilton County CAGIS (310 schools) | 💾 LOCAL |
| Hospitals & Medical | OpenStreetMap / Overpass | 🌐 API |
| Grocery Stores | OpenStreetMap / Overpass | 🌐 API |
| Parks & Green Space | OpenStreetMap / Overpass | 🌐 API |
| Transit Stops | OpenStreetMap / Overpass | 🌐 API |
| Fire Stations | OpenStreetMap / Overpass | 🌐 API |
| Restaurants & Dining | OpenStreetMap / Overpass | 🌐 API |
| Neighborhoods | CAGIS + Overpass | 🌐 API |
| Income & Home Value | US Census ACS 2023 + TIGER | 🌐 API |
| Zoning | Hamilton County CAGIS (4,048 zones) | 💾 LOCAL |
| School Districts | Hamilton County CAGIS | 💾 LOCAL |
| Police Districts | Cincinnati CAGIS | 💾 LOCAL |
| Historic Districts | Cincinnati CAGIS | 💾 LOCAL |

> **Tip:** Toggling multiple API layers at once can trigger a 429 rate-limit from Overpass. The app retries automatically, but toggle them one at a time if you're in a hurry.

## Other Features

- **Work address** — Enter a work address to see straight-line distance from any clicked point
- **Neighborhood boundaries** — 53 Cincinnati + 54 NKY city boundaries with crime/school/park counts
- **Click anywhere** — Reverse geocode + nearby crime count + distance to work
- **Search bar** — Geocode any address or neighborhood name
- 3 base maps: Street, Satellite, Terrain

## Notes

No API keys required. All data sources are public.

Local GeoJSON files are sourced from [Hamilton County CAGIS](https://www.cagis.org) open data. Run `python download_layers.py` to refresh them.
