// ==UserScript==
// @name         Cincinnati / NKY Map Overlay
// @namespace    https://github.com/Unaccountable/Cincinnati-Neighborhood-Explorer
// @version      1.0
// @description  Overlays the Cincinnati/NKY House Location Assistant on top of Zillow's map. Requires local server running at http://localhost:5173
// @author       Cincinnati Neighborhood Explorer
// @match        https://www.zillow.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict'

  const MAP_URL = 'http://localhost:5173/map.html'

  // ── Inject styles ──────────────────────────────────────────────────────────
  const style = document.createElement('style')
  style.textContent = `
    #cincy-iframe {
      position: fixed;
      inset: 0;
      width: 100%;
      height: 100%;
      border: none;
      opacity: 0.55;
      pointer-events: none;
      z-index: 500;
      transition: opacity 0.2s;
    }
    #cincy-controls {
      position: fixed;
      top: 72px;
      right: 16px;
      background: rgba(15, 17, 23, 0.92);
      color: #dde2ee;
      padding: 12px 14px;
      border-radius: 10px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      font-size: 13px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 9px;
      min-width: 170px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.6);
      border: 1px solid rgba(255,255,255,0.08);
      user-select: none;
    }
    #cincy-controls .cincy-title {
      font-weight: 700;
      font-size: 13px;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    #cincy-controls label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      color: #b0b8cc;
    }
    #cincy-controls label:hover { color: #fff; }
    #cincy-controls input[type=range] {
      width: 100%;
      accent-color: #3d8fe0;
      cursor: pointer;
    }
    #cincy-status {
      font-size: 11px;
      color: #545f78;
      margin-top: -2px;
    }
    #cincy-controls .cincy-section {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    #cincy-controls .cincy-label-sm {
      font-size: 11px;
      color: #545f78;
      margin-bottom: 1px;
    }
  `
  document.head.appendChild(style)

  // ── iframe ─────────────────────────────────────────────────────────────────
  const iframe = document.createElement('iframe')
  iframe.id = 'cincy-iframe'
  iframe.src = MAP_URL
  document.body.appendChild(iframe)

  // ── Controls panel ─────────────────────────────────────────────────────────
  const controls = document.createElement('div')
  controls.id = 'cincy-controls'
  controls.innerHTML = `
    <div class="cincy-title">🗺 Cincy Overlay</div>
    <label>
      <input type="checkbox" id="cincy-toggle" checked>
      Show overlay
    </label>
    <div class="cincy-section">
      <div class="cincy-label-sm">Opacity</div>
      <input type="range" id="cincy-opacity" min="10" max="90" value="55">
    </div>
    <label>
      <input type="checkbox" id="cincy-interact">
      Enable clicks
    </label>
    <div id="cincy-status">Searching for map…</div>
  `
  document.body.appendChild(controls)

  // ── Control wiring ─────────────────────────────────────────────────────────
  document.getElementById('cincy-toggle').addEventListener('change', (e) => {
    iframe.style.display = e.target.checked ? 'block' : 'none'
  })

  document.getElementById('cincy-opacity').addEventListener('input', (e) => {
    iframe.style.opacity = e.target.value / 100
  })

  // "Enable clicks" mode lets you interact with the overlay (pan, toggle layers)
  // but temporarily blocks Zillow clicks. Toggle off to click Zillow listings.
  document.getElementById('cincy-interact').addEventListener('change', (e) => {
    iframe.style.pointerEvents = e.target.checked ? 'all' : 'none'
  })

  // ── Viewport sync ──────────────────────────────────────────────────────────
  // Zillow uses Mapbox GL JS. We find the map instance by looking for the
  // internal _map reference on the Mapbox container element, then forward
  // move events to the iframe via postMessage.

  function findMapboxMap () {
    // Mapbox GL stores the map instance on the container div as ._map
    const containers = document.querySelectorAll('.mapboxgl-map')
    for (const el of containers) {
      if (el._map) return el._map
    }
    // Fallback: walk up from the canvas
    const canvas = document.querySelector('.mapboxgl-canvas')
    if (canvas) {
      let el = canvas.parentElement
      while (el) {
        if (el._map) return el._map
        el = el.parentElement
      }
    }
    return null
  }

  function syncViewport (mbMap) {
    const c = mbMap.getCenter()
    const z = mbMap.getZoom()
    // Mapbox GL uses 512px tiles; Leaflet uses 256px — add 1 zoom level to match
    iframe.contentWindow?.postMessage(
      { type: 'syncViewport', lat: c.lat, lng: c.lng, zoom: z + 1 },
      '*'
    )
  }

  function attachSync (mbMap) {
    const status = document.getElementById('cincy-status')
    status.textContent = 'Map synced ✓'
    status.style.color = '#3dbb3d'

    const onMove = () => syncViewport(mbMap)
    mbMap.on('move', onMove)
    mbMap.on('zoomend', onMove)
    syncViewport(mbMap) // initial sync
  }

  // Poll until Zillow's map is ready (it loads async after page render)
  let attempts = 0
  const poll = setInterval(() => {
    attempts++
    const mbMap = findMapboxMap()
    if (mbMap) {
      clearInterval(poll)
      attachSync(mbMap)
    } else if (attempts >= 60) {
      clearInterval(poll)
      const status = document.getElementById('cincy-status')
      status.textContent = 'Map not found — reload page'
      status.style.color = '#f04040'
    }
  }, 500)

})()
