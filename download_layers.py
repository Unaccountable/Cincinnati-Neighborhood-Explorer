"""
Downloads static GeoJSON data layers from the Hamilton County CAGIS ArcGIS
open data server. Run this once (or whenever you want to refresh the data).

Usage:
    python download_layers.py

Output files (written next to this script):
    school-districts.geojson   ~313 KB   22 features
    police-districts.geojson   ~1.1 MB   28 features
    historic-districts.geojson ~122 KB   82 features
    zoning-countywide.geojson  ~18 MB  4048 features
"""

import urllib.request
import json
import os

BASE = "https://services.arcgis.com/JyZag7oO4NteHGiq/arcgis/rest/services/OpenData/FeatureServer"
OUT  = os.path.dirname(os.path.abspath(__file__))

# Single-request layers (small enough for one fetch)
SMALL = [
    (33, "school-districts"),
    (45, "police-districts"),
    (50, "historic-districts"),
]

# Paginated layers (too many features for a single request)
PAGED = [
    (25, "zoning-countywide"),
]


def fetch_page(layer_id, offset, count=1000):
    url = (
        f"{BASE}/{layer_id}/query"
        f"?where=1%3D1&outFields=*&f=geojson"
        f"&resultRecordCount={count}&resultOffset={offset}"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())


def download_small(layer_id, filename):
    print(f"  Fetching layer {layer_id}...", end=" ")
    gj = fetch_page(layer_id, 0, 2000)
    features = gj.get("features", [])
    print(f"{len(features)} features")
    out_path = os.path.join(OUT, f"{filename}.geojson")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(gj, f)
    print(f"  Saved {filename}.geojson ({os.path.getsize(out_path) // 1024} KB)")


def download_paged(layer_id, filename):
    print(f"  Fetching layer {layer_id} (paginated)...")
    all_features = []
    offset = 0
    page_size = 1000
    while True:
        gj = fetch_page(layer_id, offset, page_size)
        features = gj.get("features", [])
        if not features:
            break
        all_features.extend(features)
        print(f"    offset={offset} -> got {len(features)}, total so far: {len(all_features)}")
        if len(features) < page_size:
            break
        offset += page_size
    combined = {"type": "FeatureCollection", "features": all_features}
    out_path = os.path.join(OUT, f"{filename}.geojson")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(combined, f)
    print(f"  Saved {filename}.geojson ({os.path.getsize(out_path) // 1024} KB, {len(all_features)} features)")


print("=== Downloading static CAGIS layers ===\n")
for layer_id, filename in SMALL:
    download_small(layer_id, filename)
print()
for layer_id, filename in PAGED:
    download_paged(layer_id, filename)
print("\nDone.")
